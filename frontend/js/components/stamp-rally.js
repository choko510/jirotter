// スタンプラリーコンポーネント
const StampRallyComponent = {
    // 状態管理
    state: {
        shops: [],
        checkins: [],
        progress: [],
        isLoading: false,
        currentPage: 1,
        hasMoreShops: true,
        selectedBrand: 'all',
        selectedPrefecture: 'all',
        currentView: 'list' // 'list' or 'progress'
    },

    // ブランド設定（MapComponentと共通）
    BRAND_CONFIG: {
        butayama: { name: '豚山', color: '#fcd700ff', keywords: ['豚山'] },
        ramenso: { name: 'ラーメン荘', color: '#3498db', keywords: ['ラーメン荘'] },
        rakeiko: { name: 'ら・けいこ', color: '#2ecc71', keywords: ['ら・けいこ'] },
        ahare: { name: '麺屋あっ晴れ', color: '#e74c3c', keywords: ['あっ晴れ'] },
        tachikawa: { name: '立川マシマシ', color: '#9b59b6', keywords: ['立川マシマシ'] },
        tsukemensha: { name: 'つけめん舎', color: '#1abc9c', keywords: ['つけめん舎'] },
        jiro: { name: '直系二郎', color: '#d4a574', keywords: ['ラーメン二郎'] },
        other: { name: 'その他', color: '#95a5a6', keywords: [] }
    },

    // 初期化
    async init() {
        this.bindEvents();
        const location = await this.getLocationFromIP();
        if (location && location.region) {
            this.state.selectedPrefecture = location.region;
        }
    },

    // IPアドレスから位置情報を取得
    async getLocationFromIP() {
        try {
            const response = await fetch('https://ipinfo.io/json');
            if (!response.ok) throw new Error('Failed to fetch location from IP');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('IP-based location fetch failed:', error);
            // デフォルトは東京
            return { region: '東京都' };
        }
    },

    // イベントバインド
    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('brand-filter-btn')) {
                this.filterByBrand(e.target.dataset.brand);
            }
            if (e.target.classList.contains('prefecture-filter-btn')) {
                this.filterByPrefecture(e.target.dataset.prefecture);
            }
            if (e.target.closest('.view-switch-btn')) {
                this.switchView(e.target.closest('.view-switch-btn').dataset.view);
            }
            if (e.target.classList.contains('load-more-shops')) {
                this.loadMoreShops();
            }
        });
    },

    // レンダリング
    async render(params = []) {
        await this.init(); // renderの前にinitを完了させる
        const contentArea = document.getElementById('contentArea');
        
        contentArea.innerHTML = `
            <style>
                .stamp-rally-container {
                    padding: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .stamp-rally-header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                
                .stamp-rally-title {
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #d4a574;
                }
                
                .stamp-rally-subtitle {
                    color: #666;
                    font-size: 16px;
                }
                
                .stamp-stats {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                    margin-bottom: 30px;
                    flex-wrap: wrap;
                }
                
                .stat-card {
                    background: #f9f9f9;
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    min-width: 150px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                }
                
                .stat-number {
                    font-size: 32px;
                    font-weight: bold;
                    color: #d4a574;
                    margin-bottom: 5px;
                }
                
                .stat-label {
                    color: #666;
                    font-size: 14px;
                }
                
                .filter-section {
                    margin-bottom: 30px;
                }
                
                .filter-header {
                    margin-bottom: 15px;
                }
                
                .filter-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: #d4a574;
                }
                
                .brand-filters {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                
                .prefecture-filters {
                    background: #f9f9f9;
                    border-radius: 8px;
                    padding: 10px;
                    margin-bottom: 20px;
                }

                .region-details {
                    margin-bottom: 5px;
                }

                .region-summary {
                    font-weight: bold;
                    cursor: pointer;
                    padding: 5px;
                }

                .prefecture-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    padding: 10px;
                }
                
                .brand-filter-btn,
                .prefecture-filter-btn {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    color: #666;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                
                .brand-filter-btn:hover,
                .prefecture-filter-btn:hover {
                    background: #f5f5f5;
                }
                
                .brand-filter-btn.active,
                .prefecture-filter-btn.active {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: white;
                }
                
                .shops-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .shop-card {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
                    transition: all 0.2s;
                    border: 1px solid #e0e0e0;
                }
                
                .shop-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
                
                .shop-card-header {
                    padding: 15px;
                    border-bottom: 1px solid #f0f0f0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .shop-brand-indicator {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                
                .shop-name {
                    font-weight: bold;
                    font-size: 16px;
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .shop-card-body {
                    padding: 15px;
                }
                
                .shop-address {
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 10px;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                
                .shop-status {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                
                .checkin-status {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .checkin-status.checked {
                    background: #e8f5e8;
                    color: #2e7d32;
                }
                
                .checkin-status.unchecked {
                    background: #f5f5f5;
                    color: #666;
                }
                
                .shop-actions {
                    display: flex;
                    gap: 10px;
                }
                
                .shop-action-btn {
                    flex: 1;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }
                
                .checkin-btn {
                    background: #d4a574;
                    color: white;
                    border: none;
                }
                
                .checkin-btn:hover {
                    background: #c19663;
                }
                
                .checkin-btn:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }
                
                .detail-btn {
                    background: transparent;
                    color: #d4a574;
                    border: 1px solid #d4a574;
                }
                
                .detail-btn:hover {
                    background: rgba(212, 165, 116, 0.1);
                }
                
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                
                .load-more-container {
                    text-align: center;
                    margin: 20px 0;
                }
                
                .load-more-shops {
                    background: #d4a574;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s;
                }
                
                .load-more-shops:hover {
                    background: #c19663;
                }
                
                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: #666;
                }
                
                .empty-state i {
                    font-size: 48px;
                    margin-bottom: 16px;
                    color: #ccc;
                }
                
                .empty-state h3 {
                    margin-bottom: 8px;
                    color: #333;
                }

                .view-switcher {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 20px;
                    border: 1px solid #d4a574;
                    border-radius: 20px;
                    overflow: hidden;
                }

                .view-switch-btn {
                    padding: 10px 20px;
                    cursor: pointer;
                    border: none;
                    background-color: transparent;
                    color: #d4a574;
                    font-weight: bold;
                    transition: all 0.2s;
                }

                .view-switch-btn.active {
                    background-color: #d4a574;
                    color: white;
                }

                .progress-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 20px;
                }

                .progress-card {
                    background: #fff;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    border: 1px solid #e0e0e0;
                }

                .progress-card h4 {
                    margin-bottom: 15px;
                    color: #333;
                }

                .progress-bar-container {
                    background: #eee;
                    border-radius: 5px;
                    height: 10px;
                    margin: 10px 0;
                    overflow: hidden;
                }

                .progress-bar {
                    background: #d4a574;
                    height: 100%;
                    border-radius: 5px;
                    transition: width 0.5s ease-in-out;
                }
                
                .progress-card p {
                    text-align: right;
                    color: #666;
                    font-size: 14px;
                }

                /* Dark Mode Overrides */
                .dark-mode .stamp-rally-subtitle,
                .dark-mode .stat-label,
                .dark-mode .shop-address {
                    color: #aaa;
                }
                
                .dark-mode .stat-card {
                    background: #2a2a2a;
                }
                
                .dark-mode .shop-card {
                    background: #2a2a2a;
                    border-color: #333;
                }
                
                .dark-mode .shop-card-header {
                    border-bottom-color: #333;
                }
                
                .dark-mode .brand-filter-btn {
                    background: #2a2a2a;
                    border-color: #333;
                    color: #e0e0e0;
                }
                
                .dark-mode .brand-filter-btn:hover {
                    background: #333;
                }
                
                .dark-mode .checkin-status.unchecked {
                    background: #333;
                    color: #aaa;
                }
                
                .dark-mode .detail-btn {
                    color: #d4a574;
                    border-color: #d4a574;
                }
                
                .dark-mode .empty-state {
                    color: #aaa;
                }
                
                .dark-mode .empty-state h3 {
                    color: #e0e0e0;
                }
                
                .dark-mode .view-switcher {
                    border-color: #d4a574;
                }

                .dark-mode .view-switch-btn {
                    color: #d4a574;
                }

                .dark-mode .view-switch-btn.active {
                    background-color: #d4a574;
                    color: #1a1a1a;
                }

                .dark-mode .progress-card {
                    background: #2a2a2a;
                    border-color: #333;
                }

                .dark-mode .progress-card h4 {
                    color: #e0e0e0;
                }

                .dark-mode .progress-bar-container {
                    background: #333;
                }

                .dark-mode .progress-card p {
                    color: #aaa;
                }

                @media (max-width: 768px) {
                    .stamp-rally-container {
                        padding: 16px;
                    }
                    
                    .stamp-stats {
                        gap: 15px;
                    }
                    
                    .stat-card {
                        min-width: 120px;
                        padding: 15px;
                    }
                    
                    .stat-number {
                        font-size: 24px;
                    }
                    
                    .shops-grid {
                        grid-template-columns: 1fr;
                        gap: 15px;
                    }
                }
            </style>
            
            <div class="stamp-rally-container">
                <div class="stamp-rally-header">
                    <h1 class="stamp-rally-title">二郎スタンプラリー</h1>
                    <p class="stamp-rally-subtitle">訪問した店舗をチェックインしてスタンプを集めよう！</p>
                </div>

                <div class="view-switcher">
                    <button class="view-switch-btn ${this.state.currentView === 'list' ? 'active' : ''}" data-view="list">店舗リスト</button>
                    <button class="view-switch-btn ${this.state.currentView === 'progress' ? 'active' : ''}" data-view="progress">進捗マップ</button>
                </div>
                
                <div id="stampRallyContent">
                    ${this.state.currentView === 'list' ? this.renderListView() : this.renderProgressView()}
                </div>
            </div>
        `;

        // データを読み込み
        this.loadData();
    },

    // リストビューをレンダリング
    renderListView() {
        return `
            <div class="stamp-stats" id="stampStats">
                ${this.renderStats()}
            </div>

            <div class="filter-section">
                <div class="filter-header"><h3>ブランド</h3></div>
                <div class="brand-filters" id="brandFilters">
                    ${this.renderBrandFilters()}
                </div>
                <div class="filter-header"><h3>都道府県</h3></div>
                <div class="prefecture-filters" id="prefectureFilters">
                    ${this.renderPrefectureFilters()}
                </div>
            </div>

            <div class="shops-grid" id="shopsGrid">
                ${this.renderShopsGrid()}
            </div>
        `;
    },

    // 進捗ビューをレンダリング
    renderProgressView() {
        if (this.state.isLoading) {
            return '<div class="loading">進捗を読み込み中...</div>';
        }

        let progressHtml = '<div class="progress-grid">';
        this.state.progress.forEach(item => {
            const percentage = item.total_shops > 0 ? (item.visited_shops / item.total_shops) * 100 : 0;
            progressHtml += `
                <div class="progress-card">
                    <h4>${item.prefecture}</h4>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${percentage}%;"></div>
                    </div>
                    <p>${item.visited_shops} / ${item.total_shops} 店舗</p>
                </div>
            `;
        });
        progressHtml += '</div>';

        return progressHtml;
    },

    // 統計情報をレンダリング
    renderStats() {
        const totalShops = this.state.shops.length;
        const checkedShops = this.state.checkins.length;
        const completionRate = totalShops > 0 ? Math.round((checkedShops / totalShops) * 100) : 0;

        return `
            <div class="stat-card">
                <div class="stat-number">${totalShops}</div>
                <div class="stat-label">対象店舗</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${checkedShops}</div>
                <div class="stat-label">訪問済み</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${completionRate}%</div>
                <div class="stat-label">達成率</div>
            </div>
        `;
    },

    // ブランドフィルターをレンダリング
    renderBrandFilters() {
        let buttonsHtml = `
            <button class="brand-filter-btn ${this.state.selectedBrand === 'all' ? 'active' : ''}" data-brand="all">
                すべて
            </button>
        `;

        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            if (brandKey === 'other') continue;
            
            buttonsHtml += `
                <button class="brand-filter-btn ${this.state.selectedBrand === brandKey ? 'active' : ''}" data-brand="${brandKey}">
                    ${brandConfig.name}
                </button>
            `;
        }

        return buttonsHtml;
    },

    // 都道府県フィルターをレンダリング
    renderPrefectureFilters() {
        const regions = {
            '北海道': ['北海道'],
            '東北': ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
            '関東': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
            '中部': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
            '近畿': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
            '中国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
            '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
            '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']
        };

        let buttonsHtml = `
            <button class="prefecture-filter-btn ${this.state.selectedPrefecture === 'all' ? 'active' : ''}" data-prefecture="all">
                全国
            </button>
        `;

        for (const region in regions) {
            buttonsHtml += `
                <details class="region-details">
                    <summary class="region-summary">${region}</summary>
                    <div class="prefecture-buttons">
            `;
            regions[region].forEach(prefecture => {
                buttonsHtml += `
                    <button class="prefecture-filter-btn ${this.state.selectedPrefecture === prefecture ? 'active' : ''}" data-prefecture="${prefecture}">
                        ${prefecture}
                    </button>
                `;
            });
            buttonsHtml += `
                    </div>
                </details>
            `;
        }

        return buttonsHtml;
    },

    // 店舗グリッドをレンダリング
    renderShopsGrid() {
        if (this.state.isLoading) {
            return '<div class="loading">読み込み中...</div>';
        }

        if (this.state.shops.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-store"></i>
                    <h3>店舗が見つかりません</h3>
                    <p>条件を変更して再度お試しください</p>
                </div>
            `;
        }

        // ブランドと都道府県でフィルタリング
        let filteredShops = this.state.shops;
        
        // ブランドでフィルタリング
        if (this.state.selectedBrand !== 'all') {
            filteredShops = filteredShops.filter(shop => {
                const brand = this.determineBrand(shop.name);
                return brand === this.state.selectedBrand;
            });
        }
        
        return this.state.shops.map(shop => {
            const isChecked = this.state.checkins.some(checkin => checkin.shop_id === shop.id);
            const brand = this.determineBrand(shop.name);
            const brandConfig = this.BRAND_CONFIG[brand];

            return `
                <div class="shop-card">
                    <div class="shop-card-header">
                        <div class="shop-brand-indicator" style="background: ${brandConfig.color};"></div>
                        <div class="shop-name">${this.escapeHtml(shop.name)}</div>
                    </div>
                    <div class="shop-card-body">
                        <div class="shop-address">${this.escapeHtml(shop.address)}</div>
                        <div class="shop-status">
                            <div class="checkin-status ${isChecked ? 'checked' : 'unchecked'}">
                                <i class="fas ${isChecked ? 'fa-check-circle' : 'fa-circle'}"></i>
                                ${isChecked ? '訪問済み' : '未訪問'}
                            </div>
                        </div>
                        <div class="shop-actions">
                            <button class="shop-action-btn checkin-btn"
                                    data-shop-id="${shop.id}"
                                    data-checkin-type="manual"
                                    ${isChecked ? 'disabled' : ''}>
                                ${isChecked ? 'チェックイン済み' : 'チェックイン'}
                            </button>
                            <button class="shop-action-btn detail-btn" onclick="router.navigate('shop', [${shop.id}])">
                                詳細
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 店名からブランドを判定
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

    // ブランドでフィルタリング
    filterByBrand(brand) {
        this.state.selectedBrand = brand;
        
        // アクティブ状態を更新
        document.querySelectorAll('.brand-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.brand === brand) {
                btn.classList.add('active');
            }
        });
        
        // 再レンダリング
        const shopsGrid = document.getElementById('shopsGrid');
        if (shopsGrid) {
            shopsGrid.innerHTML = this.renderShopsGrid();
        }
    },

    // 都道府県でフィルタリング
    async filterByPrefecture(prefecture) {
        this.state.selectedPrefecture = prefecture;
        this.state.currentPage = 1;
        this.state.hasMoreShops = true;
        
        // アクティブ状態を更新
        document.querySelectorAll('.prefecture-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.prefecture === prefecture) {
                btn.classList.add('active');
            }
        });
        
        // 新しいデータで再読み込み
        await this.loadData();
    },

    // ビューを切り替え
    async switchView(view) {
        this.state.currentView = view;
        document.querySelector('.view-switch-btn.active').classList.remove('active');
        document.querySelector(`.view-switch-btn[data-view="${view}"]`).classList.add('active');
        await this.loadData();
    },

    // データを読み込み
    async loadData() {
        this.state.isLoading = true;
        this.updateUI();

        try {
            if (this.state.currentView === 'list') {
                const [shopsResponse, checkinsResponse] = await Promise.all([
                    this.loadShops(1, 20, this.state.selectedPrefecture),
                    this.loadCheckins()
                ]);
                this.state.shops = shopsResponse;
                this.state.checkins = checkinsResponse;
            } else {
                const data = await API.request('/api/v1/stamps/progress');
                this.state.progress = data.progress;
            }
            this.state.isLoading = false;
            this.updateUI();
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            this.state.isLoading = false;
            this.showError('データの読み込みに失敗しました');
        }
    },

    // 店舗データを読み込み
    async loadShops(page = 1, perPage = 20, prefecture = 'all') {
        try {
            let url = `/api/v1/ramen?page=${page}&per_page=${perPage}`;
            if (prefecture && prefecture !== 'all') {
                url += `&prefecture=${encodeURIComponent(prefecture)}`;
            }
            const data = await API.request(url, { includeAuth: false });
            return data.shops || [];
        } catch (error) {
            console.error('店舗データ読み込みエラー:', error);
            return [];
        }
    },

    // チェックインデータを読み込み
    async loadCheckins() {
        try {
            const token = API.getCookie('authToken');
            if (!token) {
                return [];
            }
            
            const user = JSON.parse(decodeURIComponent(API.getCookie('user')));
            const data = await API.request(`/api/v1/users/${user.id}/checkins`);
            return data.checkins || [];
        } catch (error) {
            console.error('チェックインデータ読み込みエラー:', error);
            return [];
        }
    },

    // さらに店舗を読み込み
    async loadMoreShops() {
        if (!this.state.hasMoreShops || this.state.isLoading) return;
        
        this.state.currentPage++;
        this.state.isLoading = true;
        
        try {
            const newShops = await this.loadShops(this.state.currentPage, 20, this.state.selectedPrefecture);
            
            if (newShops.length === 0) {
                this.state.hasMoreShops = false;
            } else {
                this.state.shops = [...this.state.shops, ...newShops];
                this.updateUI();
            }
            
            this.state.isLoading = false;
        } catch (error) {
            console.error('追加店舗読み込みエラー:', error);
            this.state.isLoading = false;
        }
    },

    // UIを更新
    updateUI() {
        const contentEl = document.getElementById('stampRallyContent');
        if (!contentEl) return;

        if (this.state.currentView === 'list') {
            contentEl.innerHTML = this.renderListView();
            // DOMが更新された後に再度要素を取得する
            const statsElement = document.getElementById('stampStats');
            if (statsElement) {
                statsElement.innerHTML = this.renderStats();
            }
            const shopsGridElement = document.getElementById('shopsGrid');
            if (shopsGridElement) {
                shopsGridElement.innerHTML = this.renderShopsGrid();
            }
        } else {
            contentEl.innerHTML = this.renderProgressView();
        }
    },

    // エラー表示
    showError(message) {
        const shopsGrid = document.getElementById('shopsGrid');
        if (shopsGrid) {
            shopsGrid.innerHTML = `
                <div class="error">
                    <p>${message}</p>
                    <button onclick="StampRallyComponent.loadData()" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        再読み込み
                    </button>
                </div>
            `;
        }
    },

    // HTMLエスケープ処理
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// コンポーネントをルーターに登録
router.register('stamp-rally', StampRallyComponent);