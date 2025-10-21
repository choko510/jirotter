// MAPコンポーネント
const MapComponent = {
    // ブランド設定
    BRAND_CONFIG: {
        butayama: { name: '豚山', color: '#fcd700ff', textColor: 'black', markerText: '豚', keywords: ['豚山'] },
        ramenso: { name: 'ラーメン荘', color: '#3498db', textColor: 'white', markerText: '荘', keywords: ['ラーメン荘'] },
        rakeiko: { name: 'ら・けいこ', color: '#2ecc71', textColor: 'white', keywords: ['ら・けいこ'] },
        ahare: { name: '麺屋あっ晴れ', color: '#e74c3c', textColor: 'white', keywords: ['あっ晴れ'] },
        tachikawa: { name: '立川マシマシ', color: '#9b59b6', textColor: 'white', keywords: ['立川マシマシ'] },
        tsukemensha: { name: 'つけめん舎', color: '#1abc9c', textColor: 'white', keywords: ['つけめん舎'] },
        jiro: { name: '直系二郎', color: '#d4a574', textColor: 'white', markerText: '直', keywords: ['ラーメン二郎'] },
        other: { name: 'その他', color: '#95a5a6', textColor: 'white', keywords: [] }
    },

    // 状態管理
    state: {
        map: null,
        markers: [],
        userLocation: null,
        isLoading: false,
        lastCenter: null,
        debounceTimer: null,
        moveThreshold: 0.01, // 緯度経度の変化閾値（約1km）
        // キャッシュ関連
        shopCache: new Map(), // 店舗データキャッシュ
        cacheRadius: 30, // キャッシュ有効半径（km）
        maxCacheSize: 1000, // 最大キャッシュ数
        pendingRequests: new Map(), // 進行中のAPIリクエストを追跡
        // マーカー管理関連
        markerLayerGroup: null, // マーカーをグループ化して管理
        visibleMarkers: new Set(), // 現在表示されているマーカー
        markerVisibilityRadius: 50, // マーカー表示半径（km）
        // ブランドフィルター関連
        activeFilters: new Set(), // 現在アクティブなフィルター
        brandShopCounts: {} // ブランドごとの店舗数
    },

    // 初期化
    init() {
        // 初期化処理はrender内で行う
    },

    // 店名からブランドを判定する関数
    determineBrand(shopName) {
        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            if (brandKey === 'other') continue;
            
            for (const keyword of brandConfig.keywords) {
                if (shopName.includes(keyword)) {
                    return brandKey;
                }
            }
        }
        return 'other';
    },

    // ブランドごとの店舗数をカウントする関数
    countShopsByBrand(shops) {
        const counts = {};
        
        // すべてのブランドを初期化
        for (const brandKey of Object.keys(this.BRAND_CONFIG)) {
            counts[brandKey] = 0;
        }
        
        // 店舗をブランドごとにカウント
        shops.forEach(shop => {
            const brand = this.determineBrand(shop.name);
            counts[brand]++;
        });
        
        return counts;
    },

    // ブランドフィルターUIを生成する関数
    generateBrandFilterButtons() {
        let buttonsHtml = '';
        
        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            if (brandKey === 'other') continue; // 「その他」はフィルターに表示しない
            
            const count = this.state.brandShopCounts[brandKey] || 0;
            // 店舗数が0のブランドは表示しない
            if (count === 0) continue;
            
            buttonsHtml += `
                <button class="map-filter-btn"
                        data-brand="${brandKey}"
                        onclick="MapComponent.toggleFilter('${brandKey}')"
                        title="${brandConfig.name}: ${count}件">
                    ${brandConfig.name} (${count})
                </button>
            `;
        }
        
        return buttonsHtml;
    },

    // 地図の凡例を生成する関数
    generateLegend() {
        let legendHtml = '<div class="legend-title">ブランド</div>';
        
        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            const count = this.state.brandShopCounts[brandKey] || 0;
            if (count > 0 || brandKey === 'other') {
                legendHtml += `
                    <div class="legend-item">
                        <div class="marker-icon" style="background: ${brandConfig.color};"></div>
                        <span>${brandConfig.name} (${count})</span>
                    </div>
                `;
            }
        }
        
        return legendHtml;
    },

    // レンダリング
    async render(params = []) {
        const contentArea = document.getElementById('contentArea');
        
        const mainHeader = document.querySelector('.main-header');
        const isHeaderVisible = mainHeader && mainHeader.style.display !== 'none';
        const mapHeight = isHeaderVisible ? 'calc(100vh - 60px)' : '100vh';

        contentArea.innerHTML = `
            <style>
                .map-container {
                    padding: 0;
                    height: ${mapHeight};
                    width: 100%;
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
                
                .brand-filters {
                    padding: 12px 16px;
                    background: #f9f9f9;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .filter-title {
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #333;
                }
                
                .filter-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                
                .filter-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .filter-action-btn {
                    padding: 4px 12px;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 16px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .filter-action-btn:hover {
                    background: #f0f0f0;
                }
                
                .map-content {
                    flex: 1;
                    position: relative;
                    width: 100%;
                }
                
                #map {
                    width: 100%;
                    height: 100%;
                    min-height: 100%;
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
                        width: 100vw;
                        max-width: 100%;
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
                    
                    .brand-filters {
                        padding: 8px 12px;
                    }
                    
                    .filter-buttons {
                        gap: 6px;
                    }
                    
                    .map-filter-btn {
                        padding: 6px 12px;
                        font-size: 12px;
                    }
                    
                    .filter-actions {
                        flex-wrap: wrap;
                    }
                    
                    .filter-action-btn {
                        font-size: 11px;
                        padding: 3px 8px;
                    }
                    
                    .map-legend {
                        bottom: 10px;
                        right: 10px;
                        padding: 8px;
                        font-size: 11px;
                    }
                    
                    .legend-item {
                        font-size: 11px;
                    }
                }

                /* Dark Mode Overrides */
                .dark-mode .map-header,
                .dark-mode .map-loading,
                .dark-mode .map-error,
                .dark-mode .map-legend {
                    background: #2a2a2a;
                    border-color: #333;
                }

                .dark-mode .map-search-input {
                    background: #1a1a1a;
                    border-color: #333;
                    color: #e0e0e0;
                }
                .dark-mode .map-search-input:focus {
                    background: #2a2a2a;
                }
                .dark-mode .map-search-btn {
                    color: #aaa;
                }
                .dark-mode .map-filter-btn {
                    background: #1a1a1a;
                    border-color: #333;
                    color: #e0e0e0;
                }
                .dark-mode .map-filter-btn:hover {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: #1a1a1a;
                }
                .dark-mode .map-filter-btn.active {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: #1a1a1a;
                }

                /* Shop Detail Panel */
                .shop-detail-panel {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 350px;
                    height: 100%;
                    background: white;
                    z-index: 5; /* 非表示時は低いz-index */
                    transform: translateX(-100%);
                    transition: transform 0.3s ease-in-out, z-index 0.3s ease-in-out;
                    box-shadow: 2px 0 10px rgba(0,0,0,0.1);
                    overflow-y: auto;
                    visibility: hidden; /* 非表示時は完全に見えなくする */
                }

                .shop-detail-panel.show {
                    transform: translateX(0);
                    z-index: 1010; /* 表示時は高いz-index */
                    visibility: visible; /* 表示時は見えるようにする */
                }

                .dark-mode .shop-detail-panel {
                    background: #2a2a2a;
                    border-right: 1px solid #333;
                }

                @media (max-width: 768px) {
                    .shop-detail-panel {
                        width: 100%;
                        height: 60%;
                        bottom: 0;
                        top: auto;
                        left: 0;
                        transform: translateY(100%);
                        border-top: 1px solid #e0e0e0;
                        visibility: hidden; /* 非表示時は完全に見えなくする */
                    }

                    .shop-detail-panel.show {
                        transform: translateY(0);
                        visibility: visible; /* 表示時は見えるようにする */
                    }

                    .dark-mode .shop-detail-panel {
                         border-top: 1px solid #333;
                         border-right: none;
                    }
                }
            </style>
            
            <div class="map-container">
                <div class="map-header">
                    <h1 class="map-title">
                        <i class="fas fa-map-marked-alt"></i>
                        店舗マップ
                    </h1>
                    
                    <div class="map-controls">
                        <div class="map-search">
                            <input type="text" class="map-search-input" placeholder="店名や住所で検索..." id="mapSearchInput">
                            <button class="map-search-btn" onclick="MapComponent.searchLocation()">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                        <button class="map-filter-btn" onclick="MapComponent.getCurrentLocation()">
                            <i class="fas fa-location-arrow"></i>
                        </button>
                    </div>
                    
                    <div class="brand-filters" id="brandFilters">
                        <div class="filter-title">ブランドで絞り込み:</div>
                        <div class="filter-buttons" id="filterButtons">
                            <!-- ブランドフィルターボタンは動的に生成されます -->
                        </div>
                        <div class="filter-actions">
                            <button class="filter-action-btn" onclick="MapComponent.selectAllBrands()">すべて選択</button>
                            <button class="filter-action-btn" onclick="MapComponent.clearAllFilters()">クリア</button>
                        </div>
                    </div>
                </div>
                
                <div class="map-content">
                    <div id="map"></div>
                    <div id="shopDetailPanel" class="shop-detail-panel"></div>
                    
                    <div class="map-loading" id="mapLoading" style="display: none;">
                        <div class="map-spinner"></div>
                        <p>読み込み中...</p>
                    </div>
                    
                    <div class="map-error" id="mapError" style="display: none;">
                        <h3>エラー</h3>
                        <p id="mapErrorMessage">マップの読み込みに失敗しました</p>
                        <button onclick="MapComponent.retryLoad()">再試行</button>
                    </div>
                    
                    <div class="map-legend" id="mapLegend">
                        <!-- 凡例は動的に生成されます -->
                    </div>
                </div>
            </div>
        `;

        // マップを初期化
        setTimeout(async () => {
            await this.initializeMap();
            // ブランドフィルターUIを初期化
            this.initializeBrandFilters();
        }, 100);
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
            
            // マーカーをグループ化して管理
            this.state.markerLayerGroup = L.layerGroup().addTo(this.state.map);
            
            // 地図の移動イベントをリッスン（デバウンス処理付き）
            this.state.map.on('moveend', () => {
                this.handleMapMove();
            });
            
            // ズームレベル変更時にもマーカー表示を更新
            this.state.map.on('zoomend', () => {
                this.updateMarkerVisibility();
            });
            
            // 現在位置マーカーを追加
            this.addUserMarker(location);
            
            // 初期中心位置を保存
            this.state.lastCenter = location;
            
            // 近くのラーメン店データを取得して追加
            await this.addNearbyShops(location, null);
            
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
            
            // ipinfo.ioのレスポンス形式に対応
            if (data.error) {
                throw new Error(data.error.message || '位置情報の取得に失敗しました');
            }
            
            // locフィールドから緯度経度を抽出
            const [lat, lng] = data.loc ? data.loc.split(',').map(coord => parseFloat(coord)) : [null, null];
            
            if (!lat || !lng) {
                throw new Error('位置情報の取得に失敗しました');
            }
            
            this.state.userLocation = {
                lat: lat,
                lng: lng,
                city: data.city || '',
                country: data.country || '',
                region: data.region || '',
                postal: data.postal || '',
                timezone: data.timezone || '',
                org: data.org || ''
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

    // マップ移動を処理する関数
    handleMapMove() {
        // デバウンス処理：前回のタイマーをクリア
        if (this.state.debounceTimer) {
            clearTimeout(this.state.debounceTimer);
        }
        
        // 新しいタイマーを設定（500ms後に実行）
        this.state.debounceTimer = setTimeout(async () => {
            const currentCenter = this.state.map.getCenter();
            const { lat, lng } = currentCenter;
            
            // 前回の中心位置との距離を計算
            if (this.state.lastCenter) {
                const latDiff = Math.abs(lat - this.state.lastCenter.lat);
                const lngDiff = Math.abs(lng - this.state.lastCenter.lng);
                
                // 閾値以下の移動ならAPIを呼ばない
                if (latDiff < this.state.moveThreshold && lngDiff < this.state.moveThreshold) {
                    console.log('移動距離が閾値以下のため、APIを呼びません');
                    // マーカーの表示範囲だけ更新
                    this.updateMarkerVisibility();
                    return;
                }
            }
            
            // 現在の中心位置を保存
            this.state.lastCenter = { lat, lng };
            
            // APIを呼び出して近くの店舗を取得
            await this.addNearbyShops({ lat, lng }, null);
        }, 500);
    },

    // キャッシュキーを生成
    generateCacheKey(lat, lng, radius) {
        // 緯度経度を小数点第3位まで丸めてキーを生成（約100m単位）
        const roundedLat = Math.round(lat * 1000) / 1000;
        const roundedLng = Math.round(lng * 1000) / 1000;
        return `${roundedLat},${roundedLng},${radius}`;
    },

    // キャッシュに店舗データを保存
    cacheShopData(key, data) {
        // キャッシュサイズが上限に達した場合、最も古いエントリを削除
        if (this.state.shopCache.size >= this.state.maxCacheSize) {
            const firstKey = this.state.shopCache.keys().next().value;
            this.state.shopCache.delete(firstKey);
        }
        
        // タイムスタンプ付きでデータを保存
        this.state.shopCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    },

    // キャッシュから店舗データを取得
    getCachedShopData(key) {
        const cached = this.state.shopCache.get(key);
        if (!cached) return null;
        
        // 5分以上経過したキャッシュは無効
        const maxAge = 5 * 60 * 1000; // 5分
        if (Date.now() - cached.timestamp > maxAge) {
            this.state.shopCache.delete(key);
            return null;
        }
        
        return cached.data;
    },

    // 近くのキャッシュエントリを検索
    findNearbyCacheEntry(lat, lng, radius) {
        for (const [key, entry] of this.state.shopCache.entries()) {
            const [cachedLat, cachedLng, cachedRadius] = key.split(',').map(Number);
            
            // 2点間の距離を計算（簡易計算）
            const latDiff = Math.abs(lat - cachedLat);
            const lngDiff = Math.abs(lng - cachedLng);
            
            // キャッシュの範囲内にあるかチェック
            if (latDiff <= 0.01 && lngDiff <= 0.01 && cachedRadius >= radius) {
                return entry.data;
            }
        }
        return null;
    },

    // 近くのラーメン店データを取得して追加（キャッシュ対応版）
    async addNearbyShops(centerLocation, currentRadius = null) {
        try {
            const { lat, lng } = centerLocation;
            // 検索範囲を段階的に広げるための配列
            const radiusSteps = [30, 50, 100, 200]; // km
            const maxRadius = 200; // 最大検索範囲
            
            // 初期検索範囲を設定
            let radius = currentRadius || this.state.cacheRadius;
            
            // 現在の検索範囲がradiusStepsに含まれていない場合は、次のステップを見つける
            let radiusIndex = radiusSteps.indexOf(radius);
            if (radiusIndex === -1) {
                // 現在の半径が配列にない場合は、最も近い大きい値を見つける
                radiusIndex = radiusSteps.findIndex(r => r > radius);
                if (radiusIndex === -1) {
                    radiusIndex = radiusSteps.length - 1; // 最大値を使用
                }
            }
            
            // 検索範囲を段階的に広げながら店舗を検索
            for (let i = radiusIndex; i < radiusSteps.length; i++) {
                radius = radiusSteps[i];
                
                // キャッシュキーを生成
                const cacheKey = this.generateCacheKey(lat, lng, radius);
                
                // まず近くのキャッシュエントリを検索
                let cachedData = this.findNearbyCacheEntry(lat, lng, radius);
                
                // 近くのキャッシュがなければ、正確なキーでキャッシュを検索
                if (!cachedData) {
                    cachedData = this.getCachedShopData(cacheKey);
                }
                
                // キャッシュがあればそれを使用
                if (cachedData) {
                    console.log(`キャッシュから店舗データを使用 (範囲: ${radius}km)`);
                    this.updateShopMarkers(cachedData.shops);
                    
                    // 店舗数が10以下で、まだ最大検索範囲に達していない場合は次の範囲を試す
                    if (cachedData.shops.length <= 10 && radius < maxRadius) {
                        console.log(`店舗数が${cachedData.shops.length}件のため、検索範囲を広げます`);
                        continue;
                    }
                    return;
                }
                
                // 進行中の同じリクエストがあれば、それが完了するまで待つ
                const pendingKey = `${lat},${lng},${radius}`;
                if (this.state.pendingRequests.has(pendingKey)) {
                    console.log(`進行中のリクエストを待機中... (範囲: ${radius}km)`);
                    const existingRequest = this.state.pendingRequests.get(pendingKey);
                    const data = await existingRequest;
                    this.updateShopMarkers(data.shops);
                    
                    // 店舗数が10以下で、まだ最大検索範囲に達していない場合は次の範囲を試す
                    if (data.shops.length <= 10 && radius < maxRadius) {
                        console.log(`店舗数が${data.shops.length}件のため、検索範囲を広げます`);
                        continue;
                    }
                    return;
                }
                
                // APIリクエストを作成
                const apiRequest = fetch(`/api/v1/ramen/nearby?latitude=${lat}&longitude=${lng}&radius_km=${radius}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('ラーメン店データの取得に失敗しました');
                        }
                        return response.json();
                    })
                    .then(data => {
                        // 取得したデータをキャッシュに保存
                        this.cacheShopData(cacheKey, data);
                        
                        // 取得した店舗データでマーカーを更新
                        this.updateShopMarkers(data.shops);
                        
                        // リクエスト完了後、pendingリストから削除
                        this.state.pendingRequests.delete(pendingKey);
                        
                        // 店舗数が10以下で、まだ最大検索範囲に達していない場合は次の範囲を試す
                        if (data.shops.length <= 10 && radius < maxRadius) {
                            console.log(`店舗数が${data.shops.length}件のため、検索範囲を広げます`);
                            // 次の範囲で再検索
                            this.addNearbyShops(centerLocation, radiusSteps[i + 1]);
                        }
                        
                        return data;
                    })
                    .catch(error => {
                        console.error('ラーメン店データの取得に失敗しました:', error);
                        this.showError('ラーメン店データの取得に失敗しました: ' + error.message);
                        
                        // エラー時もpendingリストから削除
                        this.state.pendingRequests.delete(pendingKey);
                        
                        throw error;
                    });
                
                // 進行中のリクエストとして保存
                this.state.pendingRequests.set(pendingKey, apiRequest);
                
                // この範囲での検索を開始したので、ループを抜ける
                break;
            }
            
        } catch (error) {
            console.error('ラーメン店データの取得に失敗しました:', error);
            this.showError('ラーメン店データの取得に失敗しました: ' + error.message);
        }
    },
    
    // 店舗マーカーをクリア
    clearShopMarkers() {
        // 既存の店舗マーカーを地図から削除
        this.state.markers.forEach(marker => {
            if (this.state.markerLayerGroup.hasLayer(marker)) {
                this.state.markerLayerGroup.removeLayer(marker);
            }
        });
        
        // マーカーリストと表示セットをクリア
        this.state.markers = [];
        this.state.visibleMarkers.clear();
    },

    // ブランドフィルターを初期化する関数
    initializeBrandFilters() {
        // デフォルトではすべての店舗を表示（フィルターは無効）
        this.state.activeFilters.clear();
        
        // フィルターボタンを生成
        this.updateFilterButtons();
        
        // 凡例を更新
        this.updateLegend();
    },

    // フィルターボタンを更新する関数
    updateFilterButtons() {
        const filterButtonsContainer = document.getElementById('filterButtons');
        if (filterButtonsContainer) {
            filterButtonsContainer.innerHTML = this.generateBrandFilterButtons();
            
            // アクティブなフィルターのボタンをハイライト
            this.state.activeFilters.forEach(brandKey => {
                const button = filterButtonsContainer.querySelector(`[data-brand="${brandKey}"]`);
                if (button) {
                    button.classList.add('active');
                }
            });
        }
    },

    // 凡例を更新する関数
    updateLegend() {
        const legendContainer = document.getElementById('mapLegend');
        if (legendContainer) {
            legendContainer.innerHTML = this.generateLegend();
        }
    },

    // 店舗マーカーを更新（既存のマーカーを再利用）
    updateShopMarkers(shops) {
        if (!this.state.map) return;

        // ブランドごとの店舗数をカウント
        this.state.brandShopCounts = this.countShopsByBrand(shops);
        
        // フィルターボタンと凡例を更新
        this.updateFilterButtons();
        this.updateLegend();

        // 既存のマーカーをマップで管理
        const existingMarkerIds = new Set();
        
        // 新しい店舗データでマーカーを更新または追加
        shops.forEach(shop => {
            // ブランドを判定
            const brand = this.determineBrand(shop.name);
            
            const shopData = {
                id: shop.id,
                name: shop.name,
                brand: brand,
                type: brand, // 互換性のためtypeにも保存
                lat: shop.latitude,
                lng: shop.longitude,
                address: shop.address,
                business_hours: shop.business_hours,
                closed_day: shop.closed_day,
                seats: shop.seats,
                distance: shop.distance,
                description: `${shop.address}<br>営業時間: ${shop.business_hours || '不明'}<br>定休日: ${shop.closed_day || '不明'}<br>距離: 約${shop.distance}km`
            };
            
            // 既存のマーカーがあるかチェック
            const existingMarkerIndex = this.state.markers.findIndex(marker =>
                marker.shopId === shop.id
            );
            
            if (existingMarkerIndex !== -1) {
                // 既存のマーカーを更新
                existingMarkerIds.add(shop.id);
                // 位置が変わっていれば更新
                const marker = this.state.markers[existingMarkerIndex];
                const currentPos = marker.getLatLng();
                if (currentPos.lat !== shopData.lat || currentPos.lng !== shopData.lng) {
                    marker.setLatLng([shopData.lat, shopData.lng]);
                }
                // ブランド情報も更新
                marker.brand = brand;
            } else {
                // 新しいマーカーを追加
                this.addShopMarker(shopData);
                existingMarkerIds.add(shop.id);
            }
        });
        
        // 不要なマーカーを削除
        this.state.markers = this.state.markers.filter(marker => {
            if (!existingMarkerIds.has(marker.shopId)) {
                if (this.state.markerLayerGroup.hasLayer(marker)) {
                    this.state.markerLayerGroup.removeLayer(marker);
                }
                this.state.visibleMarkers.delete(marker.shopId);
                return false;
            }
            return true;
        });
        
        // 表示範囲内のマーカーだけを表示
        this.updateMarkerVisibility();
    },

    // 表示範囲内のマーカーだけを表示/非表示
    updateMarkerVisibility() {
        if (!this.state.map) return;
        
        const bounds = this.state.map.getBounds();
        const center = this.state.map.getCenter();
        const zoom = this.state.map.getZoom();
        
        // ズームレベルに応じて表示範囲を調整
        let visibilityRadius = this.state.markerVisibilityRadius;
        if (zoom < 10) {
            visibilityRadius = 100; // 低ズームでは広範囲を表示
        } else if (zoom < 12) {
            visibilityRadius = 50;
        } else {
            visibilityRadius = 30; // 高ズームでは狭範囲を表示
        }
        
        this.state.markers.forEach(marker => {
            const markerPos = marker.getLatLng();
            const distance = this.calculateDistance(center.lat, center.lng, markerPos.lat, markerPos.lng);
            const brand = marker.brand || 'other';
            
            const isInBounds = bounds.contains(markerPos) && distance <= visibilityRadius;
            const isActiveFilter = this.state.activeFilters.size === 0 || this.state.activeFilters.has(brand);
            
            if (isInBounds && isActiveFilter) {
                // 表示範囲内かつフィルターに合致する場合、マーカーを表示
                if (!this.state.markerLayerGroup.hasLayer(marker)) {
                    this.state.markerLayerGroup.addLayer(marker);
                }
                this.state.visibleMarkers.add(marker.shopId);
            } else {
                // 表示範囲外またはフィルターに合致しない場合、マーカーを非表示
                if (this.state.markerLayerGroup.hasLayer(marker)) {
                    this.state.markerLayerGroup.removeLayer(marker);
                }
                this.state.visibleMarkers.delete(marker.shopId);
            }
        });
    },

    // 2点間の距離を計算（Haversine formula）
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // 地球の半径（km）
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    // 度数をラジアンに変換
    toRad(deg) {
        return deg * (Math.PI/180);
    },

    // 店舗マーカーを追加
    addShopMarker(shop) {
        const brand = shop.brand || shop.type || 'other';
        const brandConfig = this.BRAND_CONFIG[brand];
        const color = brandConfig ? brandConfig.color : this.BRAND_CONFIG.other.color;
        const textColor = brandConfig ? brandConfig.textColor : this.BRAND_CONFIG.other.textColor;
        // markerTextが設定されていない場合はデフォルトで「ラ」を表示
        const markerText = (brandConfig && brandConfig.markerText) ? brandConfig.markerText : 'ラ';
        
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
                        background: ${color};
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
                        color: ${textColor};
                        font-weight: bold;
                        font-size: 12px;
                    ">${markerText}</div>
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
                <p style="margin: 0 0 8px 0; font-size: 12px;">ブランド: ${brandConfig ? brandConfig.name : 'その他'}</p>
                <button onclick="MapComponent.showShopDetails(${shop.id})" style="margin-top: 8px; padding: 4px 8px; background: ${color}; color: white; border: none; border-radius: 4px; cursor: pointer;">詳細を見る</button>
            </div>
        `;
        
        const marker = L.marker([shop.lat, shop.lng], { icon: shopIcon })
            .bindPopup(popupContent);
        
        // 店舗IDとブランドをマーカーに保存して後で識別できるようにする
        marker.shopId = shop.id;
        marker.brand = brand;
        
        // 最初はマーカーグループに追加せず、表示範囲チェック後に追加
        this.state.markers.push(marker);
        
        // 表示範囲内かチェックして、範囲内なら表示
        if (this.state.map) {
            const bounds = this.state.map.getBounds();
            const center = this.state.map.getCenter();
            const distance = this.calculateDistance(center.lat, center.lng, shop.lat, shop.lng);
            const zoom = this.state.map.getZoom();
            
            let visibilityRadius = this.state.markerVisibilityRadius;
            if (zoom < 10) {
                visibilityRadius = 100;
            } else if (zoom < 12) {
                visibilityRadius = 50;
            } else {
                visibilityRadius = 30;
            }
            
            if (bounds.contains([shop.lat, shop.lng]) && distance <= visibilityRadius) {
                // フィルターが適用されている場合は、フィルターに合致する場合のみ表示
                if (this.state.activeFilters.size === 0 || this.state.activeFilters.has(brand)) {
                    this.state.markerLayerGroup.addLayer(marker);
                    this.state.visibleMarkers.add(shop.id);
                }
            }
        }
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
    toggleFilter(brand) {
        // まずすべてのフィルターをクリア
        this.state.activeFilters.clear();
        
        // すべてのボタンを非アクティブにする
        const buttons = document.querySelectorAll('.map-filter-btn[data-brand]');
        buttons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 選択されたブランドのみをアクティブにする
        this.state.activeFilters.add(brand);
        
        // 選択されたボタンをアクティブにする
        const button = document.querySelector(`[data-brand="${brand}"]`);
        if (button) {
            button.classList.add('active');
        }
        
        // マーカーの表示を更新
        this.updateMarkerVisibility();
    },

    // すべてのブランドを選択
    selectAllBrands() {
        // すべてのブランドをアクティブにする
        for (const brandKey of Object.keys(this.BRAND_CONFIG)) {
            this.state.activeFilters.add(brandKey);
        }
        
        // すべてのボタンをアクティブ状態にする
        const buttons = document.querySelectorAll('.map-filter-btn[data-brand]');
        buttons.forEach(button => {
            button.classList.add('active');
        });
        
        // マーカーの表示を更新
        this.updateMarkerVisibility();
    },

    // すべてのフィルターをクリア
    clearAllFilters() {
        // すべてのフィルターをクリア
        this.state.activeFilters.clear();
        
        // すべてのボタンを非アクティブ状態にする
        const buttons = document.querySelectorAll('.map-filter-btn[data-brand]');
        buttons.forEach(button => {
            button.classList.remove('active');
        });
        
        // マーカーの表示を更新（すべての店舗を表示）
        this.updateMarkerVisibility();
    },

    // 店舗詳細表示
    async showShopDetails(shopId) {
        const panel = document.getElementById('shopDetailPanel');
        panel.innerHTML = '<div class="map-loading"><div class="map-spinner"></div><p>読み込み中...</p></div>';
        panel.classList.add('show');

        try {
            const response = await fetch(`/api/v1/ramen/${shopId}`);
            if (!response.ok) {
                throw new Error('店舗情報の取得に失敗しました');
            }
            const shop = await response.json();

            if (this.state.map && shop.latitude && shop.longitude) {
                const latLng = [shop.latitude, shop.longitude];
                const isMobile = window.innerWidth <= 768;

                this.state.map.setView(latLng, this.state.map.getZoom(), { animate: false });

                setTimeout(() => {
                    if (isMobile) {
                        const mapHeight = this.state.map.getSize().y;
                        const panelHeight = mapHeight * 0.6; // Panel is 60% of height
                        const yOffset = panelHeight / 2;
                        this.state.map.panBy([0, -yOffset], { animate: true });
                    } else {
                        const panelWidth = 350; // Panel is 350px wide
                        const xOffset = panelWidth / 2;
                        this.state.map.panBy([xOffset, 0], { animate: true });
                    }
                }, 100);
            }

            panel.innerHTML = `
                <div class="shop-detail-container" style="padding: 16px;">
                    <div class="shop-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px;">
                        <h2 class="shop-name" style="font-size: 18px; font-weight: bold; margin: 0; flex: 1;">${this.escapeHtml(shop.name)}</h2>
                        <button class="back-button" onclick="MapComponent.hideShopDetails()" style="background: transparent; border: none; font-size: 20px; cursor: pointer; padding: 4px;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                     <div class="shop-info-card" style="border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; margin-bottom: 12px;">
                        <div class="shop-details" style="padding: 12px;">
                            <div class="shop-info-item" style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                                <i class="fas fa-map-marker-alt" style="color: #d4a574; font-size: 14px; margin-top: 2px;"></i>
                                <span style="font-size: 14px;">${this.escapeHtml(shop.address)}</span>
                            </div>
                            ${shop.business_hours ? `
                            <div class="shop-info-item" style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                                <i class="fas fa-clock" style="color: #d4a574; font-size: 14px; margin-top: 2px;"></i>
                                <span style="font-size: 14px;">${this.escapeHtml(shop.business_hours)}</span>
                            </div>
                            ` : ''}
                            ${shop.closed_day ? `
                            <div class="shop-info-item" style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                                <i class="fas fa-calendar-times" style="color: #d4a574; font-size: 14px; margin-top: 2px;"></i>
                                <span style="font-size: 14px;">定休日: ${this.escapeHtml(shop.closed_day)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('店舗詳細の取得に失敗しました:', error);
            panel.innerHTML = `<div class="error" style="padding: 20px; text-align: center;">店舗情報の取得に失敗しました</div>`;
        }
    },

    hideShopDetails() {
        const panel = document.getElementById('shopDetailPanel');
        panel.classList.remove('show');
    },

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
    },

    updateMarkersWithSearchResults(shops) {
        if (!this.state.map) return;

        if (shops.length === 0) {
            this.clearShopMarkers();
            return;
        }

        // 新しいマーカーを追加
        shops.forEach(shop => {
            const shopData = {
                id: shop.id,
                name: shop.name,
                type: 'jiro', // 仮
                lat: shop.latitude,
                lng: shop.longitude,
                address: shop.address,
                description: shop.address
            };
            this.addShopMarker(shopData);
        });

        // 地図の表示範囲を調整
        const latLngs = shops.map(s => [s.latitude, s.longitude]);
        const bounds = L.latLngBounds(latLngs);
        this.state.map.fitBounds(bounds, { padding: [50, 50] });
    }
};

// コンポーネントをルーターに登録
router.register('map', MapComponent);