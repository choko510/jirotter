// 右サイドバーコンポーネント
const RightSidebar = {
    // state: コンポーネントの状態を管理
    state: {
        rankingShops: [], // ランキングデータ
        searchQuery: '', // 検索クエリ
        searchResults: [], // 検索結果
    },

    // init: コンポーネントの初期化
    init() {
        this.fetchRanking();
        this.setupEventListeners();
    },

    // setupEventListeners: イベントリスナーを設定
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(this.handleSearchInput.bind(this), 300));
        }
    },

    // debounce: 関数の実行を遅延させる
    debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    },

    // handleSearchInput: 検索入力のハンドラ
    handleSearchInput(e) {
        this.state.searchQuery = e.target.value;
        if (this.state.searchQuery.length > 1) {
            this.searchShops();
        } else {
            // 検索クエリが短い場合はランキングを再表示
            this.renderRanking();
        }
    },

    // fetchRanking: 週間チェックインランキングを取得
    async fetchRanking() {
        try {
            const data = await API.request('/api/v1/ramen/ranking', { includeAuth: false });
            this.state.rankingShops = data.shops;
            this.renderRanking();
        } catch (error) {
            console.error(error);
            this.renderError('ランキングの表示に失敗しました。');
        }
    },

    // searchShops: 店舗を検索
    async searchShops() {
        try {
            const shops = await API.getShops(this.state.searchQuery);
            this.state.searchResults = shops;
            this.renderSearchResults();
        } catch (error) {
            console.error('店舗の検索に失敗しました:', error);
            this.renderError('検索に失敗しました。');
        }
    },

    // renderRanking: ランキングをレンダリング
    renderRanking() {
        const shopList = document.getElementById('shopList');
        const resultsHeader = document.querySelector('.results-header');
        if (resultsHeader) {
            resultsHeader.textContent = '過去1週間';
        }
        if (shopList) {
            if (this.state.rankingShops.length === 0) {
                shopList.innerHTML = '<div class="no-results">ランキングデータがありません。</div>';
                return;
            }
            shopList.innerHTML = this.state.rankingShops.map(shop => `
                <div class="result-item" onclick="router.navigate('shop', [${shop.id}])">
                    <div class="shop-name">${API.escapeHtml(shop.name)}</div>
                    <div class="shop-address">${API.escapeHtml(shop.address)}</div>
                </div>
            `).join('');
        }
    },

    // renderSearchResults: 検索結果をレンダリング
    renderSearchResults() {
        const shopList = document.getElementById('shopList');
        const resultsHeader = document.querySelector('.results-header');
        if (resultsHeader) {
            resultsHeader.textContent = '検索結果';
        }

        if (shopList) {
            if (this.state.searchResults.length === 0) {
                shopList.innerHTML = '<div class="no-results">店舗が見つかりませんでした。</div>';
                return;
            }
            shopList.innerHTML = this.state.searchResults.map(shop => `
                <div class="result-item" onclick="router.navigate('shop', [${shop.id}])">
                    <div class="shop-name">${API.escapeHtml(shop.name)}</div>
                    <div class="shop-address">${API.escapeHtml(shop.address)}</div>
                </div>
            `).join('');
        }
    },

    // renderError: エラーメッセージをレンダリング
    renderError(message) {
        const shopList = document.getElementById('shopList');
        if (shopList) {
            shopList.innerHTML = `<div class="error">${message}</div>`;
        }
    }
};
