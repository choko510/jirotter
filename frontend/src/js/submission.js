(function () {
    const TOKYO_CENTER = [35.681236, 139.767125];

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '-';
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    function toggleElement(el, shouldShow) {
        if (!el) return;
        if (shouldShow) {
            el.removeAttribute('hidden');
        } else {
            el.setAttribute('hidden', 'hidden');
        }
    }

    function setFeedback(message, type, node) {
        if (!node) return;
        if (!message) {
            node.textContent = '';
            node.classList.remove('success', 'error');
            toggleElement(node, false);
            return;
        }
        node.textContent = message;
        node.classList.remove('success', 'error');
        if (type) {
            node.classList.add(type);
        }
        toggleElement(node, true);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('submission-form');
        const feedback = document.getElementById('form-feedback');
        const historyContainer = document.getElementById('submission-history');
        const historyTemplate = document.getElementById('history-item-template');
        const authWarning = document.getElementById('auth-warning');
        const changeTypeInputs = Array.from(document.querySelectorAll('input[name="change_type"]'));
        const existingShopTools = document.getElementById('existing-shop-tools');
        const shopSearchInput = document.getElementById('shop-search');
        const shopSearchButton = document.getElementById('shop-search-btn');
        const searchResultsContainer = document.getElementById('search-results');
        const shopIdInput = document.getElementById('shop-id');
        const nameInput = document.getElementById('shop-name');
        const addressInput = document.getElementById('shop-address');
        const hoursInput = document.getElementById('shop-hours');
        const closedInput = document.getElementById('shop-closed');
        const seatsInput = document.getElementById('shop-seats');
        const latInput = document.getElementById('shop-lat');
        const lonInput = document.getElementById('shop-lon');
        const noteInput = document.getElementById('shop-note');
        const locateButton = document.getElementById('locate-me');
        const currentLatText = document.getElementById('current-lat');
        const currentLonText = document.getElementById('current-lon');

        const isLoggedIn = !!API.getCookie('authToken');
        if (!isLoggedIn) {
            toggleElement(authWarning, true);
            if (form) {
                Array.from(form.elements).forEach((el) => {
                    el.setAttribute('disabled', 'disabled');
                });
            }
        }

        const map = L.map('submission-map', { preferCanvas: true }).setView(TOKYO_CENTER, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        let marker = null;
        function updateMarker(lat, lon) {
            if (Number.isNaN(lat) || Number.isNaN(lon)) return;
            if (!marker) {
                marker = L.marker([lat, lon], { draggable: true }).addTo(map);
                marker.on('dragend', () => {
                    const position = marker.getLatLng();
                    latInput.value = position.lat.toFixed(6);
                    lonInput.value = position.lng.toFixed(6);
                    currentLatText.textContent = position.lat.toFixed(6);
                    currentLonText.textContent = position.lng.toFixed(6);
                });
            } else {
                marker.setLatLng([lat, lon]);
            }
            map.flyTo([lat, lon], 16, { duration: 0.4 });
            latInput.value = lat.toFixed(6);
            lonInput.value = lon.toFixed(6);
            currentLatText.textContent = lat.toFixed(6);
            currentLonText.textContent = lon.toFixed(6);
        }

        map.on('click', (event) => {
            updateMarker(event.latlng.lat, event.latlng.lng);
        });

        if (locateButton) {
            locateButton.addEventListener('click', async () => {
                if (!navigator.geolocation) {
                    setFeedback('ブラウザが位置情報取得に対応していません。', 'error', feedback);
                    return;
                }
                setFeedback('現在地を取得しています…', 'success', feedback);
                navigator.geolocation.getCurrentPosition((position) => {
                    const { latitude, longitude } = position.coords;
                    updateMarker(latitude, longitude);
                    setFeedback('現在地をセットしました。', 'success', feedback);
                }, (error) => {
                    console.error(error);
                    setFeedback('現在地を取得できませんでした。位置情報の権限をご確認ください。', 'error', feedback);
                }, { enableHighAccuracy: true, timeout: 10000 });
            });
        }

        function setRequiredFields(changeType) {
            const shouldRequire = changeType === 'new';
            [nameInput, addressInput, latInput, lonInput].forEach((input) => {
                if (!input) return;
                if (shouldRequire) {
                    input.setAttribute('required', 'required');
                } else {
                    input.removeAttribute('required');
                }
            });
        }

        function getSelectedChangeType() {
            const selected = changeTypeInputs.find((input) => input.checked);
            return selected ? selected.value : 'update';
        }

        function switchMode(changeType) {
            setRequiredFields(changeType);
            toggleElement(existingShopTools, changeType !== 'new');
            if (changeType === 'new') {
                searchResultsContainer.innerHTML = '';
                shopIdInput.value = '';
            }
        }

        changeTypeInputs.forEach((input) => {
            input.addEventListener('change', () => {
                const mode = getSelectedChangeType();
                switchMode(mode);
            });
        });

        switchMode(getSelectedChangeType());

        async function searchShops() {
            const keyword = shopSearchInput.value.trim();
            if (!keyword) {
                setFeedback('検索キーワードを入力してください。', 'error', feedback);
                return;
            }
            try {
                setFeedback('検索しています…', 'success', feedback);
                const result = await API.request(`/api/v1/ramen?keyword=${encodeURIComponent(keyword)}`, {
                    includeAuth: false,
                });
                setFeedback('', null, feedback);
                searchResultsContainer.innerHTML = '';
                if (!result || !Array.isArray(result.shops) || result.shops.length === 0) {
                    const emptyState = document.createElement('div');
                    emptyState.className = 'search-result-item';
                    emptyState.textContent = '該当する店舗が見つかりませんでした。';
                    searchResultsContainer.appendChild(emptyState);
                    return;
                }

                result.shops.slice(0, 20).forEach((shop) => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.tabIndex = 0;
                    item.innerHTML = `<strong>${API.escapeHtml(shop.name)}</strong><span>${API.escapeHtml(shop.address || '')}</span>`;
                    item.addEventListener('click', () => {
                        selectShop(shop);
                    });
                    item.addEventListener('keypress', (event) => {
                        if (event.key === 'Enter') {
                            selectShop(shop);
                        }
                    });
                    searchResultsContainer.appendChild(item);
                });
            } catch (error) {
                console.error(error);
                setFeedback(error.message || '検索に失敗しました。', 'error', feedback);
            }
        }

        async function fetchHistory() {
            if (!isLoggedIn) return;
            try {
                const submissions = await API.request('/api/v1/ramen/submissions/me');
                historyContainer.innerHTML = '';
                if (!submissions || submissions.length === 0) {
                    const placeholder = document.createElement('p');
                    placeholder.className = 'form-helper';
                    placeholder.textContent = 'まだ申請履歴はありません。最初の提案を送ってみましょう！';
                    historyContainer.appendChild(placeholder);
                    return;
                }

                const statusMap = {
                    pending: { label: '審査中', className: 'status-pending' },
                    approved: { label: '承認済み', className: 'status-approved' },
                    rejected: { label: '差し戻し', className: 'status-rejected' },
                };

                submissions.forEach((submission) => {
                    const clone = historyTemplate.content.cloneNode(true);
                    clone.querySelector('.history-title').textContent = submission.change_type === 'new'
                        ? `新規追加: ${submission.proposed_changes.name || '店舗名未設定'}`
                        : `更新: ${submission.proposed_changes.name || '対象店舗ID ' + (submission.shop_id ?? '-')}`;
                    const statusNode = clone.querySelector('.history-status');
                    const statusInfo = statusMap[submission.status] || statusMap.pending;
                    statusNode.textContent = statusInfo.label;
                    statusNode.classList.add(statusInfo.className);
                    clone.querySelector('.history-note').textContent = submission.note || '補足なし';
                    clone.querySelector('.history-created').textContent = formatDate(submission.created_at);

                    if (submission.reviewed_at) {
                        const reviewWrapper = clone.querySelectorAll('.history-review');
                        reviewWrapper.forEach((node) => node.removeAttribute('hidden'));
                        clone.querySelector('.history-reviewed').textContent = formatDate(submission.reviewed_at);
                        clone.querySelector('.history-comment').textContent = submission.review_comment || 'コメントなし';
                    }

                    historyContainer.appendChild(clone);
                });
            } catch (error) {
                console.error(error);
                const fail = document.createElement('p');
                fail.className = 'form-helper';
                fail.textContent = '申請履歴の取得に失敗しました。時間をおいて再度お試しください。';
                historyContainer.innerHTML = '';
                historyContainer.appendChild(fail);
            }
        }

        function selectShop(shop) {
            changeTypeInputs.forEach((input) => {
                if (input.value === 'update') {
                    input.checked = true;
                }
            });
            switchMode('update');

            shopIdInput.value = shop.id;
            nameInput.value = shop.name || '';
            addressInput.value = shop.address || '';
            hoursInput.value = shop.business_hours || '';
            closedInput.value = shop.closed_day || '';
            seatsInput.value = shop.seats || '';
            latInput.value = (shop.latitude ?? '').toString();
            lonInput.value = (shop.longitude ?? '').toString();

            if (typeof shop.latitude === 'number' && typeof shop.longitude === 'number') {
                updateMarker(shop.latitude, shop.longitude);
            }
        }

        if (shopSearchButton) {
            shopSearchButton.addEventListener('click', searchShops);
        }
        if (shopSearchInput) {
            shopSearchInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    searchShops();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!isLoggedIn) {
                    setFeedback('ログイン後に申請を送信できます。', 'error', feedback);
                    return;
                }

                const changeType = getSelectedChangeType();
                const payload = {
                    change_type: changeType,
                    note: noteInput.value.trim() || undefined,
                };

                if (changeType === 'update') {
                    if (!shopIdInput.value) {
                        setFeedback('更新する店舗を検索して選択してください。', 'error', feedback);
                        return;
                    }
                    payload.shop_id = Number(shopIdInput.value);
                }

                const fields = {
                    name: nameInput.value.trim(),
                    address: addressInput.value.trim(),
                    business_hours: hoursInput.value.trim(),
                    closed_day: closedInput.value.trim(),
                    seats: seatsInput.value.trim(),
                    latitude: latInput.value ? parseFloat(latInput.value) : undefined,
                    longitude: lonInput.value ? parseFloat(lonInput.value) : undefined,
                };

                if (changeType === 'new') {
                    if (!fields.name || !fields.address || Number.isNaN(fields.latitude) || Number.isNaN(fields.longitude)) {
                        setFeedback('新しい店舗を追加するには店舗名・住所・緯度・経度を入力してください。', 'error', feedback);
                        return;
                    }
                }

                Object.entries(fields).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== '' && !Number.isNaN(value)) {
                        payload[key] = value;
                    }
                });

                const changeKeys = Object.keys(payload).filter((key) => !['change_type', 'shop_id', 'note'].includes(key));
                if (changeType === 'update' && changeKeys.length === 0) {
                    setFeedback('更新する項目を1つ以上入力してください。', 'error', feedback);
                    return;
                }

                try {
                    setFeedback('申請を送信しています…', 'success', feedback);
                    await API.request('/api/v1/ramen/submissions', {
                        method: 'POST',
                        body: payload,
                    });
                    setFeedback('申請を受け付けました。審査完了までお待ちください。', 'success', feedback);
                    form.reset();
                    shopIdInput.value = '';
                    toggleElement(existingShopTools, true);
                    changeTypeInputs.forEach((input) => {
                        input.checked = input.value === 'update';
                    });
                    setRequiredFields('update');
                    searchResultsContainer.innerHTML = '';
                    noteInput.value = '';
                    fetchHistory();
                } catch (error) {
                    console.error(error);
                    setFeedback(error.message || '申請の送信に失敗しました。', 'error', feedback);
                }
            });
        }

        fetchHistory();
    });
})();
