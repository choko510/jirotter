// ユーティリティ関数
const MapUtils = {
    // 店名からブランドを判定する関数
    determineBrand(shopName, brandConfig) {
        for (const [brandKey, config] of Object.entries(brandConfig)) {
            if (brandKey === 'other') continue;
            
            for (const keyword of config.keywords) {
                if (shopName.includes(keyword)) {
                    return brandKey;
                }
            }
        }
        return 'other';
    },

    // ブランドごとの店舗数をカウントする関数
    countShopsByBrand(shops, brandConfig, determineBrandFunc) {
        const counts = {};
        
        // すべてのブランドを初期化
        for (const brandKey of Object.keys(brandConfig)) {
            counts[brandKey] = 0;
        }
        
        // 店舗をブランドごとにカウント
        shops.forEach(shop => {
            const brand = determineBrandFunc(shop.name, brandConfig);
            counts[brand]++;
        });
        
        return counts;
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
    }
};

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
        // マップ関連
        map: null,
        userLocation: null,
        isLoading: false,
        lastCenter: null,
        debounceTimer: null,
        moveThreshold: 0.02, // 緯度経度の変化閾値（約2km）
        
        // マーカー管理関連
        markers: new Map(), // <shopId, markerObject>
        markerLayerGroup: null,
        visibleMarkers: new Set(),
        markerVisibilityRadius: 50,
        
        // クラスタリング関連
        brandClusters: {}, // ブランドごとのクラスターグループ
        clusterEnabled: true,
        
        // フィルター関連
        activeFilters: new Set(),
        brandShopCounts: {},
        
        // キャッシュ関連
        cache: {
            shopCache: new Map(),
            cacheRadius: 30,
            maxCacheSize: 1000,
            pendingRequests: new Map()
        }
    },

    // フィルターエリアの開閉
    toggleFilters() {
        const container = document.getElementById('collapsible-filters');
        const button = document.getElementById('toggle-filters-btn');
        const icon = button.querySelector('i');

        container.classList.toggle('collapsed');
        button.classList.toggle('collapsed');

        // CSSのtransform: rotateでアイコンの向きを制御するため、
        // JavaScriptでのクラス切り替えは不要。
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
        return MapUtils.countShopsByBrand(shops, this.BRAND_CONFIG, MapUtils.determineBrand);
    },

    // ブランドフィルターUIを生成する関数
    generateBrandFilterButtons() {
        let buttonsHtml = '';
        
        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            if (brandKey === 'other') continue; // 「その他」はフィルターに表示しない
            
            const count = this.state.brandShopCounts[brandKey] || 0;
            // 店舗数が0でもフィルターは表示する（フィルター解除のため）
            
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

        // DocumentFragmentを使用してDOMを効率的に構築
        const fragment = document.createDocumentFragment();
        
        // スタイル要素を作成
        const styleElement = document.createElement('style');
        styleElement.textContent = this.getMapStyles(mapHeight);
        fragment.appendChild(styleElement);
        
        // コンテナ要素を作成
        const containerElement = this.getMapContainerElement();
        fragment.appendChild(containerElement);
        
        // 一度にDOMに追加
        contentArea.innerHTML = '';
        contentArea.appendChild(fragment);

        // マップを初期化
        setTimeout(async () => {
            await this.initializeMap();
            // ブランドフィルターUIを初期化
            this.initializeBrandFilters();
        }, 100);
    },

    // マップのスタイルを取得
    getMapStyles(mapHeight) {
        return `
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
            
            .map-title-container {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .map-title {
                font-size: 20px;
                font-weight: bold;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .toggle-filters-btn {
                background: transparent;
                border: none;
                font-size: 18px;
                cursor: pointer;
                padding: 4px;
                transition: transform 0.3s ease;
            }

            .toggle-filters-btn.collapsed {
                transform: rotate(180deg);
            }

            .collapsible-filters {
                max-height: 500px; /* 十分な高さを確保 */
                overflow: hidden;
                transition: max-height 0.5s ease-in-out;
            }

            .collapsible-filters.collapsed {
                max-height: 0;
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

            .dark-mode .brand-filters {
                background: #2a2a2a;
                border-bottom-color: #333;
            }

            .dark-mode .filter-title {
                color: #e0e0e0;
            }

            .dark-mode .filter-action-btn {
                background: #1a1a1a;
                border-color: #333;
                color: #e0e0e0;
            }

            .dark-mode .filter-action-btn:hover {
                background: #333;
            }

            /* Shop Detail Panel */
            .shop-detail-panel {
                position: absolute;
                top: 0;
                left: 0;
                width: 350px;
                height: 100%;
                background: white;
                z-index: 5;
                transform: translateX(-100%);
                transition: transform 0.3s ease-in-out, z-index 0.3s ease-in-out;
                box-shadow: 2px 0 10px rgba(0,0,0,0.1);
                overflow-y: auto;
                visibility: hidden;
            }

            .shop-detail-panel.show {
                transform: translateX(0);
                z-index: 1010;
                visibility: visible;
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
                    visibility: hidden;
                }

                .shop-detail-panel.show {
                    transform: translateY(0);
                    visibility: visible;
                }

                .dark-mode .shop-detail-panel {
                    border-top: 1px solid #333;
                    border-right: none;
                }
            }

            /* Marker Cluster Styles */
            .marker-cluster {
                background: rgba(255, 255, 255, 0.8);
                border-radius: 50%;
                text-align: center;
                font-weight: bold;
                font-family: Arial, sans-serif;
                border: 2px solid rgba(0, 0, 0, 0.2);
            }
            .marker-cluster div {
                width: 30px;
                height: 30px;
                margin-left: 5px;
                margin-top: 5px;
                border-radius: 50%;
                text-align: center;
                line-height: 30px;
            }
            .marker-cluster span {
                line-height: 30px;
            }
            /* クラスターサイズ別スタイル */
            .marker-cluster-small {
                background-color: rgba(181, 226, 140, 0.6);
            }
            .marker-cluster-small div {
                background-color: rgba(110, 204, 57, 0.6);
            }
            .marker-cluster-medium {
                background-color: rgba(241, 211, 87, 0.6);
            }
            .marker-cluster-medium div {
                background-color: rgba(240, 194, 12, 0.6);
            }
            .marker-cluster-large {
                background-color: rgba(253, 156, 115, 0.6);
            }
            .marker-cluster-large div {
                background-color: rgba(241, 128, 23, 0.6);
            }
            /* 豚山ブランド用のピンククラスタースタイル */
            .marker-cluster-pink {
                background-color: rgba(252, 215, 0, 0.3) !important;
                border: 2px solid rgba(252, 215, 0, 0.8) !important;
            }
            .marker-cluster-pink div {
                background-color: rgba(252, 215, 0, 0.8) !important;
                color: black !important;
            }
            .marker-cluster-pink.marker-cluster-small {
                background-color: rgba(252, 215, 0, 0.3) !important;
            }
            .marker-cluster-pink.marker-cluster-small div {
                background-color: rgba(252, 215, 0, 0.6) !important;
            }
            .marker-cluster-pink.marker-cluster-medium {
                background-color: rgba(252, 215, 0, 0.4) !important;
            }
            .marker-cluster-pink.marker-cluster-medium div {
                background-color: rgba(252, 215, 0, 0.7) !important;
            }
            .marker-cluster-pink.marker-cluster-large {
                background-color: rgba(252, 215, 0, 0.5) !important;
            }
            .marker-cluster-pink.marker-cluster-large div {
                background-color: rgba(252, 215, 0, 0.9) !important;
            }
            /* 他のブランド用のクラスタースタイル */
            .marker-cluster-ramenso {
                background-color: rgba(52, 152, 219, 0.3) !important;
                border: 2px solid rgba(52, 152, 219, 0.8) !important;
            }
            .marker-cluster-ramenso div {
                background-color: rgba(52, 152, 219, 0.8) !important;
                color: white !important;
            }
            .marker-cluster-rakeiko {
                background-color: rgba(46, 204, 113, 0.3) !important;
                border: 2px solid rgba(46, 204, 113, 0.8) !important;
            }
            .marker-cluster-rakeiko div {
                background-color: rgba(46, 204, 113, 0.8) !important;
                color: white !important;
            }
            .marker-cluster-ahare {
                background-color: rgba(231, 76, 60, 0.3) !important;
                border: 2px solid rgba(231, 76, 60, 0.8) !important;
            }
            .marker-cluster-ahare div {
                background-color: rgba(231, 76, 60, 0.8) !important;
                color: white !important;
            }
            .marker-cluster-tachikawa {
                background-color: rgba(155, 89, 182, 0.3) !important;
                border: 2px solid rgba(155, 89, 182, 0.8) !important;
            }
            .marker-cluster-tachikawa div {
                background-color: rgba(155, 89, 182, 0.8) !important;
                color: white !important;
            }
            .marker-cluster-tsukemensha {
                background-color: rgba(26, 188, 156, 0.3) !important;
                border: 2px solid rgba(26, 188, 156, 0.8) !important;
            }
            .marker-cluster-tsukemensha div {
                background-color: rgba(26, 188, 156, 0.8) !important;
                color: white !important;
            }
            .marker-cluster-jiro {
                background-color: rgba(212, 165, 116, 0.3) !important;
                border: 2px solid rgba(212, 165, 116, 0.8) !important;
            }
            .marker-cluster-jiro div {
                background-color: rgba(212, 165, 116, 0.8) !important;
                color: white !important;
            }
            .marker-cluster-other {
                background-color: rgba(149, 165, 166, 0.3) !important;
                border: 2px solid rgba(149, 165, 166, 0.8) !important;
            }
            .marker-cluster-other div {
                background-color: rgba(149, 165, 166, 0.8) !important;
                color: white !important;
            }
        `;
    },

    // マップコンテナ要素を取得
    getMapContainerElement() {
        const container = document.createElement('div');
        container.className = 'map-container';
        
        // ヘッダー要素
        const header = document.createElement('div');
        header.className = 'map-header';
        
        // タイトルとトグルボタン
        const titleContainer = document.createElement('div');
        titleContainer.className = 'map-title-container';

        const title = document.createElement('h1');
        title.className = 'map-title';
        title.innerHTML = '<i class="fas fa-map-marked-alt"></i>店舗マップ';

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-filters-btn';
        toggleBtn.className = 'toggle-filters-btn';
        toggleBtn.onclick = () => this.toggleFilters();
        toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>'; // 初期アイコン

        titleContainer.appendChild(title);
        titleContainer.appendChild(toggleBtn);
        header.appendChild(titleContainer);

        // 開閉可能なフィルターコンテナ
        const collapsibleContainer = document.createElement('div');
        collapsibleContainer.id = 'collapsible-filters';
        collapsibleContainer.className = 'collapsible-filters';

        // コントロール
        const controls = document.createElement('div');
        controls.className = 'map-controls';
        
        // 検索
        const search = document.createElement('div');
        search.className = 'map-search';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'map-search-input';
        searchInput.placeholder = '店名や住所で検索...';
        searchInput.id = 'mapSearchInput';
        
        const searchBtn = document.createElement('button');
        searchBtn.className = 'map-search-btn';
        searchBtn.onclick = () => this.searchLocation();
        searchBtn.innerHTML = '<i class="fas fa-search"></i>';
        
        search.appendChild(searchInput);
        search.appendChild(searchBtn);
        
        // 現在地ボタン
        const locationBtn = document.createElement('button');
        locationBtn.className = 'map-filter-btn';
        locationBtn.onclick = () => this.getCurrentLocation();
        locationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
        
        controls.appendChild(search);
        controls.appendChild(locationBtn);
        collapsibleContainer.appendChild(controls);
        
        // ブランドフィルター
        const brandFilters = document.createElement('div');
        brandFilters.className = 'brand-filters';
        brandFilters.id = 'brandFilters';
        
        const filterTitle = document.createElement('div');
        filterTitle.className = 'filter-title';
        filterTitle.textContent = 'ブランドで絞り込み:';
        brandFilters.appendChild(filterTitle);
        
        const filterButtons = document.createElement('div');
        filterButtons.className = 'filter-buttons';
        filterButtons.id = 'filterButtons';
        brandFilters.appendChild(filterButtons);
        
        const filterActions = document.createElement('div');
        filterActions.className = 'filter-actions';
        
        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'filter-action-btn';
        selectAllBtn.onclick = () => this.selectAllBrands();
        selectAllBtn.textContent = 'すべて選択';
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'filter-action-btn';
        clearBtn.onclick = () => this.clearAllFilters();
        clearBtn.textContent = 'クリア';
        
        filterActions.appendChild(selectAllBtn);
        filterActions.appendChild(clearBtn);
        brandFilters.appendChild(filterActions);
        
        collapsibleContainer.appendChild(brandFilters);
        header.appendChild(collapsibleContainer);
        container.appendChild(header);
        
        // コンテンツ
        const content = document.createElement('div');
        content.className = 'map-content';
        
        // マップ
        const map = document.createElement('div');
        map.id = 'map';
        content.appendChild(map);
        
        // 店舗詳細パネル
        const shopDetailPanel = document.createElement('div');
        shopDetailPanel.id = 'shopDetailPanel';
        shopDetailPanel.className = 'shop-detail-panel';
        content.appendChild(shopDetailPanel);
        
        // ローディング
        const loading = document.createElement('div');
        loading.className = 'map-loading';
        loading.id = 'mapLoading';
        loading.style.display = 'none';
        loading.innerHTML = '<div class="map-spinner"></div><p>読み込み中...</p>';
        content.appendChild(loading);
        
        // エラー
        const error = document.createElement('div');
        error.className = 'map-error';
        error.id = 'mapError';
        error.style.display = 'none';
        error.innerHTML = `
            <h3>エラー</h3>
            <p id="mapErrorMessage">マップの読み込みに失敗しました</p>
            <button onclick="MapComponent.retryLoad()">再試行</button>
        `;
        content.appendChild(error);
        
        // 凡例
        const legend = document.createElement('div');
        legend.className = 'map-legend';
        legend.id = 'mapLegend';
        content.appendChild(legend);
        
        container.appendChild(content);
        
        return container;
    },

    // マップ初期化
    async initializeMap() {
        try {
            this.showLoading(true);
            
            // IPアドレスから位置情報を取得
            const location = await this.getLocationFromIP();
            
            // マップを作成
            this.state.map = L.map('map', {
                maxZoom: 18
            }).setView([location.lat, location.lng], 13);
            
            L.maplibreGL({
                style: 'https://tiles.openfreemap.org/styles/liberty',
                maxZoom: 18
            }).addTo(this.state.map)
            
            // マーカーをグループ化して管理
            this.state.markerLayerGroup = L.layerGroup().addTo(this.state.map);
            
            // ブランドごとのクラスターグループを初期化
            this.initializeBrandClusters();
            
            // 地図の移動イベントをリッスン（デバウンス処理付き）
            this.state.map.on('moveend', () => {
                this.handleMapMove();
            });
            
            // ズームレベル変更時にもマーカー表示を更新
            this.state.map.on('zoomend', () => {
                const currentZoom = this.state.map.getZoom();
                const searchRadius = this.calculateSearchRadius(currentZoom);
                console.log(`ズームレベル変更: ${currentZoom}, 検索範囲を ${searchRadius}km に調整`);
                
                // ズームレベルが大きく変更された場合は再検索
                const center = this.state.map.getCenter();
                this.addNearbyShops({ lat: center.lat, lng: center.lng }, null);
                
                // マーカーの表示範囲も更新
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
            const currentZoom = this.state.map.getZoom();
            
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
            
            // ズームレベルに応じて検索範囲を計算
            const searchRadius = this.calculateSearchRadius(currentZoom);
            console.log(`マップ移動: ズームレベル ${currentZoom}, 検索範囲 ${searchRadius}km`);
            
            // APIを呼び出して近くの店舗を取得
            await this.addNearbyShops({ lat, lng }, null);
        }, 500);
    },

    // キャッシュキーを生成
    generateCacheKey(lat, lng, radius) {
        // 緯度経度を小数点第1位（約10km四方）で丸めてグリッドベースのキーを生成
        const gridLat = Math.round(lat * 10) / 10;
        const gridLng = Math.round(lng * 10) / 10;
        return `${gridLat},${gridLng},${radius}`;
    },

    // キャッシュに店舗データを保存
    cacheShopData(key, data) {
        const { shopCache, maxCacheSize } = this.state.cache;
        
        // キャッシュサイズが上限に達した場合、最も古いエントリを削除
        if (shopCache.size >= maxCacheSize) {
            const firstKey = shopCache.keys().next().value;
            shopCache.delete(firstKey);
        }
        
        // タイムスタンプ付きでデータを保存
        shopCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    },

    // キャッシュから店舗データを取得
    getCachedShopData(key) {
        const { shopCache } = this.state.cache;
        const cached = shopCache.get(key);
        if (!cached) return null;
        
        // 5分以上経過したキャッシュは無効
        const maxAge = 5 * 60 * 1000; // 5分
        if (Date.now() - cached.timestamp > maxAge) {
            shopCache.delete(key);
            return null;
        }
        
        return cached.data;
    },

    // 近くのキャッシュエントリを検索
    findNearbyCacheEntry(lat, lng, radius) {
        const { shopCache } = this.state.cache;
        
        // グリッドベースのキャッシュキーを生成
        const gridLat = Math.round(lat * 10) / 10;
        const gridLng = Math.round(lng * 10) / 10;
        
        // 同じグリッド内のキャッシュを検索
        for (const [key, entry] of shopCache.entries()) {
            const [cachedGridLat, cachedGridLng, cachedRadius] = key.split(',').map(Number);
            
            // 同じグリッド内で、より広い範囲のキャッシュがあれば使用
            if (cachedGridLat === gridLat && cachedGridLng === gridLng && cachedRadius >= radius) {
                return entry.data;
            }
        }
        return null;
    },

    // ブランドごとのクラスターグループを初期化
    initializeBrandClusters() {
        // 各ブランドのクラスターグループを作成
        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            // ブランドごとに異なるクラスタースタイルを設定
            const clusterOptions = {
                // 4個未満のマーカーはクラスタリングしないカスタム関数
                iconCreateFunction: (cluster) => {
                    const count = cluster.getChildCount();
                    
                    // 4個未満のマーカーはクラスタリングしない
                    if (count < 4) {
                        // 最初のマーカーのアイコンを取得して返す
                        const markers = cluster.getAllChildMarkers();
                        if (markers.length > 0) {
                            return markers[0].getIcon();
                        }
                    }
                    
                    let size = 'small';
                    let className = `marker-cluster marker-cluster-${brandKey}`;
                    
                    if (count >= 20) {
                        size = 'large';
                    } else if (count >= 10) {
                        size = 'medium';
                    }
                    
                    className += ` marker-cluster-${size}`;
                    
                    return L.divIcon({
                        html: `<div><span>${count}</span></div>`,
                        className: className,
                        iconSize: L.point(40, 40)
                    });
                },
                // ブランドごとに異なるクラスターカラーを設定
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: true,
                zoomToBoundsOnClick: true,
                maxClusterRadius: 80, // やや大きめの半径でクラスタリング
                // ズームレベル15以上ではクラスタリングを無効にする
                disableClusteringAtZoom: 15,
                // 少数のマーカーがクラスタリングされないように設定
                chunkedLoading: true,
                spiderfyDistanceMultiplier: 2.0
            };
            
            // 特にピンク（豚山）のクラスタースタイルをカスタマイズ
            if (brandKey === 'butayama') {
                clusterOptions.iconCreateFunction = (cluster) => {
                    const count = cluster.getChildCount();
                    let size = 'small';
                    let className = `marker-cluster marker-cluster-pink`;
                    
                    if (count >= 20) {
                        size = 'large';
                    } else if (count >= 10) {
                        size = 'medium';
                    }
                    
                    className += ` marker-cluster-${size}`;
                    
                    return L.divIcon({
                        html: `<div><span>${count}</span></div>`,
                        className: className,
                        iconSize: L.point(40, 40)
                    });
                };
            }
            
            this.state.brandClusters[brandKey] = L.markerClusterGroup(clusterOptions);
            this.state.map.addLayer(this.state.brandClusters[brandKey]);
        }
    },

    // ズームレベルに応じて検索範囲を計算する関数
    calculateSearchRadius(zoomLevel) {
        // ズームレベルに応じて検索範囲を動的に調整
        // ズームアウト時（低いズームレベル）は広範囲を検索
        // ズームイン時（高いズームレベル）は狭範囲を検索
        
        if (zoomLevel <= 6) {
            // 日本全土が見えるような非常に広い範囲
            return 500;
        } else if (zoomLevel <= 8) {
            // 広域（地方レベル）
            return 300;
        } else if (zoomLevel <= 10) {
            // 中域（県レベル）
            return 150;
        } else if (zoomLevel <= 12) {
            // やや広域（市レベル）
            return 80;
        } else if (zoomLevel <= 14) {
            // 標準（地域レベル）
            return 40;
        } else if (zoomLevel <= 16) {
            // やや狭域（近隣レベル）
            return 20;
        } else {
            // 狭域（詳細レベル）
            return 10;
        }
    },

    // 近くのラーメン店データを取得して追加（キャッシュ対応版）
    async addNearbyShops(centerLocation, currentRadius = null) {
        try {
            const { lat, lng } = centerLocation;
            
            // 現在のズームレベルを取得
            const zoomLevel = this.state.map ? this.state.map.getZoom() : 13;
            
            // ズームレベルに応じて検索範囲を計算
            let radius;
            if (currentRadius) {
                radius = currentRadius;
            } else {
                radius = this.calculateSearchRadius(zoomLevel);
                console.log(`ズームレベル ${zoomLevel} に基づき検索範囲を ${radius}km に設定`);
            }
            
            // 検索範囲を段階的に広げるための配列
            const radiusSteps = [10, 20, 40, 80, 150, 300, 500]; // km
            const maxRadius = 500; // 最大検索範囲
            
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
                const { pendingRequests } = this.state.cache;
                
                if (pendingRequests.has(pendingKey)) {
                    console.log(`進行中のリクエストを待機中... (範囲: ${radius}km)`);
                    const existingRequest = pendingRequests.get(pendingKey);
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
                        this.state.cache.pendingRequests.delete(pendingKey);
                        
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
                        this.state.cache.pendingRequests.delete(pendingKey);
                        
                        throw error;
                    });
                
                // 進行中のリクエストとして保存
                this.state.cache.pendingRequests.set(pendingKey, apiRequest);
                
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
        for (const [shopId, marker] of this.state.markers.entries()) {
            const brand = marker.brand || 'other';
            
            if (this.state.clusterEnabled && this.state.brandClusters[brand]) {
                // クラスタリングが有効な場合はクラスターグループから削除
                if (this.state.brandClusters[brand].hasLayer(marker)) {
                    this.state.brandClusters[brand].removeLayer(marker);
                }
            } else {
                // クラスタリングが無効な場合は通常のマーカーグループから削除
                if (this.state.markerLayerGroup.hasLayer(marker)) {
                    this.state.markerLayerGroup.removeLayer(marker);
                }
            }
        }
        
        // マーカーリストと表示セットをクリア
        this.state.markers.clear();
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
        if (!filterButtonsContainer) return;

        // 既存のボタンを更新、なければ作成
        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            if (brandKey === 'other') continue;

            let button = filterButtonsContainer.querySelector(`[data-brand="${brandKey}"]`);
            if (!button) {
                button = document.createElement('button');
                button.className = 'map-filter-btn';
                button.dataset.brand = brandKey;
                button.onclick = () => MapComponent.toggleFilter(brandKey);
                filterButtonsContainer.appendChild(button);
            }

            const count = this.state.brandShopCounts[brandKey] || 0;
            button.textContent = `${brandConfig.name} (${count})`;
            button.title = `${brandConfig.name}: ${count}件`;

            // classList を使ってアクティブ状態を管理
            if (this.state.activeFilters.has(brandKey)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    },

    // 凡例を更新する関数
    updateLegend() {
        const legendContainer = document.getElementById('mapLegend');
        if (!legendContainer) return;

        // 既存の凡例をクリア
        while (legendContainer.firstChild) {
            legendContainer.removeChild(legendContainer.firstChild);
        }

        // タイトルを追加
        const titleElement = document.createElement('div');
        titleElement.className = 'legend-title';
        titleElement.textContent = 'ブランド';
        legendContainer.appendChild(titleElement);

        // ブランドごとの凡例項目を追加
        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            const count = this.state.brandShopCounts[brandKey] || 0;
            if (count > 0 || brandKey === 'other') {
                const itemElement = document.createElement('div');
                itemElement.className = 'legend-item';

                const markerIcon = document.createElement('div');
                markerIcon.className = 'marker-icon';
                markerIcon.style.background = brandConfig.color;

                const textSpan = document.createElement('span');
                textSpan.textContent = `${brandConfig.name} (${count})`;

                itemElement.appendChild(markerIcon);
                itemElement.appendChild(textSpan);
                legendContainer.appendChild(itemElement);
            }
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
        const newShopIds = new Set();
        
        // 新しい店舗データでマーカーを更新または追加
        shops.forEach(shop => {
            // ブランドを判定
            const brand = MapUtils.determineBrand(shop.name, this.BRAND_CONFIG);
            
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
            
            const shopId = shop.id;
            newShopIds.add(shopId);
            
            // findIndex の代わりに Map.has() を使用 (高速)
            if (this.state.markers.has(shopId)) {
                // 既存マーカーの更新
                const marker = this.state.markers.get(shopId);
                const currentPos = marker.getLatLng();
                if (currentPos.lat !== shopData.lat || currentPos.lng !== shopData.lng) {
                    marker.setLatLng([shopData.lat, shopData.lng]);
                }
                marker.brand = brand;
            } else {
                // 新規マーカーの追加
                const newMarker = this.addShopMarker(shopData); // addShopMarkerはmarkerオブジェクトを返すように変更
                this.state.markers.set(shopId, newMarker);
            }
        });
        
        // 不要なマーカーを削除
        for (const [shopId, marker] of this.state.markers.entries()) {
            if (!newShopIds.has(shopId)) {
                const brand = marker.brand || 'other';
                
                if (this.state.clusterEnabled && this.state.brandClusters[brand]) {
                    // クラスタリングが有効な場合はクラスターグループから削除
                    if (this.state.brandClusters[brand].hasLayer(marker)) {
                        this.state.brandClusters[brand].removeLayer(marker);
                    }
                } else {
                    // クラスタリングが無効な場合は通常のマーカーグループから削除
                    if (this.state.markerLayerGroup.hasLayer(marker)) {
                        this.state.markerLayerGroup.removeLayer(marker);
                    }
                }
                this.state.visibleMarkers.delete(shopId);
                this.state.markers.delete(shopId); // Mapから削除
            }
        }
        
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
        
        // フィルターが空の場合はすべてのブランドがアクティブ
        const hasActiveFilters = this.state.activeFilters.size > 0;
        
        for (const [shopId, marker] of this.state.markers.entries()) {
            const markerPos = marker.getLatLng();
            const brand = marker.brand || 'other';
            
            // 早期フィルタリング：フィルターに合致しない場合はスキップ
            if (hasActiveFilters && !this.state.activeFilters.has(brand)) {
                // 表示範囲外またはフィルターに合致しない場合、マーカーを非表示
                if (this.state.clusterEnabled && this.state.brandClusters[brand]) {
                    if (this.state.brandClusters[brand].hasLayer(marker)) {
                        this.state.brandClusters[brand].removeLayer(marker);
                    }
                } else {
                    if (this.state.markerLayerGroup.hasLayer(marker)) {
                        this.state.markerLayerGroup.removeLayer(marker);
                    }
                }
                this.state.visibleMarkers.delete(shopId);
                continue;
            }
            
            // 早期フィルタリング：表示範囲外の場合はスキップ
            if (!bounds.contains(markerPos)) {
                // 表示範囲外の場合、マーカーを非表示
                if (this.state.clusterEnabled && this.state.brandClusters[brand]) {
                    if (this.state.brandClusters[brand].hasLayer(marker)) {
                        this.state.brandClusters[brand].removeLayer(marker);
                    }
                } else {
                    if (this.state.markerLayerGroup.hasLayer(marker)) {
                        this.state.markerLayerGroup.removeLayer(marker);
                    }
                }
                this.state.visibleMarkers.delete(shopId);
                continue;
            }
            
            // 距離計算（範囲内のマーカーのみ）
            const distance = MapUtils.calculateDistance(center.lat, center.lng, markerPos.lat, markerPos.lng);
            
            if (distance <= visibilityRadius) {
                // 表示範囲内かつフィルターに合致する場合、マーカーを表示
                if (this.state.clusterEnabled && this.state.brandClusters[brand]) {
                    if (!this.state.brandClusters[brand].hasLayer(marker)) {
                        this.state.brandClusters[brand].addLayer(marker);
                    }
                } else {
                    if (!this.state.markerLayerGroup.hasLayer(marker)) {
                        this.state.markerLayerGroup.addLayer(marker);
                    }
                }
                this.state.visibleMarkers.add(shopId);
            } else {
                // 表示範囲外の場合、マーカーを非表示
                if (this.state.clusterEnabled && this.state.brandClusters[brand]) {
                    if (this.state.brandClusters[brand].hasLayer(marker)) {
                        this.state.brandClusters[brand].removeLayer(marker);
                    }
                } else {
                    if (this.state.markerLayerGroup.hasLayer(marker)) {
                        this.state.markerLayerGroup.removeLayer(marker);
                    }
                }
                this.state.visibleMarkers.delete(shopId);
            }
        }
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
        
        // クラスタリングが有効な場合はブランドごとのクラスターグループに追加
        if (this.state.clusterEnabled && this.state.brandClusters[brand]) {
            this.state.brandClusters[brand].addLayer(marker);
        } else {
            // クラスタリングが無効な場合は通常のマーカーグループに追加
            this.state.markerLayerGroup.addLayer(marker);
        }
        
        // 表示範囲内かチェックして、範囲内なら表示
        if (this.state.map) {
            const bounds = this.state.map.getBounds();
            const center = this.state.map.getCenter();
            const distance = MapUtils.calculateDistance(center.lat, center.lng, shop.lat, shop.lng);
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
                    this.state.visibleMarkers.add(shop.id);
                }
            }
        }
        
        // ここでマーカーを直接 state.markers に追加するのではなく、呼び出し元に返す
        return marker;
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
            const newMarker = this.addShopMarker(shopData);
            this.state.markers.set(shop.id, newMarker);
        });

        // 地図の表示範囲を調整
        const latLngs = shops.map(s => [s.latitude, s.longitude]);
        const bounds = L.latLngBounds(latLngs);
        this.state.map.fitBounds(bounds, { padding: [50, 50] });
    }
};

// コンポーネントをルーターに登録
router.register('map', MapComponent);