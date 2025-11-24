// チェックイン機能コンポーネント
const CheckinComponent = {
    // 状態管理
    state: {
        currentPosition: null,
        nearbyShops: [],
        selectedShop: null,
        isCheckingIn: false,
        checkinMethod: null, // 'gps', 'manual', 'exif'
        showWaitTimeSurvey: false,
        checkinData: null
    },

    // 初期化
    init() {
        this.bindEvents();
    },

    // イベントバインド
    bindEvents() {
        // ドキュメント全体のイベントリスナー
        document.addEventListener('click', (e) => {
            const checkinButton = e.target.closest('.checkin-btn');
            if (checkinButton) {
                this.handleCheckinButtonClick(checkinButton);
            }
            if (e.target.classList.contains('checkin-modal-close')) {
                this.closeCheckinModal();
            }
            if (e.target.classList.contains('waittime-survey-submit')) {
                this.submitWaitTimeSurvey(e.target);
            }
            if (e.target.classList.contains('waittime-survey-skip')) {
                this.skipWaitTimeSurvey();
            }
        });
    },

    // GPS位置情報を取得
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('お使いのブラウザは位置情報をサポートしていません'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5分
                }
            );
        });
    },

    // 近隣店舗を検索
    async findNearbyShops(latitude, longitude, radiusKm = 0.5) {
        try {
            return await API.request('/api/v1/checkin/nearby', {
                method: 'POST',
                body: {
                    latitude,
                    longitude,
                    radius_km: radiusKm,
                    include_ip_location: false
                }
            });
        } catch (error) {
            console.error('近隣店舗検索エラー:', error);
            throw error;
        }
    },

    // IPベースの位置情報で近隣店舗を検索
    async findNearbyShopsByIP() {
        try {
            return await API.request('/api/v1/checkin/nearby', {
                method: 'POST',
                body: {
                    include_ip_location: true
                }
            });
        } catch (error) {
            console.error('IPベース店舗検索エラー:', error);
            throw error;
        }
    },

    // GPSベースのチェックインを試行
    async tryGPSCheckin() {
        try {
            this.state.isCheckingIn = true;
            this.showCheckinLoading('位置情報を取得中...');

            // GPS位置情報を取得
            const position = await this.getCurrentPosition();
            this.state.currentPosition = position;

            // 近隣店舗を検索
            const nearbyData = await this.findNearbyShops(
                position.latitude,
                position.longitude
            );

            this.state.nearbyShops = nearbyData.shops;
            this.state.checkinMethod = 'gps';

            if (nearbyData.can_checkin && nearbyData.shops.length > 0) {
                // 最寄りの店舗順に表示
                this.showNearbyShopsSelection(nearbyData.shops, position);
            } else {
                this.showNoNearbyShops();
            }
        } catch (error) {
            console.error('GPSチェックインエラー:', error);
            this.showCheckinError('GPSチェックインに失敗しました: ' + error.message);
        } finally {
            this.state.isCheckingIn = false;
        }
    },

    // 手動チェックイン（店舗選択）
    async tryManualCheckin(shopId) {
        try {
            this.state.isCheckingIn = true;
            this.showCheckinLoading('チェックイン処理中...');

            // 店舗情報を取得
            const shopResponse = await API.getShopDetail(shopId);
            if (!shopResponse.success) {
                throw new Error('店舗情報の取得に失敗しました');
            }

            const shop = shopResponse.shop;
            this.state.selectedShop = shop;
            this.state.checkinMethod = 'manual';

            // 手動チェックインの場合は位置情報検証なしで直接確認
            this.showCheckinConfirmation(shop);
        } catch (error) {
            console.error('手動チェックインエラー:', error);
            this.showCheckinError('チェックインに失敗しました: ' + error.message);
        } finally {
            this.state.isCheckingIn = false;
        }
    },

    // 写真からEXIFデータを抽出してチェックイン
    async tryExifCheckin(imageFile, shopId) {
        try {
            this.state.isCheckingIn = true;
            this.showCheckinLoading('写真の位置情報を解析中...');

            // EXIFデータを抽出
            const exifData = await this.extractExifData(imageFile);

            let position = null;
            if (exifData && exifData.GPSLatitude && exifData.GPSLongitude) {
                position = {
                    latitude: exifData.GPSLatitude,
                    longitude: exifData.GPSLongitude,
                    accuracy: 10 // EXIFからの位置情報は高精度と仮定
                };
            }

            // 店舗情報を取得
            const shopResponse = await API.getShopDetail(shopId);
            if (!shopResponse.success) {
                throw new Error('店舗情報の取得に失敗しました');
            }

            const shop = shopResponse.shop;
            this.state.selectedShop = shop;
            this.state.checkinMethod = position ? 'exif' : 'manual';

            this.showCheckinConfirmation(shop, position, exifData);
        } catch (error) {
            console.error('EXIFチェックインエラー:', error);
            this.showCheckinError('写真からのチェックインに失敗しました: ' + error.message);
        } finally {
            this.state.isCheckingIn = false;
        }
    },

    // EXIFデータを抽出
    async extractExifData(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageFile);

            img.onload = () => {
                // 実際のEXIF抽出にはexif-jsなどのライブラリが必要
                // ここは簡易的な実装
                URL.revokeObjectURL(url);

                // ダミーのEXIFデータを返す（実際にはライブラリを使用）
                // 実装例：https://github.com/exif-js/exif-js
                resolve({
                    GPSLatitude: null, // 実際にはライブラリから取得
                    GPSLongitude: null,
                    DateTimeOriginal: null,
                    Make: null,
                    Model: null
                });
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('画像の読み込みに失敗しました'));
            };

            img.src = url;
        });
    },

    // 近隣店舗選択画面を表示
    showNearbyShopsSelection(shops, position) {
        const modal = document.createElement('div');
        modal.className = 'checkin-modal-overlay';

        const shopsListHtml = shops.map(shop => `
            <div class="checkin-shop-item" onclick="CheckinComponent.handleShopSelection(${shop.id})">
                <div class="shop-name">${API.escapeHtml(shop.name)}</div>
                <div class="shop-distance">現在地から約${shop.distance.toFixed(2)}km</div>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="checkin-modal">
                <div class="checkin-modal-header">
                    <h3>チェックインする店舗を選択</h3>
                    <button class="checkin-modal-close">&times;</button>
                </div>
                <div class="checkin-modal-content">
                    <div class="checkin-shops-list">
                        ${shopsListHtml}
                    </div>
                    <div class="checkin-actions">
                        <button class="checkin-manual-btn" onclick="CheckinComponent.openManualSearch()">
                            その他の店舗を検索
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 店舗リストを保存（IDから検索用）
        this.state.nearbyShops = shops;
    },

    // 店舗選択時の処理
    handleShopSelection(shopId) {
        const shop = this.state.nearbyShops.find(s => s.id === shopId);
        if (shop) {
            this.closeCheckinModal();
            // GPS位置情報を持って確認画面へ
            this.showCheckinConfirmation(shop, this.state.currentPosition);
        }
    },

    // 手動検索を開く
    openManualSearch() {
        this.closeCheckinModal();
        if (window.SearchComponent) {
            SearchComponent.openModal((shop) => {
                this.tryManualCheckin(shop.id);
            });
        }
    },

    // チェックイン確認画面を表示
    showCheckinConfirmation(shop, position = null, exifData = null) {
        const modal = document.createElement('div');
        modal.className = 'checkin-modal-overlay';
        modal.innerHTML = `
            <div class="checkin-modal">
                <div class="checkin-modal-header">
                    <h3>チェックイン確認</h3>
                    <button class="checkin-modal-close">&times;</button>
                </div>
                <div class="checkin-modal-content">
                    <div class="checkin-shop-info">
                        <h4>${API.escapeHtml(shop.name)}</h4>
                        <p>${API.escapeHtml(shop.address)}</p>
                    </div>
                    
                    ${position ? `
                    <div class="checkin-location-info">
                        <p><strong>位置情報:</strong> 緯度 ${position.latitude.toFixed(6)}, 経度 ${position.longitude.toFixed(6)}</p>
                        <p><strong>精度:</strong> 約 ${position.accuracy}m</p>
                    </div>
                    ` : ''}
                    
                    <div class="checkin-method-info">
                        <p><strong>チェックイン方法:</strong> ${this.getCheckinMethodText()}</p>
                    </div>
                    
                    <div class="checkin-actions">
                        <button class="checkin-confirm-btn" onclick="CheckinComponent.executeCheckin(${shop.id}, ${position ? JSON.stringify(position) : 'null'}, ${exifData ? JSON.stringify(exifData) : 'null'})">
                            チェックインする
                        </button>
                        <button class="checkin-cancel-btn" onclick="CheckinComponent.closeCheckinModal()">
                            キャンセル
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    // チェックイン実行
    async executeCheckin(shopId, position, exifData) {
        try {
            this.state.isCheckingIn = true;
            this.closeCheckinModal();
            this.showCheckinLoading('チェックイン中...');

            // デバイス情報を取得
            const deviceInfo = this.getDeviceInfo();

            // 位置情報ソースをサーバーが期待する値に変換
            let locationSource = this.state.checkinMethod;
            if (locationSource === 'manual') {
                locationSource = 'gps'; // 手動選択の場合もgpsとして扱う
            }

            // チェックインデータを作成
            const checkinData = {
                shop_id: shopId,
                latitude: position ? position.latitude : null,
                longitude: position ? position.longitude : null,
                location_source: locationSource,
                location_accuracy: position ? position.accuracy : null,
                checkin_date: new Date().toISOString(), // 現在の日時をISO形式で追加
                user_agent: deviceInfo.userAgent,
                device_type: deviceInfo.deviceType,
                is_mobile_network: deviceInfo.isMobileNetwork,
                metadata: {
                    exif: exifData,
                    checkin_method: this.state.checkinMethod
                }
            };

            // チェックインAPIを呼び出し
            const checkinResult = await API.request('/api/v1/checkin', {
                method: 'POST',
                body: checkinData
            });
            this.state.checkinData = checkinResult;

            // チェックイン成功
            this.showCheckinSuccess(checkinResult);

            // 待ち時間アンケートを表示
            this.showWaitTimeSurvey(shopId);

        } catch (error) {
            console.error('チェックイン実行エラー:', error);
            this.showCheckinError('チェックインに失敗しました: ' + error.message);
        } finally {
            this.state.isCheckingIn = false;
        }
    },

    // 待ち時間アンケートを表示
    showWaitTimeSurvey(shopId) {
        const modal = document.createElement('div');
        modal.className = 'checkin-modal-overlay waittime-survey-modal';
        modal.innerHTML = `
            <div class="checkin-modal">
                <div class="checkin-modal-header">
                    <h3>待ち時間を教えてください</h3>
                    <button class="checkin-modal-close">&times;</button>
                </div>
                <div class="checkin-modal-content">
                    <div class="waittime-survey">
                        <div class="waittime-question">
                            <label for="waittime-input">現在の待ち時間は何分ですか？</label>
                            <div class="waittime-input-group">
                                <input type="number" id="waittime-input" min="0" max="300" placeholder="0">
                                <span>分</span>
                            </div>
                        </div>
                        
                        <div class="waittime-confidence">
                            <label>この待ち時間の確実さは？</label>
                            <div class="confidence-options">
                                <label><input type="radio" name="confidence" value="1"> 不確か</label>
                                <label><input type="radio" name="confidence" value="2" checked> まあまあ</label>
                                <label><input type="radio" name="confidence" value="3"> 普通</label>
                                <label><input type="radio" name="confidence" value="4"> 確実</label>
                                <label><input type="radio" name="confidence" value="5"> とても確実</label>
                            </div>
                        </div>
                        
                        <div class="waittime-actions">
                            <button class="waittime-survey-submit" data-shop-id="${shopId}">
                                送信する
                            </button>
                            <button class="waittime-survey-skip">
                                スキップ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.state.showWaitTimeSurvey = true;
    },

    // 待ち時間アンケートを送信
    async submitWaitTimeSurvey(button) {
        try {
            const shopId = button.dataset.shopId;
            const waitTimeInput = document.getElementById('waittime-input');
            const confidenceInput = document.querySelector('input[name="confidence"]:checked');

            const waitTime = parseInt(waitTimeInput.value) || 0;
            const confidence = parseInt(confidenceInput.value);

            if (waitTime < 0 || waitTime > 300) {
                alert('待ち時間は0分から300分の間で入力してください');
                return;
            }

            await API.request('/api/v1/waittime/report', {
                method: 'POST',
                body: {
                    shop_id: parseInt(shopId),
                    wait_time: waitTime,
                    confidence: confidence,
                    checkin_id: this.state.checkinData ? this.state.checkinData.id : null
                }
            });
            Utils.showNotification('待ち時間を報告しました', 'success');
            this.closeWaitTimeSurvey();

        } catch (error) {
            console.error('待ち時間送信エラー:', error);
            Utils.showNotification('待ち時間の送信に失敗しました', 'error');
        }
    },

    // 待ち時間アンケートをスキップ
    skipWaitTimeSurvey() {
        this.closeWaitTimeSurvey();
    },

    // 待ち時間アンケートを閉じる
    closeWaitTimeSurvey() {
        const modal = document.querySelector('.waittime-survey-modal');
        if (modal) {
            modal.remove();
        }
        this.state.showWaitTimeSurvey = false;
    },

    // デバイス情報を取得
    getDeviceInfo() {
        const userAgent = navigator.userAgent;

        // ユーザーエージェント文字列からデバイスタイプを判定
        let deviceType = 'desktop';
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
            deviceType = 'mobile';
        } else if (/Tablet|iPad|(android(?!.*Mobile))|Silk-Accelerated/.test(userAgent)) {
            deviceType = 'tablet';
        }

        return {
            userAgent: userAgent,
            deviceType: deviceType,
            isMobileNetwork: this.isMobileNetwork()
        };
    },

    // モバイルネットワークかどうかを判定
    isMobileNetwork() {
        // 簡易的な実装
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            return connection.type === 'cellular';
        }
        return false;
    },

    // チェックイン方法のテキストを取得
    getCheckinMethodText() {
        switch (this.state.checkinMethod) {
            case 'gps':
                return 'GPS位置情報';
            case 'ip':
                return 'IP位置情報';
            case 'exif':
                return '写真の位置情報';
            case 'manual':
                return '手動選択';
            default:
                return '不明';
        }
    },

    // チェックインボタンのクリックを処理
    async handleCheckinButtonClick(button) {
        const shopId = button.dataset.shopId;
        const checkinType = button.dataset.checkinType;

        if (!API.getCookie('authToken')) {
            alert('チェックインするにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        switch (checkinType) {
            case 'gps':
                await this.tryGPSCheckin();
                break;
            case 'ip':
                await this.tryIPBasedCheckin();
                break;
            case 'manual':
                if (shopId) {
                    await this.tryManualCheckin(parseInt(shopId));
                }
                break;
            case 'exif':
                // EXIFチェックインは画像選択が必要
                this.selectImageForExifCheckin(shopId);
                break;
            default:
                await this.tryGPSCheckin();
        }
    },

    // EXIFチェックイン用の画像を選択
    selectImageForExifCheckin(shopId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.tryExifCheckin(file, parseInt(shopId));
            }
        };
        input.click();
    },

    // チェックインローディング表示
    showCheckinLoading(message = '処理中...') {
        const existingModal = document.querySelector('.checkin-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'checkin-modal-overlay';
        modal.innerHTML = `
            <div class="checkin-modal">
                <div class="checkin-loading">
                    <div class="checkin-spinner"></div>
                    <p>${message}</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    // チェックイン成功表示
    showCheckinSuccess(checkinData) {
        // ローディングモーダルを閉じる
        const loadingModal = document.querySelector('.checkin-modal-overlay');
        if (loadingModal) {
            loadingModal.remove();
        }

        Utils.showNotification(`${checkinData.shop_name}にチェックインしました！`, 'success');

        // スタンプラリー画面表示中であれば、その場で内容を更新する
        try {
            const activeView = document.querySelector('.view-switch-btn.active');
            if (activeView && activeView.dataset.view === 'list') {
                // チェックイン済みリストを再取得してStampRallyComponentの状態を更新
                if (window.StampRallyComponent && typeof StampRallyComponent.loadCheckins === 'function') {
                    StampRallyComponent.loadCheckins()
                        .then(checkins => {
                            StampRallyComponent.state.checkins = checkins || [];
                            // UIを再描画（stampRallyContentのみ）
                            StampRallyComponent.updateUI();
                        })
                        .catch(err => {
                            console.error('スタンプラリー更新エラー:', err);
                        });
                }
            }
        } catch (e) {
            console.error('スタンプラリーUI更新処理でエラーが発生しました:', e);
        }
    },

    // チェックインエラー表示
    showCheckinError(message) {
        // ローディングモーダルを閉じる
        const loadingModal = document.querySelector('.checkin-modal-overlay');
        if (loadingModal) {
            loadingModal.remove();
        }

        // エラーモーダルを表示
        const modal = document.createElement('div');
        modal.className = 'checkin-modal-overlay';
        modal.innerHTML = `
            <div class="checkin-modal">
                <div class="checkin-modal-header">
                    <h3>エラー</h3>
                    <button class="checkin-modal-close">&times;</button>
                </div>
                <div class="checkin-modal-content">
                    <div class="checkin-error">
                        <p>${message}</p>
                    </div>
                    <div class="checkin-actions">
                        <button class="checkin-cancel-btn" onclick="CheckinComponent.closeCheckinModal()">
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    // 近隣店舗がない場合の表示
    showNoNearbyShops() {
        Utils.showNotification('近くに店舗が見つかりませんでした。店舗を検索してください。', 'info');
        if (window.SearchComponent) {
            SearchComponent.openModal((shop) => {
                this.tryManualCheckin(shop.id);
            });
        }
    },

    // チェックインモーダルを閉じる
    closeCheckinModal() {
        const modal = document.querySelector('.checkin-modal-overlay');
        if (modal) {
            modal.remove();
        }
    },

    // タイムラインでのチェックイン通知を表示
    showTimelineCheckinNotification(nearbyShops) {
        if (nearbyShops.length === 0) return;

        const notification = document.createElement('div');
        notification.className = 'checkin-notification';
        notification.innerHTML = `
            <div class="checkin-notification-content">
                <div class="checkin-notification-icon">
                    <i class="fas fa-map-marker-alt"></i>
                </div>
                <div class="checkin-notification-text">
                    <p><strong>${nearbyShops[0].name}</strong>が近くにあります</p>
                    <p>チェックインしますか？</p>
                </div>
                <div class="checkin-notification-actions">
                    <button class="checkin-notification-yes" data-shop-id="${nearbyShops[0].id}">
                        はい
                    </button>
                    <button class="checkin-notification-no">
                        いいえ
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // イベントリスナーを設定
        notification.querySelector('.checkin-notification-yes').addEventListener('click', () => {
            this.tryManualCheckin(nearbyShops[0].id);
            notification.remove();
        });

        notification.querySelector('.checkin-notification-no').addEventListener('click', () => {
            notification.remove();
        });

        // 自動的に非表示
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }
};

// グローバルに公開
window.CheckinComponent = CheckinComponent;

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    CheckinComponent.init();
});