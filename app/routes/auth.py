from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Dict, Any, Optional
from functools import wraps

from database import get_db
from app.models import User
from app.schemas import UserCreate, UserLogin, UserResponse, Token
from app.utils.auth import create_access_token, get_current_user, get_current_active_user, get_current_user_optional
from app.utils.security import validate_registration_data, validate_login_data

router = APIRouter(tags=["auth"])

# CSRFチェックをスキップするデコレータ
def skip_csrf_check(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # リクエストオブジェクトを取得
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break
        
        if request:
            # CSRFチェックをスキップするマークを設定
            request.state.skip_csrf_check = True
        
        return await func(*args, **kwargs)
    return wrapper

@router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@skip_csrf_check
async def register(user_data: UserCreate, db: Session = Depends(get_db), request: Request = None):
    """ユーザー登録エンドポイント"""
    # デバッグログ
    print(f"登録リクエスト受信: {user_data}")
    
    # バリデーション
    validation_errors = validate_registration_data(user_data.model_dump(), db)
    if validation_errors:
        print(f"バリデーションエラー: {validation_errors}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=validation_errors
        )
    
    # ユーザー作成
    user = User(
        id=user_data.id,
        username=user_data.id, # ユーザー名をIDと同じ値で初期化
        email=user_data.email
    )
    user.set_password(user_data.password)
    
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # アクセストークンの発行
        access_token = create_access_token(data={"sub": user.id})
        
        # ユーザーレスポンスの作成
        user_response = UserResponse.model_validate(user)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_response
        }
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ユーザー登録に失敗しました"
        )

@router.post("/auth/login", response_model=Token)
@skip_csrf_check
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """ログインエンドポイント"""
    # バリデーション
    validation_errors = validate_login_data(login_data.model_dump())
    if validation_errors:
        # エラーメッセージを文字列に変換
        error_messages = []
        for field, message in validation_errors.items():
            error_messages.append(f"{field}: {message}")
        error_message = " ".join(error_messages)
        
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_message
        )
    
    # ユーザー認証
    user = db.query(User).filter(User.id == login_data.id).first()
    
    if not user or not user.check_password(login_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザーIDまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # アクセストークンの発行
    access_token = create_access_token(data={"sub": user.id})
    
    # ユーザーレスポンスの作成
    user_response = UserResponse.model_validate(user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

@router.get("/auth/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_active_user)):
    """ユーザープロフィール取得エンドポイント"""
    return UserResponse.model_validate(current_user)

@router.get("/auth/csrf-token")
async def get_csrf_token():
    """CSRFトークンを取得するエンドポイント"""
    return {"message": "CSRF token set in cookie"}

@router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """ログアウトエンドポイント（クライアント側でトークンを削除する必要があります）"""
    return {"message": "ログアウトしました"}

@router.get("/auth/status")
async def get_auth_status(current_user: Optional[User] = Depends(get_current_user_optional)):
    """認証状態とアカウント状態を取得するエンドポイント"""
    from app.utils.scoring import compute_effective_account_status, get_status_message
    
    if not current_user:
        return {
            "authenticated": False,
            "user_id": None,
            "username": None,
            "account_status": None,
            "status_message": None,
            "is_banned": False,
            "ban_expires_at": None
        }
    
    # アカウント状態を計算
    account_status = compute_effective_account_status(current_user)
    status_message = get_status_message(current_user)
    
    return {
        "authenticated": True,
        "user_id": current_user.id,
        "username": current_user.username,
        "account_status": account_status,
        "status_message": status_message,
        "is_banned": account_status == "banned",
        "ban_expires_at": current_user.ban_expires_at.isoformat() if current_user.ban_expires_at else None
    }