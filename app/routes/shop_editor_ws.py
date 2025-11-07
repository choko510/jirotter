from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.websockets import WebSocketState
from sqlalchemy.orm import Session

from database import get_db
from app.models import RamenShop, ShopEditLock, ShopChangeHistory, User
from app.utils.auth import get_current_admin_user

router = APIRouter()

LOCK_TTL_SECONDS = 90  # ハートビートがこの秒数途絶えたらロック失効
HEARTBEAT_GRACE_SECONDS = 5  # 若干の猶予


class ConnectionManager:
    """
    店舗管理エディタ用 WebSocket 接続管理
    """

    def __init__(self) -> None:
        # 接続中クライアント一覧
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        data = message
        living_connections: List[WebSocket] = []
        for ws in self.active_connections:
            if ws.application_state == WebSocketState.CONNECTED:
                try:
                    await ws.send_json(data)
                    living_connections.append(ws)
                except Exception:
                    # 送信失敗した接続はクローズ扱い
                    try:
                        await ws.close()
                    except Exception:
                        pass
            # 切断済み
        self.active_connections = living_connections

    async def send_personal(self, websocket: WebSocket, message: Dict[str, Any]) -> None:
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.send_json(message)


manager = ConnectionManager()


def _cleanup_expired_locks(db: Session) -> None:
    """
    有効期限切れロックのクリーンアップ
    """
    now = datetime.now(timezone.utc)
    expired = (
        db.query(ShopEditLock)
        .filter(ShopEditLock.expires_at <= now)
        .all()
    )
    if not expired:
        return

    expired_infos = []
    for lock in expired:
        expired_infos.append(
            {
                "shop_id": lock.shop_id,
                "user_id": lock.user_id,
            }
        )
        db.delete(lock)
    db.commit()


def _get_lock(db: Session, shop_id: int) -> ShopEditLock | None:
    return (
        db.query(ShopEditLock)
        .filter(ShopEditLock.shop_id == shop_id)
        .first()
    )


def _acquire_lock(
    db: Session,
    shop_id: int,
    user: User,
) -> Dict[str, Any]:
    """
    行単位ロック取得
    """
    _cleanup_expired_locks(db)

    lock = _get_lock(db, shop_id)
    now = datetime.now(timezone.utc)

    # 既存ロックがあり、自分のロックなら延長
    if lock and lock.user_id == user.id:
        lock.last_heartbeat = now
        lock.expires_at = now + timedelta(seconds=LOCK_TTL_SECONDS)
        db.add(lock)
        db.commit()
        db.refresh(lock)
        return {
            "type": "lock_acquired",
            "data": {
                "shop_id": shop_id,
                "user_id": user.id,
                "user_name": user.username or user.id,
            },
        }

    # 他人のロックが有効
    if lock:
        # 念のため期限判定（二重防御）
        if lock.expires_at > now:
            return {
                "type": "lock_failed",
                "data": {
                    "shop_id": shop_id,
                    "locked_by": lock.user_id,
                    "locked_by_name": (lock.user.username if lock.user else lock.user_id),
                },
            }
        # 期限切れならクリーンアップして新規取得に進む
        db.delete(lock)
        db.commit()

    # 新規ロック
    new_lock = ShopEditLock(
        shop_id=shop_id,
        user_id=user.id,
        locked_at=now,
        last_heartbeat=now,
        expires_at=now + timedelta(seconds=LOCK_TTL_SECONDS),
    )
    db.add(new_lock)
    db.commit()
    db.refresh(new_lock)

    return {
        "type": "lock_acquired",
        "data": {
            "shop_id": shop_id,
            "user_id": user.id,
            "user_name": user.username or user.id,
        },
    }


def _release_lock(
    db: Session,
    shop_id: int,
    user: User,
    force: bool = False,
) -> Dict[str, Any] | None:
    """
    ロック解除。force=False の場合はロック所有者のみ解除可能。
    WebSocket切断時などサーバ側クリーンアップでは force=True を利用。
    """
    lock = _get_lock(db, shop_id)
    if not lock:
        return None

    if not force and lock.user_id != user.id:
        # 不正解除要求
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="他のユーザーのロックは解除できません",
        )

    db.delete(lock)
    db.commit()
    return {
        "type": "lock_released",
        "data": {
            "shop_id": shop_id,
        },
    }


def _heartbeat_lock(
    db: Session,
    shop_id: int,
    user: User,
) -> Dict[str, Any]:
    """
    ハートビートによりロックを延長
    """
    lock = _get_lock(db, shop_id)
    now = datetime.now(timezone.utc)
    if not lock or lock.user_id != user.id:
        return {
            "type": "lock_missing",
            "data": {
                "shop_id": shop_id,
            },
        }

    lock.last_heartbeat = now
    lock.expires_at = now + timedelta(seconds=LOCK_TTL_SECONDS)
    db.add(lock)
    db.commit()

    return {
        "type": "lock_heartbeat",
        "data": {
            "shop_id": shop_id,
            "expires_at": lock.expires_at.isoformat(),
        },
    }


def _apply_field_update(
    db: Session,
    shop_id: int,
    user: User,
    field: str,
    value: Any,
) -> Dict[str, Any]:
    """
    店舗情報の単フィールド更新。ロック所有者のみ許可。
    """
    _cleanup_expired_locks(db)

    shop = db.query(RamenShop).filter(RamenShop.id == shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="店舗が見つかりません",
        )

    lock = _get_lock(db, shop_id)
    now = datetime.now(timezone.utc)

    if not lock or lock.user_id != user.id or lock.expires_at <= now:
        return {
            "type": "update_rejected",
            "data": {
                "shop_id": shop_id,
                "field": field,
                "reason": "lock_required",
            },
        }

    # 更新可能なフィールドのみ許可（サーバ側ホワイトリスト）
    allowed_fields = {
        "name",
        "address",
        "business_hours",
        "closed_day",
        "seats",
        "wait_time",
        "latitude",
        "longitude",
    }
    if field not in allowed_fields:
        return {
            "type": "update_rejected",
            "data": {
                "shop_id": shop_id,
                "field": field,
                "reason": "field_not_allowed",
            },
        }

    # old / new を履歴用に取得
    old_value = getattr(shop, field, None)
    # 型変換: wait_time は int, latitude/longitude は float を想定
    try:
        if field == "wait_time" and value is not None:
            value = int(value)
        if field in {"latitude", "longitude"} and value is not None:
            value = float(value)
    except (TypeError, ValueError):
        return {
            "type": "update_rejected",
            "data": {
                "shop_id": shop_id,
                "field": field,
                "reason": "invalid_type",
            },
        }

    if old_value == value:
        # 実質変更なし
        return {
            "type": "field_updated",
            "data": {
                "shop_id": shop_id,
                "field": field,
                "value": old_value,
                "updated_by": user.id,
                "updated_by_name": user.username or user.id,
                "no_change": True,
            },
        }

    setattr(shop, field, value)
    shop.last_update = now

    # 履歴記録
    history = ShopChangeHistory(
        shop_id=shop_id,
        user_id=user.id,
        field_name=field,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(value) if value is not None else None,
        changed_at=now,
        change_type="update",
    )
    db.add(shop)
    db.add(history)
    db.commit()
    db.refresh(shop)

    return {
        "type": "field_updated",
        "data": {
            "shop_id": shop_id,
            "field": field,
            "value": value,
            "updated_by": user.id,
            "updated_by_name": user.username or user.id,
        },
    }


@router.websocket("/ws/shop-editor")
async def shop_editor_ws(
    websocket: WebSocket,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    店舗管理エディタ用 WebSocket エンドポイント

    - 認証必須（current_admin_user）
    - 行単位ロック
    - フィールド更新のリアルタイム反映
    - 「〇〇さんが編集中」通知
    """
    # 管理者限定
    if not current_user.is_admin:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)

    try:
        # 接続通知（クライアント側で利用したければ）
        await manager.send_personal(
            websocket,
            {
                "type": "connected",
                "data": {
                    "user_id": current_user.id,
                    "user_name": current_user.username or current_user.id,
                },
            },
        )

        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")
            data = message.get("data") or {}

            # 各メッセージ種別ごとに処理
            if msg_type == "lock_request":
                shop_id = int(data.get("shop_id"))
                result = _acquire_lock(db, shop_id, current_user)
                # 結果は全員へ通知（ロック状態共有）
                await manager.broadcast(result)

            elif msg_type == "unlock_request":
                shop_id = int(data.get("shop_id"))
                # 成功時のみ broadcast
                try:
                    result = _release_lock(db, shop_id, current_user, force=False)
                except HTTPException as e:
                    await manager.send_personal(
                        websocket,
                        {
                            "type": "error",
                            "data": {
                                "code": e.status_code,
                                "detail": e.detail,
                            },
                        },
                    )
                    continue
                if result:
                    await manager.broadcast(result)

            elif msg_type == "heartbeat":
                shop_id = int(data.get("shop_id"))
                result = _heartbeat_lock(db, shop_id, current_user)
                # ハートビート結果は自分だけで十分
                await manager.send_personal(websocket, result)

            elif msg_type == "update_field":
                shop_id = int(data.get("shop_id"))
                field = data.get("field")
                value = data.get("value")
                result = _apply_field_update(db, shop_id, current_user, field, value)
                # 更新成功/拒否は要求元に返却
                await manager.send_personal(websocket, result)
                # 成功（update_rejectedでない）なら他クライアントにも反映
                if result.get("type") == "field_updated" and not result["data"].get("no_change"):
                    await manager.broadcast(result)

            else:
                # 未知メッセージ
                await manager.send_personal(
                    websocket,
                    {
                        "type": "error",
                        "data": {
                            "code": 400,
                            "detail": f"Unknown message type: {msg_type}",
                        },
                    },
                )

    except WebSocketDisconnect:
        # 接続切断時: 当該ユーザーが保持しているロックを全て解放
        # （簡易実装: このコネクションが所有していたロックはない前提で user_id ベースで解除）
        try:
            # セッション再取得
            cleanup_db: Session = next(get_db())
            locks = (
                cleanup_db.query(ShopEditLock)
                .filter(ShopEditLock.user_id == current_user.id)
                .all()
            )
            changed_shop_ids: List[int] = []
            for lock in locks:
                changed_shop_ids.append(lock.shop_id)
                cleanup_db.delete(lock)
            if locks:
                cleanup_db.commit()
            for sid in changed_shop_ids:
                await manager.broadcast(
                    {
                        "type": "lock_released",
                        "data": {
                            "shop_id": sid,
                        },
                    }
                )
        except Exception:
            # クリーンアップ失敗は致命でないので握りつぶす
            pass
        finally:
            manager.disconnect(websocket)
    except Exception:
        # その他の例外でも接続を安全にクローズ
        try:
            await websocket.close()
        except Exception:
            pass
        manager.disconnect(websocket)