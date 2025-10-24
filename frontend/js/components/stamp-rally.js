// スタンプラリーコンポーネント
const StampRallyComponent = {
    // 状態管理
    state: {
        shops: [],
        checkins: [],
        isLoading: false,
        currentPage: 1,
        hasMoreShops: true,
        selectedBrand: 'all'
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
    init() {
        this.bindEvents();
    },

    // イベントバインド
    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('brand-filter-btn')) {
                this.filterByBrand(e.target.dataset.brand);
            }
            if (e.target.classList.contains('load-more-shops')) {
                this.loadMoreShops();
            }
        });
    },

    // レンダリング
    async render(params = []) {
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
                
                .brand-filters {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 30px;
                    flex-wrap: wrap;
                }
                
                .brand-filter-btn {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    color: #666;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                
                .brand-filter-btn:hover {
                    background: #f5f5f5;
                }
                
                .brand-filter-btn.active {
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
                
                <div class="stamp-stats" id="stampStats">
                    ${this.renderStats()}
                </div>
                
                <div class="brand-filters" id="brandFilters">
                    ${this.renderBrandFilters()}
                </div>
                
                <div class="shops-grid" id="shopsGrid">
                    ${this.renderShopsGrid()}
                </div>
                
                <div class="load-more-container" id="loadMoreContainer">
                    ${this.state.hasMoreShops ? '<button class="load-more-shops">もっと見る</button>' : ''}
                </div>
            </div>
        `;

        // データを読み込み
        this.loadData();
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

        // ブランドでフィルタリング
        let filteredShops = this.state.shops;
        if (this.state.selectedBrand !== 'all') {
            filteredShops = this.state.shops.filter(shop => {
                const brand = this.determineBrand(shop.name);
                return brand === this.state.selectedBrand;
            });
        }

        return filteredShops.map(shop => {
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

    // データを読み込み
    async loadData() {
        this.state.isLoading = true;
        
        try {
            // 店舗データとチェックインデータを並行して取得
            const [shopsResponse, checkinsResponse] = await Promise.all([
                this.loadShops(),
                this.loadCheckins()
            ]);
            
            this.state.shops = shopsResponse;
            this.state.checkins = checkinsResponse;
            this.state.isLoading = false;
            
            // UIを更新
            this.updateUI();
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            this.state.isLoading = false;
            this.showError('データの読み込みに失敗しました');
        }
    },

    // 店舗データを読み込み
    async loadShops(page = 1, perPage = 20) {
        try {
            const response = await fetch(`/api/v1/ramen?page=${page}&per_page=${perPage}`);
            
            if (!response.ok) {
                throw new Error('店舗データの取得に失敗しました');
            }
            
            const data = await response.json();
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
            const response = await fetch(`/api/v1/users/${user.id}/checkins`, {
                headers: API.getAuthHeader()
            });
            
            if (!response.ok) {
                throw new Error('チェックインデータの取得に失敗しました');
            }
            
            const data = await response.json();
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
            const newShops = await this.loadShops(this.state.currentPage);
            
            if (newShops.length === 0) {
                this.state.hasMoreShops = false;
            } else {
                this.state.shops = [...this.state.shops, ...newShops];
                this.updateUI();
            }
            
            this.state.isLoading = false;
            
            // もっと見るボタンを更新
            const loadMoreContainer = document.getElementById('loadMoreContainer');
            if (loadMoreContainer) {
                loadMoreContainer.innerHTML = this.state.hasMoreShops ? 
                    '<button class="load-more-shops">もっと見る</button>' : '';
            }
        } catch (error) {
            console.error('追加店舗読み込みエラー:', error);
            this.state.isLoading = false;
        }
    },

    // UIを更新
    updateUI() {
        // 統計情報を更新
        const statsElement = document.getElementById('stampStats');
        if (statsElement) {
            statsElement.innerHTML = this.renderStats();
        }
        
        // 店舗グリッドを更新
        const shopsGridElement = document.getElementById('shopsGrid');
        if (shopsGridElement) {
            shopsGridElement.innerHTML = this.renderShopsGrid();
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