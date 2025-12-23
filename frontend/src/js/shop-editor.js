/**
 * 店舗管理エディタ クライアント実装
 * - 店舗一覧のスプレッドシート風表示
 * - 行単位ロック（WebSocket連携）
 * - セル編集 / 即時保存 / リアルタイム反映
 * - 「〇〇さんが編集中」通知
 * - 変更履歴表示（/api/v1/admin/shops/{shop_id}/history）
 */

(function () {
  const API_BASE = "/api/v1/admin";
  const WS_PATH = "/ws/shop-editor";

  const state = {
    shops: [],
    filteredShops: [],
    locks: new Map(), // shop_id -> { user_id, user_name }
    ws: null,
    wsConnected: false,
    currentUser: null,
    editing: {
      shopId: null,
      field: null,
    },
  };

  const els = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function formatDateTime(value) {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}/${m}/${day} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function showNotification(message, type = "notice") {
    if (!els.notificationArea) return;
    const div = document.createElement("div");
    div.className = `notice ${type}`;
    div.textContent = message;
    els.notificationArea.prepend(div);
    setTimeout(() => {
      div.style.opacity = "0";
      setTimeout(() => div.remove(), 400);
    }, 3000);
  }

  function setConnectionStatus(connected) {
    state.wsConnected = connected;
    if (!els.connectionStatus) return;
    if (connected) {
      els.connectionStatus.textContent = "WebSocket: 接続中";
      els.connectionStatus.classList.remove("connection-lost");
      els.connectionStatus.classList.add("connection-ok");
    } else {
      els.connectionStatus.textContent = "WebSocket: 再接続待機中...";
      els.connectionStatus.classList.remove("connection-ok");
      els.connectionStatus.classList.add("connection-lost");
    }
  }

  async function fetchCurrentUser() {
    try {
      // このプロジェクトの既存仕様に合わせて /api/v1/auth/status を利用し、
      // 認証状態と管理者権限を確認する
      const res = await fetch("/api/v1/auth/status", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("status failed");
      }
      const data = await res.json();
      if (!data.authenticated) {
        throw new Error("not authenticated");
      }
      state.currentUser = {
        id: data.user_id,
        username: data.username,
        account_status: data.account_status,
        is_admin: data.is_admin ?? false,
      };
      if (!state.currentUser.is_admin) {
        throw new Error("not admin");
      }
      if (els.currentUserLabel) {
        els.currentUserLabel.textContent =
          state.currentUser.username || state.currentUser.id || "(unknown)";
      }
    } catch (e) {
      console.error("failed to fetch current user/auth status", e);
      showNotification(
        "管理者としてログインしていないため店舗管理エディタを利用できません。先に通常画面でログインしてください。",
        "error"
      );
      throw e;
    }
  }

  async function fetchShops() {
    const params = new URLSearchParams({
      limit: "200",
      offset: "0",
    });
    const res = await fetch(`${API_BASE}/shops?${params.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) {
      showNotification("店舗一覧の取得に失敗しました", "error");
      throw new Error("failed to load shops");
    }
    const data = await res.json();
    state.shops = data.shops || [];
    state.filteredShops = [...state.shops];

    if (els.recordInfo) {
      els.recordInfo.textContent = `全${state.shops.length}件`;
    }
    if (els.lastUpdated) {
      els.lastUpdated.textContent = `最終更新: ${formatDateTime(new Date())}`;
    }
    renderTable();
  }

  function renderTable() {
    if (!els.tbody) return;
    els.tbody.innerHTML = "";

    const searchText = (els.searchInput?.value || "").trim().toLowerCase();
    let rows = state.shops;

    if (searchText) {
      rows = rows.filter((s) => {
        const name = (s.name || "").toLowerCase();
        const addr = (s.address || "").toLowerCase();
        return name.includes(searchText) || addr.includes(searchText);
      });
    }

    state.filteredShops = rows;

    rows.forEach((shop) => {
      const tr = document.createElement("tr");
      const lockInfo = state.locks.get(shop.id);
      const isLocked = !!lockInfo;
      const isLockedBySelf =
        isLocked && state.currentUser && lockInfo.user_id === state.currentUser.id;

      if (isLockedBySelf) {
        tr.classList.add("tr-locked-self");
      } else if (isLocked) {
        tr.classList.add("tr-locked-other");
      }

      // Lock status cell
      const lockTd = document.createElement("td");
      lockTd.className = "lock-status-cell col-lock";
      if (isLocked) {
        const label =
          lockInfo.user_name ||
          lockInfo.locked_by_name ||
          lockInfo.user_id ||
          lockInfo.locked_by;
        lockTd.textContent = isLockedBySelf ? "🔒" : "🔒";
        lockTd.title = `${label} さんが編集中`;
      } else {
        lockTd.textContent = "🟢";
        lockTd.title = "編集可能";
      }
      tr.appendChild(lockTd);

      function makeCell(field) {
        const td = document.createElement("td");
        td.dataset.shopId = shop.id;
        td.dataset.field = field;
        td.className = "shop-editor-cell";
        if (field === "wait_time") {
          td.textContent = shop.wait_time != null ? `${shop.wait_time}分` : "";
        } else if (field === "last_update") {
          td.textContent = formatDateTime(shop.last_update);
        } else if (field === "editor") {
          // editor: 直近履歴のユーザー名を想定。API拡張までは空もあり得る。
          td.textContent = shop.last_editor_name || "";
        } else {
          td.textContent = shop[field] != null ? String(shop[field]) : "";
        }

        // 他人ロック中セルは編集不可
        if (tr.classList.contains("tr-locked-other")) {
          td.style.cursor = "not-allowed";
        } else if (["name", "address", "business_hours", "closed_day", "seats", "wait_time"].includes(field)) {
          td.addEventListener("dblclick", () => startEdit(td));
          td.addEventListener("click", () => {
            // 単クリックで既存編集セルを確定だけ行う
            if (
              state.editing.shopId != null &&
              (state.editing.shopId !== shop.id || state.editing.field !== field)
            ) {
              // 何もしない（編集はフォーカスアウトなどで処理）
            }
          });
        }

        return td;
      }

      tr.appendChild(makeCell("name"));
      tr.appendChild(makeCell("address"));
      tr.appendChild(makeCell("business_hours"));
      tr.appendChild(makeCell("closed_day"));
      tr.appendChild(makeCell("seats"));
      tr.appendChild(makeCell("wait_time"));
      tr.appendChild(makeCell("last_update"));

      const editorTd = makeCell("editor");
      tr.appendChild(editorTd);

      els.tbody.appendChild(tr);
    });
  }

  function startEdit(td) {
    const shopId = Number(td.dataset.shopId);
    const field = td.dataset.field;
    if (!shopId || !field) return;
    if (!state.currentUser) {
      showNotification("認証情報取得中のため編集できません", "warning");
      return;
    }

    const tr = td.closest("tr");
    if (tr && tr.classList.contains("tr-locked-other")) {
      showNotification("他のユーザーが編集中のため変更できません", "warning");
      return;
    }

    // 既存編集中セルを確定
    if (state.editing.shopId !== null) {
      // フォーカスアウトで処理される想定とし、ここでは二重開始をブロック
      return;
    }

    const originalText = td.textContent || "";
    td.innerHTML = "";
    td.classList.add("cell-editing");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "cell-input";
    if (field === "wait_time") {
      input.value = originalText.replace("分", "");
    } else {
      input.value = originalText;
    }
    td.appendChild(input);
    input.focus();
    input.select();

    state.editing.shopId = shopId;
    state.editing.field = field;

    // ロック要求
    if (state.ws && state.wsConnected) {
      state.ws.send(
        JSON.stringify({
          type: "lock_request",
          data: {
            shop_id: shopId,
          },
        })
      );
    }

    const commit = async () => {
      const newValueRaw = input.value.trim();
      let newValue = newValueRaw;
      if (field === "wait_time") {
        if (newValueRaw === "") {
          newValue = null;
        } else if (!/^\d+$/.test(newValueRaw)) {
          showNotification("待ち時間は数値で入力してください", "error");
          return;
        } else {
          newValue = parseInt(newValueRaw, 10);
        }
      }

      // WebSocket で update_field
      if (state.ws && state.wsConnected) {
        state.ws.send(
          JSON.stringify({
            type: "update_field",
            data: {
              shop_id: shopId,
              field,
              value: newValue,
            },
          })
        );
      } else {
        // フォールバックとして HTTP PATCH
        try {
          const payload = {};
          payload[field] = newValue;
          const res = await fetch(`${API_BASE}/shops/${shopId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": getCookie("csrftoken"),
            },
            credentials: "include",
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showNotification(`更新に失敗しました: ${err.detail || res.status}`, "error");
          } else {
            const updated = await res.json();
            const idx = state.shops.findIndex((s) => s.id === shopId);
            if (idx >= 0) {
              state.shops[idx] = updated;
            }
            showNotification("変更を保存しました", "notice");
            renderTable();
          }
        } catch (e) {
          console.error(e);
          showNotification("更新に失敗しました（通信エラー）", "error");
        }
      }

      // ロック解除要求
      if (state.ws && state.wsConnected) {
        state.ws.send(
          JSON.stringify({
            type: "unlock_request",
            data: {
              shop_id: shopId,
            },
          })
        );
      }

      state.editing.shopId = null;
      state.editing.field = null;
      td.classList.remove("cell-editing");
    };

    const cancel = () => {
      td.classList.remove("cell-editing");
      td.textContent = originalText;
      if (state.ws && state.wsConnected) {
        state.ws.send(
          JSON.stringify({
            type: "unlock_request",
            data: {
              shop_id: shopId,
            },
          })
        );
      }
      state.editing.shopId = null;
      state.editing.field = null;
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });

    input.addEventListener("blur", () => {
      // blur時は保存（失敗時は通知）
      if (state.editing.shopId === shopId && state.editing.field === field) {
        commit();
      }
    });
  }

  function applyFieldUpdated(data) {
    const { shop_id, field, value, updated_by_name } = data;
    const idx = state.shops.findIndex((s) => s.id === shop_id);
    if (idx === -1) return;

    const shop = state.shops[idx];
    if (field in shop) {
      shop[field] = value;
    }
    if (field !== "last_update") {
      shop.last_update = new Date().toISOString();
    }
    if (updated_by_name) {
      shop.last_editor_name = updated_by_name;
    }

    // UI反映
    renderTable();

    // 該当行をフラッシュ
    if (!els.tbody) return;
    const trs = els.tbody.querySelectorAll("tr");
    trs.forEach((tr) => {
      const idCell = tr.querySelector("td[data-shop-id]");
      if (!idCell) return;
      const sid = Number(idCell.dataset.shopId);
      if (sid === shop_id) {
        tr.classList.add("tr-updated-flash");
        setTimeout(() => tr.classList.remove("tr-updated-flash"), 1200);
      }
    });
  }

  function applyLockAcquired(data) {
    const { shop_id, user_id, user_name } = data;
    state.locks.set(shop_id, { user_id, user_name });
    const label =
      user_name ||
      user_id;
    showNotification(`${label} さんが店舗ID ${shop_id} を編集中です`, "notice");
    renderTable();
  }

  function applyLockFailed(data) {
    const { shop_id, locked_by_name, locked_by } = data;
    const label = locked_by_name || locked_by;
    showNotification(`店舗ID ${shop_id} は ${label} さんが編集中です`, "warning");
    state.locks.set(shop_id, {
      user_id: locked_by,
      user_name: locked_by_name || locked_by,
    });
    renderTable();
  }

  function applyLockReleased(data) {
    const { shop_id } = data;
    state.locks.delete(shop_id);
    renderTable();
  }

  function handleWsMessage(ev) {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const { type, data } = msg;
    switch (type) {
      case "connected":
        showNotification("リアルタイム接続が確立されました", "notice");
        break;
      case "lock_acquired":
        applyLockAcquired(data);
        break;
      case "lock_failed":
        applyLockFailed(data);
        break;
      case "lock_released":
        applyLockReleased(data);
        break;
      case "field_updated":
        applyFieldUpdated(data);
        break;
      case "lock_heartbeat":
      case "lock_missing":
      case "update_rejected":
        // 必要に応じて通知。ひとまずログに留める。
        console.debug("WS:", type, data);
        break;
      case "error":
        console.error("WS error:", data);
        showNotification(`エラー: ${data.detail || "不明なエラー"}`, "error");
        break;
      default:
        console.debug("Unknown WS message:", msg);
    }
  }

  function initWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}${WS_PATH}`;

    const ws = new WebSocket(url);
    state.ws = ws;

    ws.onopen = () => {
      setConnectionStatus(true);
    };

    ws.onmessage = handleWsMessage;

    ws.onclose = () => {
      setConnectionStatus(false);
      // 再接続（簡易）
      setTimeout(() => {
        if (!state.wsConnected) {
          initWebSocket();
        }
      }, 3000);
    };

    ws.onerror = () => {
      setConnectionStatus(false);
    };
  }

  async function openHistoryModal() {
    if (!els.historyModal || !els.historyBody) return;

    els.historyBody.innerHTML = "";
    // 現状: 全店舗の最新履歴をざっくり表示（詳細なUI要件次第で調整）
    // 仕様書では shop_id ごとの表示だが、シンプルにまとめて取得できる API がないため、
    // ここでは選択中店舗があればその履歴を、なければ何もしない仕様にする。
    const shop = state.filteredShops[0];
    if (!shop) {
      showNotification("履歴を表示する店舗がありません", "warning");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/shops/${shop.id}/history?limit=100`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showNotification(`履歴取得に失敗しました: ${err.detail || res.status}`, "error");
        return;
      }
      const data = await res.json();
      (data.history || []).forEach((h) => {
        const tr = document.createElement("tr");
        const tds = [
          formatDateTime(h.changed_at),
          shop.id,
          h.field,
          h.old_value ?? "",
          h.new_value ?? "",
          h.changed_by,
        ];
        tds.forEach((v) => {
          const td = document.createElement("td");
          td.textContent = v;
          tr.appendChild(td);
        });
        els.historyBody.appendChild(tr);
      });
      els.historyModal.classList.remove("hidden");
      els.historyModal.setAttribute("aria-hidden", "false");
    } catch (e) {
      console.error(e);
      showNotification("履歴取得中にエラーが発生しました", "error");
    }
  }

  function closeHistoryModal() {
    if (!els.historyModal) return;
    els.historyModal.classList.add("hidden");
    els.historyModal.setAttribute("aria-hidden", "true");
  }

  function bindEvents() {
    if (els.reloadBtn) {
      els.reloadBtn.addEventListener("click", () => {
        fetchShops().catch(() => { });
      });
    }
    if (els.searchInput) {
      els.searchInput.addEventListener("input", () => {
        renderTable();
      });
    }
    if (els.historyBtn) {
      els.historyBtn.addEventListener("click", () => {
        openHistoryModal();
      });
    }
    if (els.historyClose) {
      els.historyClose.addEventListener("click", () => {
        closeHistoryModal();
      });
    }
    if (els.historyModal) {
      els.historyModal.addEventListener("click", (e) => {
        if (e.target === els.historyModal) {
          closeHistoryModal();
        }
      });
    }
  }

  async function init() {
    els.notificationArea = qs("shop-editor-notification-area");
    els.searchInput = qs("shop-editor-search");
    els.filterEditingBtn = qs("shop-editor-filter-editing");
    els.sortNameBtn = qs("shop-editor-sort-name");
    els.historyBtn = qs("shop-editor-show-history");
    els.reloadBtn = qs("shop-editor-reload");
    els.tbody = qs("shop-editor-tbody");
    els.recordInfo = qs("shop-editor-record-info");
    els.connectionStatus = qs("shop-editor-connection-status");
    els.lastUpdated = qs("shop-editor-last-updated");
    els.currentUserLabel = qs("shop-editor-current-user");
    els.historyModal = qs("shop-editor-history-modal");
    els.historyBody = qs("shop-editor-history-body");
    els.historyClose = qs("shop-editor-history-close");

    await fetchCurrentUser();
    await fetchShops();
    bindEvents();
    initWebSocket();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // グローバルに公開（router 等から呼び出し可能にする場合）
  window.ShopEditor = {
    init,
  };
})();