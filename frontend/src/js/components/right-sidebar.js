// 右サイドバーコンポーネント
const RightSidebar = {
    // state: コンポーネントの状態を管理
    state: {
        rankingShops: [], // ランキングデータ
        searchQuery: '', // 検索クエリ
        searchResults: [], // 検索結果
        activeFilters: {
            prefecture: null,
            category: null,
            period: 'weekly' // default
        },
        activeDropdown: null // 'prefecture', 'category', 'period' or null
    },

    filterOptions: {
        prefecture: ['東京都', '神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県', '大阪府', '京都府', '愛知県', '北海道', '福岡県', 'その他'],
        category: [
            { label: 'すべて', value: null },
            { label: '直系', value: 'jiro' },
            { label: 'インスパイア', value: 'inspire' }
        ],
        period: [
            { label: '週間', value: 'weekly' },
            { label: '月間', value: 'monthly' },
            { label: '全期間', value: 'all' }
        ]
    },

    // init: コンポーネントの初期化
    init() {
        this.fetchRanking();
        this.setupEventListeners();

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-btn') && !e.target.closest('.filter-dropdown')) {
                this.closeAllDropdowns();
            }
        });
    },

    // setupEventListeners: イベントリスナーを設定
    setupEventListeners() {
        // 検索入力はグローバル検索に移行したため、ここでのリスナーは不要
        // const searchInput = document.getElementById('searchInput');
        // if (searchInput) {
        //     searchInput.addEventListener('input', this.debounce(this.handleSearchInput.bind(this), 300));
        // }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const filterType = e.target.closest('.filter-btn').dataset.filter;
                this.toggleFilterDropdown(filterType, e.target.closest('.filter-btn'));
            });
        });
    },

    // debounce: 関数の実行を遅延させる
    debounce(func, delay) {
        let timeout;
        return function (...args) {
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

    toggleFilterDropdown(type, btnElement) {
        // If already open, close it
        if (this.state.activeDropdown === type) {
            this.closeAllDropdowns();
            return;
        }

        this.closeAllDropdowns();
        this.state.activeDropdown = type;

        // Create and show dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'filter-dropdown';

        let options = [];
        if (type === 'prefecture') {
            options = [{ label: '指定なし', value: null }, ...this.filterOptions.prefecture.map(p => ({ label: p, value: p }))];
        } else {
            options = this.filterOptions[type];
        }

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = `filter-option ${this.state.activeFilters[type] === opt.value ? 'active' : ''}`;
            item.textContent = opt.label;
            item.onclick = (e) => {
                e.stopPropagation();
                this.selectFilter(type, opt.value);
            };
            dropdown.appendChild(item);
        });

        btnElement.appendChild(dropdown);
    },

    closeAllDropdowns() {
        document.querySelectorAll('.filter-dropdown').forEach(el => el.remove());
        this.state.activeDropdown = null;
    },

    selectFilter(type, value) {
        this.state.activeFilters[type] = value;
        this.closeAllDropdowns();

        // Update button style
        const btn = document.querySelector(`.filter-btn[data-filter="${type}"]`);
        if (btn) {
            if (value && value !== 'weekly') { // Highlight if not default or null
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }

        // Refresh data
        if (this.state.searchQuery.length > 1) {
            this.searchShops();
        } else {
            this.fetchRanking();
        }
    },

    // fetchRanking: ランキングを取得
    async fetchRanking() {
        try {
            const { period, prefecture, category } = this.state.activeFilters;
            const params = new URLSearchParams();
            if (period) params.append('period', period);
            if (prefecture) params.append('prefecture', prefecture);
            if (category) params.append('category', category);

            const data = await API.request(`/api/v1/ramen/ranking?${params.toString()}`, { includeAuth: false });
            this.state.rankingShops = data.shops || [];
            this.renderRanking();
        } catch (error) {
            console.error(error);
            this.renderError('ランキングの表示に失敗しました。');
        }
    },

    // searchShops: 店舗を検索
    async searchShops() {
        try {
            const filters = {
                prefecture: this.state.activeFilters.prefecture,
                category: this.state.activeFilters.category
            };
            const shops = await API.getShops(this.state.searchQuery, filters);
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
            const periodLabels = { weekly: '過去1週間', monthly: '過去1月間', all: '全期間' };
            let headerText = periodLabels[this.state.activeFilters.period] || '過去1週間';
            if (this.state.activeFilters.prefecture) headerText += ` (${this.state.activeFilters.prefecture})`;
            resultsHeader.textContent = headerText;
        }
        if (shopList) {
            if (this.state.rankingShops.length === 0) {
                shopList.innerHTML = '<div class="no-results" style="padding: 16px; text-align: center; color: var(--color-muted);">ランキングデータがありません。</div>';
                return;
            }
            shopList.innerHTML = this.state.rankingShops.map((shop, index) => `
                <div class="result-item" onclick="router.navigate('shop', [${shop.id}])" style="padding: 12px 16px; border-bottom: 1px solid rgba(231, 220, 205, 0.4); cursor: pointer; transition: background 0.2s;">
                    <div class="shop-name" style="font-weight: bold; margin-bottom: 4px;">
                        <span style="display: inline-block; width: 24px; height: 24px; background: ${index < 3 ? 'var(--color-primary)' : '#ccc'}; color: #fff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 0.8rem; margin-right: 8px;">${index + 1}</span>
                        ${API.escapeHtml(shop.name)}
                    </div>
                    <div class="shop-address" style="font-size: 0.85rem; color: var(--color-muted); padding-left: 32px;">${API.escapeHtml(shop.address)}</div>
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
                shopList.innerHTML = '<div class="no-results" style="padding: 16px; text-align: center; color: var(--color-muted);">店舗が見つかりませんでした。</div>';
                return;
            }
            shopList.innerHTML = this.state.searchResults.map(shop => `
                <div class="result-item" onclick="router.navigate('shop', [${shop.id}])" style="padding: 12px 16px; border-bottom: 1px solid rgba(231, 220, 205, 0.4); cursor: pointer; transition: background 0.2s;">
                    <div class="shop-name" style="font-weight: bold; margin-bottom: 4px;">${API.escapeHtml(shop.name)}</div>
                    <div class="shop-address" style="font-size: 0.85rem; color: var(--color-muted);">${API.escapeHtml(shop.address)}</div>
                </div>
            `).join('');
        }
    },

    // renderError: エラーメッセージをレンダリング
    renderError(message) {
        const shopList = document.getElementById('shopList');
        if (shopList) {
            shopList.innerHTML = `<div class="error" style="padding: 16px; text-align: center; color: #d32f2f; font-size: 0.9rem;">${message}</div>`;
        }
    }
};
window.RightSidebar = RightSidebar;
