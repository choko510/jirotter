// 検索コンポーネント
// 責務: 店舗の検索機能を提供し、選択された店舗情報をコールバックで返す
const SearchComponent = {
    // state: コンポーネントの状態を管理
    state: {
        searchQuery: '', // 検索クエリ
        searchResults: [], // 検索結果
        isModalOpen: false, // モーダルの開閉状態
        onSelect: null, // 店舗が選択されたときに呼び出されるコールバック関数
    },

    // openModal: 検索モーダルを開く
    // @param {function} onSelect - 店舗が選択されたときに呼び出すコールバック
    openModal(onSelect) {
        this.state.onSelect = onSelect;
        this.state.isModalOpen = true;
        this.renderModal();
        this.setupEventListeners();
        this.findNearbyShops();
    },

    // closeModal: モーダルを閉じる
    closeModal() {
        this.state.isModalOpen = false;
        const modal = document.querySelector('.search-modal-overlay');
        if (modal) {
            modal.remove(); // DOMからモーダルを削除
        }
    },

    // renderModal: モーダルウィンドウのHTMLを生成して表示
    renderModal() {
        const modal = document.createElement('div');
        modal.className = 'search-modal-overlay';
        modal.innerHTML = `
            <div class="search-modal">
                <div class="search-modal-header">
                    <h3>店舗を検索</h3>
                    <button class="close-modal" onclick="SearchComponent.closeModal()">&times;</button>
                </div>
                <div class="search-modal-content">
                    <div class="search-bar">
                        <input type="text" id="searchInput" placeholder="店名や場所で検索...">
                        <button id="searchBtn"><i class="fas fa-search"></i></button>
                    </div>
                    <div class="search-results" id="searchResults">
                        <div class="loading">近くの店舗を検索中...</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // setupEventListeners: イベントリスナー（入力、クリック）を設定
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');

        // 検索入力のデバウンス処理
        searchInput.addEventListener('input', this.debounce(this.handleSearchInput.bind(this), 300));
        searchBtn.addEventListener('click', this.handleSearch.bind(this));
    },

    // debounce: 指定された時間、関数の実行を遅らせるユーティリティ
    debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    },

    // handleSearchInput: 検索入力イベントのハンドラ
    handleSearchInput(e) {
        this.state.searchQuery = e.target.value;
        // 2文字以上入力されたら検索を実行
        if (this.state.searchQuery.length > 1) {
            this.searchShops();
        }
    },

    // handleSearch: 検索ボタンクリックイベントのハンドラ
    handleSearch() {
        this.state.searchQuery = document.getElementById('searchInput').value;
        this.searchShops();
    },

    // getLocationFromIP: IPアドレスを基に現在地を取得
    async getLocationFromIP() {
        try {
            const response = await fetch('https://ipinfo.io/json');
            if (!response.ok) throw new Error('Failed to get location');
            const data = await response.json();
            const [lat, lng] = data.loc.split(',');
            return { lat: parseFloat(lat), lng: parseFloat(lng) };
        } catch (error) {
            console.error('Error getting location from IP:', error);
            // デフォルトは東京駅
            return { lat: 35.681236, lng: 139.767125 };
        }
    },

    // findNearbyShops: 現在地周辺の店舗を検索
    async findNearbyShops() {
        const location = await this.getLocationFromIP();
        try {
            // API経由で周辺店舗を取得 (半径5km)
            const shops = await API.getShops('', { latitude: location.lat, longitude: location.lng, radius_km: 5 });
            this.state.searchResults = shops;
            this.renderResults();
        } catch (error) {
            console.error('Error finding nearby shops:', error);
            this.renderError('近くの店舗の検索に失敗しました。');
        }
    },

    // searchShops: クエリに基づいて店舗を検索
    async searchShops() {
        if (!this.state.searchQuery) return;
        this.showLoading();
        try {
            const shops = await API.getShops(this.state.searchQuery);
            this.state.searchResults = shops;
            this.renderResults();
        } catch (error) {
            console.error('Error searching shops:', error);
            this.renderError('店舗の検索に失敗しました。');
        }
    },

    // renderResults: 検索結果をDOMに描画
    renderResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (this.state.searchResults.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">店舗が見つかりませんでした。</div>';
            return;
        }

        // 検索結果の各店舗をリストアイテムとして表示
        resultsContainer.innerHTML = this.state.searchResults.map(shop => `
            <div class="result-item" data-shop-id="${shop.id}">
                <div class="shop-name">${API.escapeHtml(shop.name)}</div>
                <div class="shop-address">${API.escapeHtml(shop.address)}</div>
                ${shop.distance ? `<div class="shop-distance">約${Math.round(shop.distance)}km</div>` : ''}
            </div>
        `).join('');

        // 各結果アイテムにクリックイベントを設定
        resultsContainer.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                const shopId = parseInt(item.dataset.shopId, 10);
                const selectedShop = this.state.searchResults.find(s => s.id === shopId);
                // 選択された店舗をコールバックで通知
                if (this.state.onSelect) {
                    this.state.onSelect(selectedShop);
                }
                this.closeModal();
            });
        });
    },

    // showLoading: ローディングインジケータを表示
    showLoading() {
        document.getElementById('searchResults').innerHTML = '<div class="loading">検索中...</div>';
    },

    // renderError: エラーメッセージを表示
    renderError(message) {
        document.getElementById('searchResults').innerHTML = `<div class="error">${message}</div>`;
    }
};
window.SearchComponent = SearchComponent;
