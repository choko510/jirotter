(() => {
    const state = {
        users: [],
        shops: [],
        selectedUserId: null,
        selectedShopId: null,
        userSearch: '',
        shopSearch: '',
    };

    const elements = {};

    document.addEventListener('DOMContentLoaded', () => {
        cacheElements();
        bindEvents();
        refreshAll();
    });

    function cacheElements() {
        elements.feedback = document.getElementById('dashboard-feedback');
        elements.totalUsers = document.getElementById('total-users');
        elements.newUsers = document.getElementById('new-users');
        elements.activeUsers = document.getElementById('active-users');
        elements.restrictedUsers = document.getElementById('restricted-users');
        elements.bannedUsers = document.getElementById('banned-users');
        elements.pendingSubmissions = document.getElementById('pending-submissions');
        elements.reportsLastWeek = document.getElementById('reports-last-week');

        elements.userTable = document.getElementById('user-table').querySelector('tbody');
        elements.userSearchForm = document.getElementById('user-search-form');
        elements.userSearchInput = document.getElementById('user-search-input');
        elements.userDetail = document.getElementById('user-detail');
        elements.userDetailFields = {
            username: document.getElementById('detail-username'),
            userid: document.getElementById('detail-userid'),
            status: document.getElementById('detail-status'),
            email: document.getElementById('detail-email'),
            created: document.getElementById('detail-created'),
            points: document.getElementById('detail-points'),
            internal: document.getElementById('detail-internal'),
            followers: document.getElementById('detail-followers'),
            following: document.getElementById('detail-following'),
            submissions: document.getElementById('detail-submissions'),
            ban: document.getElementById('detail-ban'),
            restriction: document.getElementById('detail-restriction'),
        };
        elements.noteInput = document.getElementById('detail-note-input');
        elements.noteSaveButton = document.getElementById('save-note-btn');
        elements.userActionButtons = elements.userDetail.querySelector('.action-buttons');

        elements.shopTable = document.getElementById('shop-table').querySelector('tbody');
        elements.shopSearchForm = document.getElementById('shop-search-form');
        elements.shopSearchInput = document.getElementById('shop-search-input');
        elements.shopDetail = document.getElementById('shop-detail');
        elements.shopDetailFields = {
            name: document.getElementById('shop-name'),
            address: document.getElementById('shop-address'),
            hours: document.getElementById('shop-hours'),
            closed: document.getElementById('shop-closed'),
            seats: document.getElementById('shop-seats'),
            lat: document.getElementById('shop-lat'),
            lon: document.getElementById('shop-lon'),
            wait: document.getElementById('shop-wait'),
            meta: document.getElementById('shop-meta'),
        };
        elements.shopSaveButton = document.getElementById('shop-save-btn');
        elements.newShopForm = document.getElementById('new-shop-form');
    }

    function bindEvents() {
        elements.userSearchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            state.userSearch = elements.userSearchInput.value.trim();
            loadUsers();
        });

        elements.userTable.addEventListener('click', (event) => {
            const row = event.target.closest('tr');
            if (!row) return;
            if (event.target.closest('button')) return;
            const userId = row.dataset.userId;
            if (userId) {
                selectUser(userId);
            }
        });

        elements.userActionButtons.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button || !state.selectedUserId) return;
            event.stopPropagation();
            const action = button.dataset.action;
            handleUserAction(action);
        });

        elements.noteSaveButton.addEventListener('click', async (event) => {
            event.preventDefault();
            if (!state.selectedUserId) return;
            await updateUserModeration({ moderation_note: elements.noteInput.value });
        });

        elements.shopSearchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            state.shopSearch = elements.shopSearchInput.value.trim();
            loadShops();
        });

        elements.shopTable.addEventListener('click', (event) => {
            const row = event.target.closest('tr');
            if (!row) return;
            const shopId = row.dataset.shopId;
            if (shopId) {
                selectShop(parseInt(shopId, 10));
            }
        });

        elements.shopSaveButton.addEventListener('click', async (event) => {
            event.preventDefault();
            if (!state.selectedShopId) return;
            const payload = {
                business_hours: valueOrNull(elements.shopDetailFields.hours.value),
                closed_day: valueOrNull(elements.shopDetailFields.closed.value),
                seats: valueOrNull(elements.shopDetailFields.seats.value),
                latitude: parseFloatOrNull(elements.shopDetailFields.lat.value),
                longitude: parseFloatOrNull(elements.shopDetailFields.lon.value),
                wait_time: parseIntOrNull(elements.shopDetailFields.wait.value),
            };
            await updateShop(state.selectedShopId, payload);
        });

        elements.newShopForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = {
                name: elements.newShopForm.querySelector('#new-shop-name').value.trim(),
                address: elements.newShopForm.querySelector('#new-shop-address').value.trim(),
                latitude: parseFloat(elements.newShopForm.querySelector('#new-shop-lat').value),
                longitude: parseFloat(elements.newShopForm.querySelector('#new-shop-lon').value),
                business_hours: valueOrNull(elements.newShopForm.querySelector('#new-shop-hours').value),
                closed_day: valueOrNull(elements.newShopForm.querySelector('#new-shop-closed').value),
                seats: valueOrNull(elements.newShopForm.querySelector('#new-shop-seats').value),
                wait_time: parseIntOrNull(elements.newShopForm.querySelector('#new-shop-wait').value),
            };

            try {
                await API.request('/api/v1/admin/shops', {
                    method: 'POST',
                    body: payload,
                });
                showFeedback('店舗を登録しました', false);
                elements.newShopForm.reset();
                loadShops();
            } catch (error) {
                showFeedback(error.message || '店舗の登録に失敗しました', true);
            }
        });
    }

    async function refreshAll() {
        await Promise.all([refreshOverview(), loadUsers(), loadShops()]);
    }

    async function refreshOverview() {
        try {
            const data = await API.request('/api/v1/admin/overview');
            elements.totalUsers.textContent = numberFormat(data.total_users);
            elements.newUsers.textContent = `過去7日: ${numberFormat(data.new_users_last_week)}`;
            elements.activeUsers.textContent = numberFormat(data.active_users);
            elements.restrictedUsers.textContent = numberFormat(data.restricted_users);
            elements.bannedUsers.textContent = numberFormat(data.banned_users);
            elements.pendingSubmissions.textContent = numberFormat(data.pending_shop_submissions);
            elements.reportsLastWeek.textContent = numberFormat(data.reports_last_week);
        } catch (error) {
            showFeedback(error.message || 'サマリーの取得に失敗しました', true);
        }
    }

    async function loadUsers() {
        try {
            const query = new URLSearchParams();
            query.set('limit', '50');
            if (state.userSearch) {
                query.set('search', state.userSearch);
            }
            const data = await API.request(`/api/v1/admin/users?${query.toString()}`);
            state.users = data.users || [];
            renderUserTable();
        } catch (error) {
            showFeedback(error.message || 'ユーザー一覧の取得に失敗しました', true);
        }
    }

    function renderUserTable() {
        elements.userTable.innerHTML = '';
        state.users.forEach((user) => {
            const tr = document.createElement('tr');
            tr.dataset.userId = user.id;
            if (user.id === state.selectedUserId) {
                tr.classList.add('active');
            }

            tr.innerHTML = `
                <td>${API.escapeHtml(user.id)}</td>
                <td>${API.escapeHtml(user.username)}</td>
                <td>${renderStatusPill(user.effective_account_status)}</td>
                <td>${numberFormat(user.points)}</td>
                <td>${numberFormat(user.posts_count)}</td>
                <td>${numberFormat(user.reports_submitted)}</td>
                <td>
                    <div class="table-actions">
                        <button class="secondary-button danger" data-action="ban" data-user="${API.escapeHtml(user.id)}">BAN</button>
                        <button class="secondary-button warning" data-action="restrict" data-user="${API.escapeHtml(user.id)}">制限</button>
                        <button class="secondary-button" data-action="lift" data-user="${API.escapeHtml(user.id)}">解除</button>
                    </div>
                </td>
            `;

            tr.querySelectorAll('button[data-action]').forEach((button) => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const action = button.dataset.action;
                    state.selectedUserId = user.id;
                    selectUser(user.id, false);
                    handleUserAction(action);
                });
            });

            elements.userTable.appendChild(tr);
        });
    }

    async function selectUser(userId, fetchDetail = true) {
        state.selectedUserId = userId;
        renderUserTable();
        if (!fetchDetail) return;

        try {
            const detail = await API.request(`/api/v1/admin/users/${encodeURIComponent(userId)}`);
            showUserDetail(detail);
        } catch (error) {
            showFeedback(error.message || 'ユーザー詳細の取得に失敗しました', true);
        }
    }

    function showUserDetail(detail) {
        elements.userDetail.hidden = false;
        elements.userDetailFields.username.textContent = detail.username;
        elements.userDetailFields.userid.textContent = `ID: ${detail.id}`;
        elements.userDetailFields.status.textContent = statusLabel(detail.effective_account_status);
        elements.userDetailFields.status.className = `status-badge ${detail.effective_account_status}`;
        elements.userDetailFields.email.textContent = detail.email;
        elements.userDetailFields.created.textContent = formatDate(detail.created_at);
        elements.userDetailFields.points.textContent = numberFormat(detail.points);
        elements.userDetailFields.internal.textContent = `${detail.internal_score}`;
        elements.userDetailFields.followers.textContent = numberFormat(detail.followers_count);
        elements.userDetailFields.following.textContent = numberFormat(detail.following_count);
        elements.userDetailFields.submissions.textContent = numberFormat(detail.shop_submissions_count);
        elements.userDetailFields.ban.textContent = detail.ban_expires_at ? formatDate(detail.ban_expires_at) : 'なし';
        elements.userDetailFields.restriction.textContent = detail.posting_restriction_expires_at ? formatDate(detail.posting_restriction_expires_at) : 'なし';
        elements.noteInput.value = detail.moderation_note || '';
        elements.userActionButtons.querySelector('[data-action="toggle-admin"]').textContent = detail.is_admin ? '管理者権限を外す' : '管理者権限を付与';
    }

    async function handleUserAction(action) {
        if (!state.selectedUserId) return;
        const now = new Date();
        switch (action) {
            case 'ban':
                await updateUserModeration({
                    account_status_override: 'banned',
                    clear_ban_schedule: true,
                    clear_posting_restriction: true,
                });
                break;
            case 'restrict': {
                const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                await updateUserModeration({
                    account_status_override: 'restricted',
                    posting_restriction_expires_at: expires.toISOString(),
                    clear_ban_schedule: true,
                });
                break;
            }
            case 'lift':
                await updateUserModeration({
                    revert_account_status_override: true,
                    clear_posting_restriction: true,
                    clear_ban_schedule: true,
                });
                break;
            case 'toggle-admin': {
                const current = state.users.find((u) => u.id === state.selectedUserId);
                const isAdmin = current ? current.is_admin : false;
                await updateUserModeration({ is_admin: !isAdmin });
                break;
            }
            default:
                break;
        }
    }

    async function updateUserModeration(payload) {
        try {
            const detail = await API.request(`/api/v1/admin/users/${encodeURIComponent(state.selectedUserId)}`, {
                method: 'PATCH',
                body: payload,
            });
            showFeedback('ユーザー情報を更新しました', false);
            elements.userDetail.hidden = false;
            showUserDetail(detail);
            await loadUsers();
        } catch (error) {
            showFeedback(error.message || 'ユーザー情報の更新に失敗しました', true);
        }
    }

    async function loadShops() {
        try {
            const params = new URLSearchParams();
            params.set('limit', '50');
            if (state.shopSearch) {
                params.set('search', state.shopSearch);
            }
            const data = await API.request(`/api/v1/admin/shops?${params.toString()}`);
            state.shops = data.shops || [];
            renderShopTable();
        } catch (error) {
            showFeedback(error.message || '店舗一覧の取得に失敗しました', true);
        }
    }

    function renderShopTable() {
        elements.shopTable.innerHTML = '';
        state.shops.forEach((shop) => {
            const tr = document.createElement('tr');
            tr.dataset.shopId = shop.id;
            if (shop.id === state.selectedShopId) {
                tr.classList.add('active');
            }
            tr.innerHTML = `
                <td>${API.escapeHtml(shop.name)}</td>
                <td>${API.escapeHtml(shop.address)}</td>
                <td>${shop.wait_time ?? 0}分</td>
                <td>${numberFormat(shop.posts_count)}</td>
                <td>${numberFormat(shop.pending_submissions)}</td>
            `;
            elements.shopTable.appendChild(tr);
        });
    }

    async function selectShop(shopId) {
        state.selectedShopId = shopId;
        renderShopTable();
        try {
            const detail = await API.request(`/api/v1/admin/shops/${shopId}`);
            showShopDetail(detail);
        } catch (error) {
            showFeedback(error.message || '店舗詳細の取得に失敗しました', true);
        }
    }

    function showShopDetail(detail) {
        elements.shopDetail.hidden = false;
        elements.shopDetailFields.name.textContent = detail.name;
        elements.shopDetailFields.address.textContent = detail.address;
        elements.shopDetailFields.hours.value = detail.business_hours || '';
        elements.shopDetailFields.closed.value = detail.closed_day || '';
        elements.shopDetailFields.seats.value = detail.seats || '';
        elements.shopDetailFields.lat.value = detail.latitude ?? '';
        elements.shopDetailFields.lon.value = detail.longitude ?? '';
        elements.shopDetailFields.wait.value = detail.wait_time ?? '';
        elements.shopDetailFields.meta.textContent = `投稿数: ${detail.posts_count} / 提出履歴: ${detail.submissions_total}`;
    }

    async function updateShop(shopId, payload) {
        try {
            const detail = await API.request(`/api/v1/admin/shops/${shopId}`, {
                method: 'PATCH',
                body: payload,
            });
            showFeedback('店舗情報を更新しました', false);
            showShopDetail(detail);
            await loadShops();
        } catch (error) {
            showFeedback(error.message || '店舗情報の更新に失敗しました', true);
        }
    }

    function renderStatusPill(status) {
        const label = statusLabel(status);
        return `<span class="status-pill ${status}">${API.escapeHtml(label)}</span>`;
    }

    function statusLabel(status) {
        switch (status) {
            case 'active':
                return 'アクティブ';
            case 'warning':
                return '注意';
            case 'restricted':
                return '投稿制限';
            case 'banned':
                return 'BAN中';
            default:
                return status || '不明';
        }
    }

    function showFeedback(message, isError = false) {
        if (!elements.feedback) return;
        elements.feedback.textContent = message;
        elements.feedback.hidden = false;
        elements.feedback.classList.toggle('error', isError);
        if (!isError) {
            setTimeout(() => {
                elements.feedback.hidden = true;
            }, 4000);
        }
    }

    function numberFormat(value) {
        return new Intl.NumberFormat('ja-JP').format(value ?? 0);
    }

    function formatDate(dateString) {
        if (!dateString) return '―';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '―';
        return date.toLocaleString('ja-JP');
    }

    function valueOrNull(value) {
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    }

    function parseFloatOrNull(value) {
        const trimmed = value.trim();
        if (trimmed === '') return null;
        const parsed = parseFloat(trimmed);
        return Number.isNaN(parsed) ? null : parsed;
    }

    function parseIntOrNull(value) {
        const trimmed = value?.toString().trim();
        if (!trimmed) return null;
        const parsed = parseInt(trimmed, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }
})();
