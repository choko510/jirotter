(function () {
    const TOKYO_CENTER = [35.681236, 139.767125];
    const FIELD_LABELS = {
        name: '店舗名',
        address: '住所',
        business_hours: '営業時間',
        closed_day: '定休日',
        seats: '座席数',
        latitude: '緯度',
        longitude: '経度',
    };

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '-';
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    function setFeedback(node, message, type) {
        if (!node) return;
        if (!message) {
            node.textContent = '';
            node.classList.remove('success', 'error');
            node.setAttribute('hidden', 'hidden');
            return;
        }
        node.textContent = message;
        node.classList.remove('success', 'error');
        if (type) node.classList.add(type);
        node.removeAttribute('hidden');
    }

    function statusInfo(status) {
        switch (status) {
            case 'approved':
                return { label: '承認済み', className: 'status-approved' };
            case 'rejected':
                return { label: '差し戻し', className: 'status-rejected' };
            default:
                return { label: '審査中', className: 'status-pending' };
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const token = API.getCookie('authToken');
        const pendingList = document.getElementById('pending-list');
        const feedbackNode = document.getElementById('admin-feedback');
        const placeholder = document.getElementById('admin-placeholder');
        const detailPane = document.getElementById('admin-detail');
        const detailTitle = document.getElementById('detail-title');
        const detailMeta = document.getElementById('detail-meta');
        const detailStatus = document.getElementById('detail-status');
        const detailId = document.getElementById('detail-id');
        const detailShopId = document.getElementById('detail-shop-id');
        const detailType = document.getElementById('detail-type');
        const detailProposer = document.getElementById('detail-proposer');
        const detailCreated = document.getElementById('detail-created');
        const detailNote = document.getElementById('detail-note');
        const changeTableBody = document.querySelector('#change-table tbody');
        const commentInput = document.getElementById('review-comment');
        const approveButton = document.getElementById('approve-btn');
        const rejectButton = document.getElementById('reject-btn');

        if (!token) {
            setFeedback(feedbackNode, '管理者としてログインすると審査ツールを使用できます。', 'error');
            [approveButton, rejectButton, commentInput].forEach((node) => node && node.setAttribute('disabled', 'disabled'));
            return;
        }

        const map = L.map('admin-map', { preferCanvas: true }).setView(TOKYO_CENTER, 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
        }).addTo(map);
        let mapMarker = null;

        function updateMap(lat, lon) {
            if (typeof lat !== 'number' || Number.isNaN(lat) || typeof lon !== 'number' || Number.isNaN(lon)) {
                if (mapMarker) {
                    map.removeLayer(mapMarker);
                    mapMarker = null;
                }
                map.setView(TOKYO_CENTER, 5);
                return;
            }
            if (!mapMarker) {
                mapMarker = L.marker([lat, lon]).addTo(map);
            } else {
                mapMarker.setLatLng([lat, lon]);
            }
            map.setView([lat, lon], 15, { animate: true, duration: 0.4 });
        }

        let submissions = [];
        let activeSubmissionId = null;

        function clearSelection() {
            placeholder.removeAttribute('hidden');
            detailPane.setAttribute('hidden', 'hidden');
            changeTableBody.innerHTML = '';
            commentInput.value = '';
            activeSubmissionId = null;
            Array.from(pendingList.querySelectorAll('.pending-item')).forEach((node) => {
                node.classList.remove('active');
            });
            updateMap();
        }

        async function renderDetail(submission) {
            if (!submission) {
                clearSelection();
                return;
            }
            activeSubmissionId = submission.id;
            placeholder.setAttribute('hidden', 'hidden');
            detailPane.removeAttribute('hidden');

            Array.from(pendingList.querySelectorAll('.pending-item')).forEach((node) => {
                node.classList.toggle('active', Number(node.dataset.id) === submission.id);
            });

            const status = statusInfo(submission.status);
            detailTitle.textContent = submission.change_type === 'new'
                ? `新規店舗: ${submission.proposed_changes.name || '名称未入力'}`
                : `店舗更新: ${submission.proposed_changes.name || `ID ${submission.shop_id}`}`;
            detailMeta.textContent = `申請者: ${submission.proposer.username} ・ 送信日時: ${formatDate(submission.created_at)}`;
            detailStatus.textContent = status.label;
            detailStatus.className = `history-status ${status.className}`;
            detailId.textContent = submission.id;
            detailShopId.textContent = submission.shop_id ?? '—';
            detailType.textContent = submission.change_type === 'new' ? '新規追加' : '既存更新';
            detailProposer.textContent = `${submission.proposer.username} (${submission.proposer.id})`;
            detailCreated.textContent = formatDate(submission.created_at);
            detailNote.textContent = submission.note || '—';

            changeTableBody.innerHTML = '';
            const currentValues = {};
            if (submission.shop_id) {
                try {
                    const shop = await API.request(`/api/v1/ramen/${submission.shop_id}`, { includeAuth: false });
                    currentValues.name = shop.name;
                    currentValues.address = shop.address;
                    currentValues.business_hours = shop.business_hours;
                    currentValues.closed_day = shop.closed_day;
                    currentValues.seats = shop.seats;
                    currentValues.latitude = shop.latitude;
                    currentValues.longitude = shop.longitude;
                } catch (error) {
                    console.warn('店舗情報の取得に失敗しました', error);
                }
            }

            const rows = Object.keys(FIELD_LABELS)
                .filter((key) => Object.prototype.hasOwnProperty.call(submission.proposed_changes, key))
                .map((key) => ({
                    key,
                    label: FIELD_LABELS[key],
                    proposed: submission.proposed_changes[key],
                    current: currentValues[key],
                }));

            if (rows.length === 0) {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 3;
                cell.textContent = '更新項目が見つかりません。';
                row.appendChild(cell);
                changeTableBody.appendChild(row);
            } else {
                rows.forEach((row) => {
                    const tr = document.createElement('tr');
                    const proposed = row.proposed;
                    const current = row.current;

                    const tdField = document.createElement('td');
                    tdField.textContent = row.label;

                    const tdProposed = document.createElement('td');
                    tdProposed.textContent = proposed === undefined || proposed === null || proposed === ''
                        ? '—'
                        : proposed;

                    const tdCurrent = document.createElement('td');
                    tdCurrent.textContent = current === undefined || current === null || current === ''
                        ? '—'
                        : current;

                    tr.append(tdField, tdProposed, tdCurrent);
                    changeTableBody.appendChild(tr);
                });
            }

            const lat = typeof submission.proposed_changes.latitude === 'number'
                ? submission.proposed_changes.latitude
                : (typeof currentValues.latitude === 'number' ? currentValues.latitude : null);
            const lon = typeof submission.proposed_changes.longitude === 'number'
                ? submission.proposed_changes.longitude
                : (typeof currentValues.longitude === 'number' ? currentValues.longitude : null);
            updateMap(lat, lon);
        }

        function renderList() {
            pendingList.innerHTML = '';
            if (!submissions.length) {
                const empty = document.createElement('p');
                empty.className = 'form-helper';
                empty.textContent = '現在審査待ちの申請はありません。';
                pendingList.appendChild(empty);
                clearSelection();
                return;
            }

            submissions.forEach((submission) => {
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.dataset.id = submission.id;
                const title = document.createElement('h4');
                title.textContent = submission.change_type === 'new'
                    ? `新規追加: ${submission.proposed_changes.name || '名称未入力'}`
                    : `店舗更新: ${submission.proposed_changes.name || `ID ${submission.shop_id}`}`;
                const subtitle = document.createElement('span');
                subtitle.textContent = `申請者: ${submission.proposer.username} ・ ${formatDate(submission.created_at)}`;
                item.append(title, subtitle);
                item.tabIndex = 0;
                item.addEventListener('click', () => renderDetail(submission));
                item.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter') {
                        renderDetail(submission);
                    }
                });
                pendingList.appendChild(item);
            });
        }

        async function loadPending() {
            setFeedback(feedbackNode, '申請を取得しています…', 'success');
            try {
                const result = await API.request('/api/v1/ramen/submissions/pending');
                submissions = Array.isArray(result) ? result : [];
                setFeedback(feedbackNode, submissions.length ? '' : '審査待ちの申請はありません。', submissions.length ? null : 'success');
                renderList();
            } catch (error) {
                console.error(error);
                const message = error.message || '申請一覧を取得できませんでした。';
                if (message.includes('管理者権限')) {
                    setFeedback(feedbackNode, 'このページにアクセスするには管理者権限が必要です。', 'error');
                    [approveButton, rejectButton, commentInput].forEach((node) => node && node.setAttribute('disabled', 'disabled'));
                } else {
                    setFeedback(feedbackNode, message, 'error');
                }
                pendingList.innerHTML = '';
                clearSelection();
            }
        }

        async function handleReview(action) {
            if (!activeSubmissionId) {
                setFeedback(feedbackNode, '先に審査する申請を選択してください。', 'error');
                return;
            }
            const endpoint = `/api/v1/ramen/submissions/${activeSubmissionId}/${action}`;
            const body = { comment: commentInput.value.trim() || undefined };
            const button = action === 'approve' ? approveButton : rejectButton;
            button.setAttribute('disabled', 'disabled');
            setFeedback(feedbackNode, `${action === 'approve' ? '承認' : '差し戻し'}を処理しています…`, 'success');
            try {
                await API.request(endpoint, {
                    method: 'POST',
                    body,
                });
                setFeedback(feedbackNode, action === 'approve' ? '申請を承認しました。' : '申請を差し戻しました。', 'success');
                commentInput.value = '';
                await loadPending();
            } catch (error) {
                console.error(error);
                setFeedback(feedbackNode, error.message || '処理に失敗しました。', 'error');
            } finally {
                button.removeAttribute('disabled');
            }
        }

        if (approveButton) {
            approveButton.addEventListener('click', () => handleReview('approve'));
        }
        if (rejectButton) {
            rejectButton.addEventListener('click', () => handleReview('reject'));
        }

        loadPending();
    });
})();
