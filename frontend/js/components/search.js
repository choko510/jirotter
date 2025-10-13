// 検索コンポーネント
const SearchComponent = {
    // 状態管理
    state: {
        searchQuery: '',
        filters: {
            prefecture: null,
            category: null,
            period: '過去1週間'
        },
        shops: [],
        isLoading: false
    },

    // レンダリング
    render(params = []) {
        const contentArea = document.getElementById('contentArea');
        
        // CSSの動的読み込み
        Utils.loadCSS('search');

        // 検索ページのHTMLを生成
        contentArea.innerHTML = `
            <div class="search-container">
                <div class="search-header">
                    <h1 class="search-title">店舗検索</h1>
                    
                    <div class="search-input-wrapper">
                        <span class="search-icon-large"><i class="fas fa-search"></i></span>
                        <input 
                            type="text" 
                            class="search-input-large" 
                            placeholder="店名や住所を検索..." 
                            id="searchInput"
                            value="${this.state.searchQuery}"
                        >
                    </div>
                </div>

                <div class="filters-section">
                    <div class="filters-title">フィルター</div>
                    <div class="filter-options">
                        <button class="filter-option ${this.state.filters.prefecture ? 'active' : ''}" data-filter="prefecture">
                            都道府県
                        </button>
                        <button class="filter-option ${this.state.filters.category ? 'active' : ''}" data-filter="category">
                            種類
                        </button>
                        <button class="filter-option ${this.state.filters.period ? 'active' : ''}" data-filter="period">
                            期間
                        </button>
                    </div>
                </div>

                <div class="search-results">
                    <div class="results-header">
                        <div class="results-title">検索結果</div>
                        <div class="results-count" id="resultsCount">
                            ${this.state.isLoading ? '検索中...' : `${this.state.shops.length}件`}
                        </div>
                    </div>
                    
                    <div class="shop-list" id="shopList">
                        ${this.renderShopList()}
                    </div>
                </div>
            </div>
        `;

        // イベントリスナーを設定
        this.bindEvents();
        
        // 検索を実行
        if (this.state.shops.length === 0) {
            this.performSearch();
        }
    },

    // 店舗リストのレンダリング
    renderShopList() {
        if (this.state.isLoading) {
            return '<div class="loading">検索中...</div>';
        }
        
        if (this.state.shops.length === 0) {
            return `
                <div class="no-results">
                    <div class="no-results-icon"><i class="fas fa-bowl-food"></i></div>
                    <p>条件に一致する店舗が見つかりませんでした</p>
                    <p>検索条件を変更して再度お試しください</p>
                </div>
            `;
        }

        return this.state.shops.map(shop => `
            <div class="shop-card" onclick="SearchComponent.showShopDetail(${shop.id})">
                <div class="shop-header">
                    <div class="shop-name">${shop.name}</div>
                    <div class="shop-rating">⭐${shop.rating.toFixed(1)}</div>
                </div>
                <div class="shop-category">${shop.category}</div>
                <div class="shop-details">
                    <div class="shop-reviews">${shop.reviews}件のレビュー</div>
                    <button class="shop-action" onclick="event.stopPropagation(); SearchComponent.showShopDetail(${shop.id})">
                        詳細を見る
                    </button>
                </div>
            </div>
        `).join('');
    },

    // イベントバインド
    bindEvents() {
        // 検索入力
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchQuery = e.target.value;
                // デバウンス処理
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.performSearch();
                }, 500);
            });
        }

        // フィルターボタン
        document.querySelectorAll('.filter-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterType = e.target.dataset.filter;
                this.toggleFilter(filterType, e.target);
            });
        });
    },

    // 検索実行
    async performSearch() {
        this.state.isLoading = true;
        this.updateResultsCount('検索中...');
        
        try {
            const shops = await API.getShops(this.state.searchQuery, this.state.filters);
            this.state.shops = shops;
            this.renderShopList();
            this.updateResultsCount(`${shops.length}件`);
        } catch (error) {
            console.error('検索に失敗しました:', error);
            this.renderError();
        } finally {
            this.state.isLoading = false;
        }
    },

    // フィルター切り替え
    toggleFilter(filterType, buttonElement) {
        buttonElement.classList.toggle('active');
        
        // フィルター選択モーダルを開く（簡易実装）
        alert(`${filterType}フィルター選択機能は現在開発中です`);
        
        // 実際の実装では、ここでフィルター選択UIを表示し、
        // 選択結果に基づいて検索を再実行する
    },

    // 結果件数の更新
    updateResultsCount(count) {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.textContent = count;
        }
    },

    // 店舗詳細表示
    showShopDetail(shopId) {
        router.navigate('shop', [shopId]);
    },

    // エラー表示
    renderError() {
        const shopList = document.getElementById('shopList');
        if (shopList) {
            shopList.innerHTML = `
                <div class="error">
                    <p>検索中にエラーが発生しました</p>
                    <button onclick="SearchComponent.performSearch()" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        再試行
                    </button>
                </div>
            `;
        }
    }
};

// コンポーネントをルーターに登録
router.register('search', SearchComponent);