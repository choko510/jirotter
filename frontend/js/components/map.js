// MAPコンポーネント
const MapComponent = {
    // 状態管理
    state: {
        map: null,
        markers: [],
        userLocation: null,
        isLoading: false
    },

    // 初期化
    init() {
        // 初期化処理はrender内で行う
    },

    // レンダリング
    async render(params = []) {
        const contentArea = document.getElementById('contentArea');
        
        contentArea.innerHTML = `
            <style>
                .map-container {
                    padding: 0;
                    height: calc(100vh - 60px);
                    display: flex;
                    flex-direction: column;
                }
                
                .map-header {
                    padding: 16px;
                    background: white;
                    border-bottom: 1px solid #e0e0e0;
                    z-index: 1000;
                    position: relative;
                }
                
                .map-title {
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .map-subtitle {
                    color: #666;
                    font-size: 14px;
                }
                
                .map-controls {
                    display: flex;
                    gap: 12px;
                    margin-top: 12px;
                }
                
                .map-search {
                    flex: 1;
                    position: relative;
                }
                
                .map-search-input {
                    width: 100%;
                    padding: 8px 36px 8px 12px;
                    border: 1px solid #e0e0e0;
                    border-radius: 20px;
                    font-size: 14px;
                    outline: none;
                    background: #f5f5f5;
                }
                
                .map-search-input:focus {
                    border-color: #d4a574;
                    background: white;
                }
                
                .map-search-btn {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: transparent;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    padding: 4px;
                }
                
                .map-filter-btn {
                    padding: 8px 16px;
                    background: #f5f5f5;
                    border: 1px solid #e0e0e0;
                    border-radius: 20px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                
                .map-filter-btn:hover {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: white;
                }
                
                .map-filter-btn.active {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: white;
                }
                
                .map-content {
                    flex: 1;
                    position: relative;
                }
                
                #map {
                    width: 100%;
                    height: 100%;
                }
                
                .map-loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    z-index: 1000;
                }
                
                .map-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #d4a574;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 12px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .map-error {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    z-index: 1000;
                    max-width: 300px;
                }
                
                .map-error h3 {
                    color: #d32f2f;
                    margin-bottom: 8px;
                }
                
                .map-error button {
                    margin-top: 12px;
                    padding: 8px 16px;
                    background: #d4a574;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .map-legend {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    padding: 12px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    z-index: 1000;
                }
                
                .legend-title {
                    font-weight: bold;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                    font-size: 12px;
                }
                
                .marker-icon {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                }
                
                @media (max-width: 768px) {
                    .map-container {
                        height: calc(100vh - 120px);
                    }
                    
                    .map-header {
                        padding: 12px 16px;
                    }
                    
                    .map-title {
                        font-size: 18px;
                    }
                    
                    .map-controls {
                        flex-direction: column;
                        gap: 8px;
                    }
                    
                    .map-legend {
                        bottom: 10px;
                        right: 10px;
                        padding: 8px;
                    }
                }
            </style>
            
            <div class="map-container">
                <div class="map-header">
                    <h1 class="map-title">
                        <i class="fas fa-map-marked-alt"></i>
                        店舗マップ
                    </h1>
                    <p class="map-subtitle">近くのラーメン店を地図で探す</p>
                    
                    <div class="map-controls">
                        <div class="map-search">
                            <input type="text" class="map-search-input" placeholder="店名や住所で検索..." id="mapSearchInput">
                            <button class="map-search-btn" onclick="MapComponent.searchLocation()">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                        <button class="map-filter-btn" onclick="MapComponent.toggleFilter('jiro')">二郎系</button>
                        <button class="map-filter-btn" onclick="MapComponent.toggleFilter('ie')">家系</button>
                        <button class="map-filter-btn" onclick="MapComponent.getCurrentLocation()">
                            <i class="fas fa-location-arrow"></i>
                        </button>
                    </div>
                </div>
                
                <div class="map-content">
                    <div id="map"></div>
                    
                    <div class="map-loading" id="mapLoading" style="display: none;">
                        <div class="map-spinner"></div>
                        <p>読み込み中...</p>
                    </div>
                    
                    <div class="map-error" id="mapError" style="display: none;">
                        <h3>エラー</h3>
                        <p id="mapErrorMessage">マップの読み込みに失敗しました</p>
                        <button onclick="MapComponent.retryLoad()">再試行</button>
                    </div>
                    
                    <div class="map-legend">
                        <div class="legend-title">店舗タイプ</div>
                        <div class="legend-item">
                            <div class="marker-icon" style="background: #d4a574;"></div>
                            <span>二郎系</span>
                        </div>
                        <div class="legend-item">
                            <div class="marker-icon" style="background: #ff9800;"></div>
                            <span>家系</span>
                        </div>
                        <div class="legend-item">
                            <div class="marker-icon" style="background: #4caf50;"></div>
                            <span>醤油系</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // マップを初期化
        await this.initializeMap();
    },

    // マップ初期化
    async initializeMap() {
        try {
            this.showLoading(true);
            
            // IPアドレスから位置情報を取得
            const location = await this.getLocationFromIP();
            
            // マップを作成
            this.state.map = L.map('map').setView([location.lat, location.lng], 13);
            
            L.maplibreGL({
                style: 'https://tiles.openfreemap.org/styles/liberty',
            }).addTo(this.state.map)
            
            // 地図の移動イベントをリッスン
            this.state.map.on('moveend', async () => {
                const center = this.state.map.getCenter();
                await this.addNearbyShops({ lat: center.lat, lng: center.lng });
            });
            
            // 現在位置マーカーを追加
            this.addUserMarker(location);
            
            // 近くのラーメン店データを取得して追加
            await this.addNearbyShops(location);
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('マップの初期化に失敗しました:', error);
            this.showError('マップの初期化に失敗しました: ' + error.message);
        }
    },

    // IPアドレスから位置情報を取得
    async getLocationFromIP() {
        try {
            // ip-api.comを使用してIPアドレスから位置情報を取得
            const response = await fetch('https://ipinfo.io/json');
            
            if (!response.ok) {
                throw new Error('位置情報の取得に失敗しました');
            }
            
            const data = await response.json();
            
            if (data.status !== 'success') {
                throw new Error(data.message || '位置情報の取得に失敗しました');
            }
            
            this.state.userLocation = {
                lat: data.lat,
                lng: data.lon,
                city: data.city,
                country: data.country
            };
            
            return this.state.userLocation;
            
        } catch (error) {
            console.error('IPベースの位置取得に失敗しました:', error);
            
            // デフォルト位置（東京）を返す
            this.state.userLocation = {
                lat: 35.6762,
                lng: 139.6503,
                city: '東京',
                country: '日本'
            };
            
            return this.state.userLocation;
        }
    },

    // ユーザー位置マーカーを追加
    addUserMarker(location) {
        const userIcon = L.divIcon({
            html: '<div style="background: #2196f3; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            className: 'user-marker'
        });
        
        L.marker([location.lat, location.lng], { icon: userIcon })
            .addTo(this.state.map)
            .bindPopup(`<b>現在地</b><br>${location.city}, ${location.country}`);
    },

    // 近くのラーメン店データを取得して追加
    async addNearbyShops(centerLocation) {
        try {
            this.showLoading(true);
            
            // 既存の店舗マーカーをクリア
            this.clearShopMarkers();
            
            // APIから近くのラーメン店を取得（検索半径を10kmに拡大）
            const response = await fetch(`/api/v1/ramen/nearby?latitude=${centerLocation.lat}&longitude=${centerLocation.lng}&radius_km=30`);
            
            if (!response.ok) {
                throw new Error('ラーメン店データの取得に失敗しました');
            }
            
            const data = await response.json();
            
            // 取得した店舗データを地図に追加
            data.shops.forEach(shop => {
                // 店舗タイプを判定（店名に基づく簡易判定）
                let shopType = 'other';
                if (shop.name.includes('二郎') || shop.name.includes('ジロー')) {
                    shopType = 'jiro';
                } else if (shop.name.includes('家系') || shop.name.includes('一蘭')) {
                    shopType = 'ie';
                } else if (shop.name.includes('醤油') || shop.name.includes('しお')) {
                    shopType = 'shoyu';
                }
                
                const shopData = {
                    id: shop.id,
                    name: shop.name,
                    type: shopType,
                    lat: shop.latitude,
                    lng: shop.longitude,
                    address: shop.address,
                    business_hours: shop.business_hours,
                    closed_day: shop.closed_day,
                    seats: shop.seats,
                    distance: shop.distance,
                    description: `${shop.address}<br>営業時間: ${shop.business_hours || '不明'}<br>定休日: ${shop.closed_day || '不明'}<br>距離: 約${shop.distance}km`
                };
                
                this.addShopMarker(shopData);
            });
            
            this.showLoading(false);
            
        } catch (error) {
            console.error('ラーメン店データの取得に失敗しました:', error);
            this.showError('ラーメン店データの取得に失敗しました: ' + error.message);
        }
    },
    
    // 店舗マーカーをクリア
    clearShopMarkers() {
        // 既存の店舗マーカーを地図から削除
        this.state.markers.forEach(marker => {
            this.state.map.removeLayer(marker);
        });
        
        // マーカーリストをクリア
        this.state.markers = [];
    },

    // 店舗マーカーを追加
    addShopMarker(shop) {
        const colors = {
            'jiro': '#d4a574',
            'ie': '#ff9800',
            'shoyu': '#4caf50',
            'other': '#9e9e9e'
        };
        
        // より目立つマーカーアイコンを作成
        const shopIcon = L.divIcon({
            html: `
                <div style="
                    position: relative;
                    width: 30px;
                    height: 30px;
                ">
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 30px;
                        height: 30px;
                        background: ${colors[shop.type]};
                        border-radius: 50% 50% 50% 0;
                        border: 2px solid white;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                        transform: rotate(-45deg);
                    "></div>
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        color: white;
                        font-weight: bold;
                        font-size: 12px;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                    ">ラ</div>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30],
            className: 'shop-marker'
        });
        
        const popupContent = `
            <div style="max-width: 200px;">
                <h3 style="margin: 0 0 8px 0;">${shop.name}</h3>
                <p style="margin: 0 0 8px 0; font-size: 12px;">${shop.description}</p>
                <button onclick="MapComponent.showShopDetails(${shop.id})" style="margin-top: 8px; padding: 4px 8px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">詳細を見る</button>
            </div>
        `;
        
        const marker = L.marker([shop.lat, shop.lng], { icon: shopIcon })
            .addTo(this.state.map)
            .bindPopup(popupContent);
            
        this.state.markers.push(marker);
    },

    // 現在位置を取得
    async getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    this.state.map.setView([lat, lng], 15);
                    this.addUserMarker({ lat, lng, city: '現在地', country: '' });
                    
                    // 現在位置周辺のラーメン店を再取得
                    await this.addNearbyShops({ lat, lng });
                },
                (error) => {
                    console.error('位置情報の取得に失敗しました:', error);
                    this.showError('位置情報の取得に失敗しました');
                }
            );
        } else {
            this.showError('お使いのブラウザは位置情報をサポートしていません');
        }
    },

    // 位置検索
    async searchLocation() {
        const searchInput = document.getElementById('mapSearchInput');
        const query = searchInput.value.trim();
        
        if (!query) return;
        
        try {
            // Nominatim APIを使用して地名検索
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error('検索に失敗しました');
            }
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                
                this.state.map.setView([lat, lng], 15);
                
                // 検索結果にマーカーを追加
                L.marker([lat, lng])
                    .addTo(this.state.map)
                    .bindPopup(`<b>${result.display_name}</b>`)
                    .openPopup();
                
                // 検索位置周辺のラーメン店を再取得
                await this.addNearbyShops({ lat, lng });
            } else {
                this.showError('場所が見つかりませんでした');
            }
        } catch (error) {
            console.error('検索に失敗しました:', error);
            this.showError('検索に失敗しました');
        }
    },

    // フィルター切り替え
    toggleFilter(type) {
        const button = event.target;
        button.classList.toggle('active');
        
        // 実際のフィルター処理はここに実装
        console.log('フィルター切り替え:', type);
    },

    // 店舗詳細表示
    async showShopDetails(shopId) {
        try {
            // APIから店舗詳細を取得
            const response = await fetch(`/api/v1/ramen`);
            
            if (!response.ok) {
                throw new Error('店舗詳細の取得に失敗しました');
            }
            
            const data = await response.json();
            const shop = data.shops.find(s => s.id === shopId);
            
            if (!shop) {
                throw new Error('店舗が見つかりませんでした');
            }
            
            // 店舗詳細情報を表示
            const details = `
                店名: ${shop.name}
                住所: ${shop.address}
                営業時間: ${shop.business_hours || '不明'}
                定休日: ${shop.closed_day || '不明'}
                座席数: ${shop.seats || '不明'}
            `;
            
            alert(details);
            
        } catch (error) {
            console.error('店舗詳細の取得に失敗しました:', error);
            alert('店舗詳細の取得に失敗しました: ' + error.message);
        }
    },

    // ローディング表示
    showLoading(show) {
        const loadingElement = document.getElementById('mapLoading');
        loadingElement.style.display = show ? 'block' : 'none';
    },

    // エラー表示
    showError(message) {
        const errorElement = document.getElementById('mapError');
        const errorMessage = document.getElementById('mapErrorMessage');
        
        errorMessage.textContent = message;
        errorElement.style.display = 'block';
        this.showLoading(false);
    },

    // 再試行
    retryLoad() {
        const errorElement = document.getElementById('mapError');
        errorElement.style.display = 'none';
        this.initializeMap();
    }
};

// コンポーネントをルーターに登録
router.register('map', MapComponent);