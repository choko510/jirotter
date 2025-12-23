// スタンプラリーコンポーネント
const StampRallyComponent = {
    // 状態管理
    state: {
        shops: [],
        checkins: [],
        visits: [],
        progress: [],
        visitedShops: [], // 新規追加：訪問済み店舗データ
        isLoading: false,
        currentPage: 1,
        hasMoreShops: true,
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
        document.addEventListener('change', (e) => {
            if (e.target.id === 'brandSelect') {
                this.filterByBrand(e.target.value);
            }
            if (e.target.id === 'prefectureSelect') {
                this.filterByPrefecture(e.target.value);
            }
        });

        document.addEventListener('click', (e) => {
            // view-switch-btn and load-more-shops logic
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
                    margin-bottom: 16px;
                }
                
                .stamp-rally-title {
                    font-size: 22px;
                    font-weight: bold;
                    margin-bottom: 4px;
                    color: var(--color-primary);
                }
                
                .stamp-rally-subtitle {
                    color: #888;
                    font-size: 13px;
                }
                
                /* 統計セクション - コンパクトな横一列 + 円グラフ */
                .stamp-stats {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    margin-bottom: 16px;
                    padding: 16px;
                    background: linear-gradient(135deg, #fef9f3, #fdf5ec);
                    border-radius: 12px;
                }
                
                .stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                }
                
                .stat-number {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--color-primary);
                }
                
                .stat-label {
                    color: #666;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .stat-divider {
                    width: 1px;
                    height: 40px;
                    background: rgba(0,0,0,0.1);
                }
                
                /* 円グラフ（達成率） */
                .progress-circle {
                    position: relative;
                    width: 70px;
                    height: 70px;
                }
                
                .progress-circle svg {
                    transform: rotate(-90deg);
                }
                
                .progress-circle-bg {
                    fill: none;
                    stroke: #e8e0d5;
                    stroke-width: 6;
                }
                
                .progress-circle-fill {
                    fill: none;
                    stroke: var(--color-primary);
                    stroke-width: 6;
                    stroke-linecap: round;
                    transition: stroke-dashoffset 0.5s ease;
                }
                
                .progress-circle-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 14px;
                    font-weight: bold;
                    color: var(--color-primary);
                }
                
                .filter-section {
                    margin-bottom: 16px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: center;
                }
                
                .filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 140px;
                    flex: 1;
                    max-width: 200px;
                }

                .filter-group label {
                    font-weight: 600;
                    color: #555;
                    font-size: 12px;
                }

                .filter-select {
                    width: 100%;
                    padding: 10px 12px;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                    background-color: white;
                    font-size: 14px;
                    color: #333;
                    cursor: pointer;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .filter-select:focus {
                    outline: none;
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 2px var(--color-primary-soft);
                }

                .progress-accordion {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .region-progress-details {
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    background: #fff;
                    overflow: hidden;
                }

                .region-progress-summary {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: bold;
                    padding: 12px 16px;
                    cursor: pointer;
                    background: #fafafa;
                }

                .region-progress-summary span:last-child {
                    font-size: 12px;
                    color: #666;
                }

                .region-progress-details .progress-grid {
                    padding: 16px;
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

                .shop-visit-images {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                    gap: 10px;
                    margin-bottom: 15px;
                }

                .shop-visit-image {
                    position: relative;
                    width: 100%;
                    padding-top: 66.66%;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #f0f0f0;
                }

                .shop-visit-image img {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
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
                    background: var(--color-primary);
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
                    color: var(--color-primary);
                    border: 1px solid var(--color-primary);
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
                    background: var(--color-primary);
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
                    margin-bottom: 16px;
                    background: #f5f5f5;
                    border-radius: 10px;
                    padding: 4px;
                    gap: 4px;
                }

                .view-switch-btn {
                    padding: 8px 20px;
                    cursor: pointer;
                    border: none;
                    background-color: transparent;
                    color: #666;
                    font-weight: 600;
                    font-size: 14px;
                    border-radius: 8px;
                    transition: all 0.2s;
                }

                .view-switch-btn.active {
                    background-color: #fff;
                    color: var(--color-primary);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
                    background: var(--color-primary);
                    height: 100%;
                    border-radius: 5px;
                    transition: width 0.5s ease-in-out;
                }
                
                .progress-card p {
                    text-align: right;
                    color: #666;
                    font-size: 14px;
                }


                /* Visited Shops Styles */
                .visited-accordion {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .prefecture-visited-details {
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    background: #fff;
                    overflow: hidden;
                }

                .prefecture-visited-summary {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: bold;
                    padding: 12px 16px;
                    cursor: pointer;
                    background: #fafafa;
                }

                .prefecture-visited-summary span:last-child {
                    font-size: 12px;
                    color: #666;
                }

                .visited-shops-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    padding: 16px;
                }

                .visited-shop-card {
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #fff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .shop-checkin-date {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 10px;
                }

                .shop-checkin-date i {
                    color: var(--color-primary);
                }


                @media (max-width: 768px) {
                    .stamp-rally-container {
                        padding: 12px;
                    }
                    
                    .stamp-rally-title {
                        font-size: 18px;
                    }
                    
                    .stamp-rally-subtitle {
                        font-size: 12px;
                    }
                    
                    .stamp-stats {
                        gap: 12px;
                        padding: 12px;
                    }
                    
                    .stat-number {
                        font-size: 20px;
                    }
                    
                    .stat-label {
                        font-size: 10px;
                    }
                    
                    .progress-circle {
                        width: 56px;
                        height: 56px;
                    }
                    
                    .progress-circle svg {
                        width: 56px;
                        height: 56px;
                    }
                    
                    .progress-circle-text {
                        font-size: 12px;
                    }
                    
                    .view-switch-btn {
                        padding: 6px 14px;
                        font-size: 13px;
                    }
                    
                    .filter-group {
                        max-width: none;
                    }
                    
                    .shops-grid {
                        grid-template-columns: 1fr;
                        gap: 12px;
                    }
                    
                    .visited-shops-grid {
                        grid-template-columns: 1fr;
                        gap: 12px;
                    }
                }
            </style>
            
            <div class="stamp-rally-container">
                <div class="stamp-rally-header">
                    <h1 class="stamp-rally-title">二郎スタンプラリー</h1>
                    <p class="stamp-rally-subtitle">訪問した店舗をチェックインしてスタンプを集めよう！</p>
                </div>

                <div class="view-switcher">
                    <button class="view-switch-btn ${this.state.currentView === 'list' ? 'active' : ''}" data-view="list">リスト</button>
                    <button class="view-switch-btn ${this.state.currentView === 'progress' ? 'active' : ''}" data-view="progress">マップ</button>
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
                <div class="filter-group">
                    <label for="brandSelect">系列</label>
                    <select id="brandSelect" class="filter-select">
                        ${this.renderBrandFilters()}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="prefectureSelect">エリア</label>
                    <select id="prefectureSelect" class="filter-select">
                        ${this.renderPrefectureFilters()}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="visitedFilter">訪問状況</label>
                    <select id="visitedFilter" class="filter-select">
                        <option value="all">すべて</option>
                        <option value="visited">訪問済み</option>
                        <option value="unvisited">未訪問</option>
                    </select>
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

    // 統計情報をレンダリング（円グラフ付き）
    renderStats() {
        const totalShops = this.state.shops.length;
        const checkedShops = this.state.checkins.length;
        const completionRate = totalShops > 0 ? Math.round((checkedShops / totalShops) * 100) : 0;

        // 円グラフ用のSVG計算
        const radius = 28;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (completionRate / 100) * circumference;

        return `
            <div class="stat-item">
                <div class="stat-number">${totalShops}</div>
                <div class="stat-label">対象店舗</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
                <div class="stat-number">${checkedShops}</div>
                <div class="stat-label">訪問済み</div>
            </div>
            <div class="stat-divider"></div>
            <div class="progress-circle">
                <svg width="70" height="70" viewBox="0 0 70 70">
                    <circle class="progress-circle-bg" cx="35" cy="35" r="${radius}"></circle>
                    <circle class="progress-circle-fill" cx="35" cy="35" r="${radius}" 
                        stroke-dasharray="${circumference}" 
                        stroke-dashoffset="${offset}"></circle>
                </svg>
                <div class="progress-circle-text">${completionRate}%</div>
            </div>
        `;
    },

    // ブランドフィルターをレンダリング
    renderBrandFilters() {
        let optionsHtml = `<option value="all" ${this.state.selectedBrand === 'all' ? 'selected' : ''}>すべて</option>`;

        for (const [brandKey, brandConfig] of Object.entries(this.BRAND_CONFIG)) {
            if (brandKey === 'other') continue;

            optionsHtml += `
                <option value="${brandKey}" ${this.state.selectedBrand === brandKey ? 'selected' : ''}>
                    ${brandConfig.name}
                </option>
            `;
        }

        return optionsHtml;
    },

    // 都道府県フィルターをレンダリング
    renderPrefectureFilters() {
        let optionsHtml = `<option value="all" ${this.state.selectedPrefecture === 'all' ? 'selected' : ''}>全国</option>`;

        for (const region in this.REGION_PREFECTURES) {
            optionsHtml += `<optgroup label="${this.escapeHtml(region)}">`;

            this.REGION_PREFECTURES[region].forEach(prefecture => {
                optionsHtml += `
                    <option value="${prefecture}" ${this.state.selectedPrefecture === prefecture ? 'selected' : ''}>
                        ${prefecture}
                    </option>
                `;
            });
            optionsHtml += `</optgroup>`;
        }

        return optionsHtml;
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

        // Note: With select box, we don't need to manually update class names for buttons
        // but we might want to ensure the select value matches state (already handled by render or onchange)

        // 再レンダリング (Grid only if just client side filter? No, brand is client side, prefecture is server side)
        // If we change brand, we re-filter the *currently loaded* shops.
        // But if prefecture is set, shops are loaded for that prefecture.

        const shopsGrid = document.getElementById('shopsGrid');
        if (shopsGrid) {
            shopsGrid.innerHTML = this.renderShopsGrid();
        }

        // If we want to reload data (in case we change logic later), we can call loadData()
        // But currently brand filtering is purely client side on the fetched list.
        // HOWEVER, as noted in thought process, client side filtering on paginated data is problematic.
        // For now, I will keep the behavior consistent with existing code but remove the prefecture reset logic in loadData.

        // If I want to support "Jiro in Tokyo", I should reload data if I change Brand?
        // No, `loadShops` does NOT take brand.
        // So `loadData` fetches by prefecture. Then `renderShopsGrid` filters by brand.
        // So changing brand only requires re-rendering grid.

        // Wait, if I have `loadData()` here it triggers full reload.
        // The previous code did:
        /*
        if (this.state.currentView === 'list') {
            this.loadData();
        }
        */
        // But `loadData` previously reset prefecture to 'all'.
        // Now I removed that reset in `loadData` (see below).
        // So if I call `loadData`, it fetches shops for current prefecture again?
        // If prefecture hasn't changed, `loadData` fetches the same list.
        // So `loadData` is redundant unless we want to refresh.
        // BUT `renderShopsGrid` uses `this.state.shops`.

        // So simply re-rendering grid is enough if `this.state.shops` is already populated for the current prefecture.
        // Yes.

        // However, if I change brand, I might want to reset page?
        // `this.state.currentPage = 1;` was set.
        // `this.state.hasMoreShops = true;` was set.
        // If I don't reload data, `this.state.shops` might contain pages 1..N.
        // If I filter by brand, I filter from `this.state.shops`.
        // This is fine.

        // But wait, the previous code CALLED `loadData()`. Why?
        // Because if `brand !== 'all'`, it forced `prefecture = 'all'`.
        // So it HAD to fetch new data (all prefectures).
        // Now, if I select a brand, I KEEP the current prefecture.
        // So I don't need to fetch new data. I just filter what I have.
        // UNLESS the user wants to fetch *more* data to find that brand?
        // That's the pagination issue.

        // I will stick to re-rendering grid only, to be efficient,
        // UNLESS the previous behavior of "switching brand resets everything" was desired.
        // But we want "intuitive" UI.

        // Let's stick to: Change Brand -> Filter current list.
        // But if I change prefecture -> Fetch new list.

        const shopsGridEl = document.getElementById('shopsGrid');
        if (shopsGridEl) {
            shopsGridEl.innerHTML = this.renderShopsGrid();
        }
    },

    // 都道府県でフィルタリング
    async filterByPrefecture(prefecture) {
        this.state.selectedPrefecture = prefecture;
        this.state.currentPage = 1;
        this.state.hasMoreShops = true;

        // 新しいデータで再読み込み (Prefecture filtering is server side)
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
                this.state.progressMessage = '';
                this.state.visitedMessage = '';
                const perPage = 20;

                // MODIFIED: Do NOT force prefecture to 'all' if brand is selected.
                // Allow both filters.
                const prefectureFilter = this.state.selectedPrefecture;

                const [shopsResponse, checkinsResponse, visitsResponse] = await Promise.all([
                    this.loadShops(1, perPage, prefectureFilter),
                    this.loadCheckins(),
                    this.loadVisits()
                ]);
                this.state.shops = shopsResponse;
                this.state.checkins = checkinsResponse;
                this.state.visits = visitsResponse;
                this.state.currentPage = 1;
                this.state.hasMoreShops = shopsResponse.length === perPage;
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
        if (!this.state.hasMoreShops || this.state.isLoading) return;

        this.state.currentPage++;
        this.state.isLoading = true;

        try {
            // MODIFIED: Use current selected prefecture
            const prefectureFilter = this.state.selectedPrefecture;

            const newShops = await this.loadShops(this.state.currentPage, 20, prefectureFilter);

            if (newShops.length === 0) {
                this.state.hasMoreShops = false;
            } else {
                this.state.shops = [...this.state.shops, ...newShops];
                if (newShops.length < 20) {
                    this.state.hasMoreShops = false;
                }
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
