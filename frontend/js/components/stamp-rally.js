// スタンプラリーコンポーネント
const StampRallyComponent = {
    // 状態管理
    state: {
        shops: [],
        totalShops: 0,
        checkins: [],
        visits: [],
        progress: [],
        visitedShops: [], // 新規追加：訪問済み店舗データ
        isLoading: false,
        currentPage: 1,
        hasMoreShops: true,
        isLoadingMore: false,
        selectedBrand: 'all',
        selectedPrefecture: 'all',
        currentView: 'list', // 'list', 'progress', or 'visited'
        progressMessage: '',
        visitedMessage: '' // 新規追加：訪問済み店舗のエラーメッセージ
    },

    REGION_PREFECTURES: {
        '北海道': ['北海道'],
        '東北': ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
        '関東': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
        '中部': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
        '近畿': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
        '中国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
        '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
        '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']
    },

    // ブランド設定（MapComponentと共通）
    BRAND_CONFIG: {
        butayama: { name: '豚山', color: '#fcd700ff', keywords: ['豚山'] },
        ramenso: { name: 'ラーメン荘', color: '#3498db', keywords: ['ラーメン荘'] },
        rakeiko: { name: 'ら・けいこ', color: '#2ecc71', keywords: ['ら・けいこ'] },
        ahare: { name: '麺屋あっ晴れ', color: '#e74c3c', keywords: ['あっ晴れ'] },
        tachikawa: { name: '立川マシマシ', color: '#9b59b6', keywords: ['立川マシマシ'] },
        tsukemensha: { name: 'つけめん舎', color: '#1abc9c', keywords: ['つけめん舎'] },
        jiro: { name: '直系二郎', color: 'var(--color-primary)', keywords: ['ラーメン二郎'] },
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
            <div class="stamp-rally-container">
                <div class="stamp-rally-header">
                    <h1 class="stamp-rally-title">二郎スタンプラリー</h1>
                    <p class="stamp-rally-subtitle">訪問した店舗をチェックインしてスタンプを集めよう！</p>
                </div>

                <div class="view-switcher">
                    <button class="view-switch-btn ${this.state.currentView === 'list' ? 'active' : ''}" data-view="list">店舗リスト</button>
                    <button class="view-switch-btn ${this.state.currentView === 'progress' ? 'active' : ''}" data-view="progress">進捗マップ</button>
                    <button class="view-switch-btn ${this.state.currentView === 'visited' ? 'active' : ''}" data-view="visited">訪問済み</button>
                </div>

                <div id="stampRallyContent">
                    ${this.state.currentView === 'list' ? this.renderListView() :
                      this.state.currentView === 'progress' ? this.renderProgressView() :
                      this.renderVisitedView()}
                </div>
            </div>
        `;


        // データを読み込み
        this.loadData();
    },

    // リストビューをレンダリング
    renderListView() {
        const totalShops = this.state.totalShops || this.state.shops.length;
        const displayedShops = this.state.shops.length;
        const progressLabel = totalShops
            ? `表示中 ${Math.min(displayedShops, totalShops)} / ${totalShops} 店舗`
            : displayedShops > 0
                ? `表示中 ${displayedShops} 店舗`
                : '';
        const loadMoreButton = this.state.hasMoreShops
            ? `<button type="button" class="load-more-shops" ${this.state.isLoadingMore ? 'disabled' : ''}>${this.state.isLoadingMore ? '読み込み中…' : 'さらに表示'}</button>`
            : '';
        const loadMoreSection = (progressLabel || loadMoreButton)
            ? `
            <div class="load-more-container">
                ${progressLabel ? `<div class="load-more-status">${progressLabel}</div>` : ''}
                ${loadMoreButton}
            </div>`
            : '';

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
            ${loadMoreSection}
        `;
    },

    // 進捗ビューをレンダリング
    renderProgressView() {
        if (this.state.isLoading) {
            return '<div class="loading">進捗を読み込み中...</div>';
        }

        if (this.state.progressMessage) {
            return `
                <div class="empty-state">
                    <i class="fas fa-info-circle"></i>
                    <h3>進捗を表示できません</h3>
                    <p>${this.escapeHtml(this.state.progressMessage)}</p>
                </div>
            `;
        }

        if (this.state.progress.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-chart-line"></i>
                    <h3>進捗データがありません</h3>
                    <p>チェックインを行うと進捗が表示されます</p>
                </div>
            `;
        }

        const assignedPrefectures = new Set();
        let progressHtml = '<div class="progress-accordion">';
        for (const [region, prefectures] of Object.entries(this.REGION_PREFECTURES)) {
            const regionItems = this.state.progress.filter(item => prefectures.includes(item.prefecture));
            if (regionItems.length === 0) continue;

            regionItems.forEach(item => assignedPrefectures.add(item.prefecture));

            const regionVisited = regionItems.reduce((sum, item) => sum + item.visited_shops, 0);
            const regionTotal = regionItems.reduce((sum, item) => sum + item.total_shops, 0);

            progressHtml += `
                <details class="region-progress-details" open>
                    <summary class="region-progress-summary">
                        <span>${this.escapeHtml(region)}</span>
                        <span>${regionVisited} / ${regionTotal} 店舗</span>
                    </summary>
                    <div class="progress-grid">
                        ${regionItems.map(item => {
                            const percentage = item.total_shops > 0 ? (item.visited_shops / item.total_shops) * 100 : 0;
                            return `
                                <div class="progress-card">
                                    <h4>${this.escapeHtml(item.prefecture)}</h4>
                                    <div class="progress-bar-container">
                                        <div class="progress-bar" style="width: ${percentage}%;"></div>
                                    </div>
                                    <p>${item.visited_shops} / ${item.total_shops} 店舗</p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </details>
            `;
        }

        const remainingItems = this.state.progress.filter(item => !assignedPrefectures.has(item.prefecture));
        if (remainingItems.length > 0) {
            const regionVisited = remainingItems.reduce((sum, item) => sum + item.visited_shops, 0);
            const regionTotal = remainingItems.reduce((sum, item) => sum + item.total_shops, 0);

            progressHtml += `
                <details class="region-progress-details" open>
                    <summary class="region-progress-summary">
                        <span>その他</span>
                        <span>${regionVisited} / ${regionTotal} 店舗</span>
                    </summary>
                    <div class="progress-grid">
                        ${remainingItems.map(item => {
                            const percentage = item.total_shops > 0 ? (item.visited_shops / item.total_shops) * 100 : 0;
                            return `
                                <div class="progress-card">
                                    <h4>${this.escapeHtml(item.prefecture)}</h4>
                                    <div class="progress-bar-container">
                                        <div class="progress-bar" style="width: ${percentage}%;"></div>
                                    </div>
                                    <p>${item.visited_shops} / ${item.total_shops} 店舗</p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </details>
            `;
        }
        progressHtml += '</div>';

        return progressHtml;
    },

    // 訪問済みビューをレンダリング
    renderVisitedView() {
        if (this.state.isLoading) {
            return '<div class="loading">訪問済み店舗を読み込み中...</div>';
        }

        if (this.state.visitedMessage) {
            return `
                <div class="empty-state">
                    <i class="fas fa-info-circle"></i>
                    <h3>訪問済み店舗を表示できません</h3>
                    <p>${this.escapeHtml(this.state.visitedMessage)}</p>
                </div>
            `;
        }

        if (this.state.visitedShops.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-map-marked-alt"></i>
                    <h3>訪問済み店舗がありません</h3>
                    <p>チェックインを行うと訪問済み店舗が表示されます</p>
                </div>
            `;
        }

        let visitedHtml = '<div class="visited-accordion">';
        for (const prefectureData of this.state.visitedShops) {
            visitedHtml += `
                <details class="prefecture-visited-details" open>
                    <summary class="prefecture-visited-summary">
                        <span>${this.escapeHtml(prefectureData.prefecture)}</span>
                        <span>${prefectureData.shops.length} 店舗</span>
                    </summary>
                    <div class="visited-shops-grid">
                        ${prefectureData.shops.map(shop => this.renderVisitedShopCard(shop)).join('')}
                    </div>
                </details>
            `;
        }
        visitedHtml += '</div>';

        return visitedHtml;
    },

    // 訪問済み店舗カードをレンダリング
    renderVisitedShopCard(shop) {
        const brand = this.determineBrand(shop.name);
        const brandConfig = this.BRAND_CONFIG[brand];
        const checkinDate = new Date(shop.checkin_date);
        const formattedDate = `${checkinDate.getFullYear()}年${checkinDate.getMonth() + 1}月${checkinDate.getDate()}日`;

        return `
            <div class="shop-card visited-shop-card">
                <div class="shop-card-header">
                    <div class="shop-brand-indicator" style="background: ${brandConfig.color};"></div>
                    <div class="shop-name">${this.escapeHtml(shop.name)}</div>
                </div>
                <div class="shop-card-body">
                    <div class="shop-address">${this.escapeHtml(shop.address)}</div>
                    <div class="shop-checkin-date">
                        <i class="fas fa-calendar-check"></i>
                        訪問日: ${formattedDate}
                    </div>
                    ${shop.visit_images && shop.visit_images.length > 0 ? `
                    <div class="shop-visit-images">
                        ${shop.visit_images.map((imageUrl, index) => `
                            <div class="shop-visit-image">
                                <img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(shop.name)}の訪問写真${shop.visit_images.length > 1 ? index + 1 : ''}">
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                    <div class="shop-actions">
                        <button class="shop-action-btn detail-btn" onclick="router.navigate('shop', [${shop.id}])">
                            詳細
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // 統計情報をレンダリング
    renderStats() {
        const totalShops = this.state.totalShops || this.state.shops.length;
        const checkedShops = Array.isArray(this.state.checkins)
            ? new Set(this.state.checkins.map(checkin => checkin.shop_id)).size
            : 0;
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
        let buttonsHtml = `
            <button class="prefecture-filter-btn ${this.state.selectedPrefecture === 'all' ? 'active' : ''}" data-prefecture="all">
                全国
            </button>
        `;

        for (const region in this.REGION_PREFECTURES) {
            const shouldOpen = this.state.selectedPrefecture === 'all'
                ? region === '関東'
                : this.REGION_PREFECTURES[region].includes(this.state.selectedPrefecture);

            buttonsHtml += `
                <details class="region-details"${shouldOpen ? ' open' : ''}>
                    <summary class="region-summary">${this.escapeHtml(region)}</summary>
                    <div class="prefecture-buttons">
            `;
            this.REGION_PREFECTURES[region].forEach(prefecture => {
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

    // 指定した店舗の訪問画像一覧を取得
    getVisitImagesForShop(shopId, limit = 4) {
        if (!Array.isArray(this.state.visits) || this.state.visits.length === 0) {
            return [];
        }

        const images = [];
        const seen = new Set();

        for (const visit of this.state.visits) {
            if (visit.shop_id === shopId && visit.image_url && !seen.has(visit.image_url)) {
                seen.add(visit.image_url);
                images.push(visit.image_url);
                if (images.length >= limit) {
                    break;
                }
            }
        }

        return images;
    },

    // 店舗グリッドをレンダリング
    renderShopsGrid() {
        if (this.state.isLoading && !this.state.isLoadingMore && this.state.currentPage <= 1) {
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

        if (filteredShops.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-store"></i>
                    <h3>店舗が見つかりません</h3>
                    <p>条件を変更して再度お試しください</p>
                </div>
            `;
        }

        return filteredShops.map(shop => {
            const isChecked = this.state.checkins.some(checkin => checkin.shop_id === shop.id);
            const visitImages = this.getVisitImagesForShop(shop.id);
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
                        ${(isChecked && visitImages.length > 0) ? `
                        <div class="shop-visit-images">
                            ${visitImages.map((imageUrl, index) => `
                                <div class="shop-visit-image">
                                    <img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(shop.name)}の訪問写真${visitImages.length > 1 ? index + 1 : ''}">
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
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
        this.state.currentPage = 1;
        this.state.hasMoreShops = true;

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

        if (this.state.currentView === 'list') {
            this.loadData();
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
        this.state.isLoadingMore = false;
        this.updateUI();

        try {
            if (this.state.currentView === 'list') {
                this.state.progressMessage = '';
                this.state.visitedMessage = '';
                const perPage = 20;
                const prefectureFilter = this.state.selectedPrefecture;
                const [shopsResponse, checkinsResponse, visitsResponse] = await Promise.all([
                    this.loadShops(1, perPage, prefectureFilter),
                    this.loadCheckins(),
                    this.loadVisits()
                ]);
                this.state.shops = shopsResponse.shops || [];
                this.state.totalShops = typeof shopsResponse.total === 'number'
                    ? shopsResponse.total
                    : this.state.shops.length;
                this.state.checkins = checkinsResponse;
                this.state.visits = visitsResponse;
                this.state.currentPage = 1;
                this.state.hasMoreShops = this.state.shops.length < this.state.totalShops;
                this.state.isLoadingMore = false;
            } else if (this.state.currentView === 'progress') {
                const token = API.getCookie('authToken');
                if (!token) {
                    this.state.progress = [];
                    this.state.progressMessage = '進捗を表示するにはログインが必要です。';
                    this.state.isLoading = false;
                    this.updateUI();
                    return;
                }

                this.state.progressMessage = '';
                this.state.visitedMessage = '';
                const data = await API.request('/api/v1/stamps/progress');
                this.state.progress = data.progress;
            } else if (this.state.currentView === 'visited') {
                await this.loadVisitedShops();
            }
            this.state.isLoading = false;
            this.updateUI();
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            this.state.isLoading = false;
            if (this.state.currentView === 'progress') {
                this.state.progress = [];
                this.state.progressMessage = error.message || '進捗の取得に失敗しました。';
                this.updateUI();
            } else if (this.state.currentView === 'visited') {
                this.state.visitedShops = [];
                this.state.visitedMessage = error.message || '訪問済み店舗の取得に失敗しました。';
                this.updateUI();
            } else {
                this.state.shops = [];
                this.state.totalShops = 0;
                this.state.hasMoreShops = false;
                this.state.isLoadingMore = false;
                this.showError('データの読み込みに失敗しました');
            }
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
            return {
                shops: data.shops || [],
                total: typeof data.total === 'number' ? data.total : (data.shops ? data.shops.length : 0)
            };
        } catch (error) {
            console.error('店舗データ読み込みエラー:', error);
            return { shops: [], total: 0 };
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

    // 訪問データを読み込み
    async loadVisits() {
        try {
            const token = API.getCookie('authToken');
            if (!token) {
                return [];
            }

            const data = await API.request('/api/v1/visits/me');
            return data.visits || [];
        } catch (error) {
            console.error('訪問データ読み込みエラー:', error);
            return [];
        }
    },

    // 訪問済み店舗データを読み込み
    async loadVisitedShops() {
        try {
            const token = API.getCookie('authToken');
            if (!token) {
                this.state.visitedShops = [];
                this.state.visitedMessage = '訪問済み店舗を表示するにはログインが必要です。';
                return;
            }

            this.state.visitedMessage = '';
            const data = await API.request('/api/v1/stamps/visited');
            this.state.visitedShops = data.visited_shops;
        } catch (error) {
            console.error('訪問済み店舗データ読み込みエラー:', error);
            this.state.visitedShops = [];
            this.state.visitedMessage = error.message || '訪問済み店舗の取得に失敗しました。';
        }
    },

    // さらに店舗を読み込み
    async loadMoreShops() {
        if (!this.state.hasMoreShops || this.state.isLoadingMore) return;

        const nextPage = this.state.currentPage + 1;
        this.state.isLoadingMore = true;
        this.updateUI();

        try {
            const response = await this.loadShops(nextPage, 20, this.state.selectedPrefecture);
            const newShops = response.shops || [];

            if (typeof response.total === 'number' && response.total >= 0) {
                this.state.totalShops = response.total;
            }

            if (newShops.length === 0) {
                this.state.hasMoreShops = false;
            } else {
                this.state.shops = [...this.state.shops, ...newShops];
                this.state.currentPage = nextPage;
                this.state.hasMoreShops = this.state.shops.length < this.state.totalShops;
            }
        } catch (error) {
            console.error('追加店舗読み込みエラー:', error);
        } finally {
            this.state.isLoadingMore = false;
            this.updateUI();
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
        } else if (this.state.currentView === 'progress') {
            contentEl.innerHTML = this.renderProgressView();
        } else {
            contentEl.innerHTML = this.renderVisitedView();
        }
    },

    // エラー表示
    showError(message) {
        const shopsGrid = document.getElementById('shopsGrid');
        if (shopsGrid) {
            shopsGrid.innerHTML = `
                <div class="error">
                    <p>${message}</p>
                    <button onclick="StampRallyComponent.loadData()" style="margin-top: 16px; padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
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
