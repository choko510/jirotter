// 待ち時間リストコンポーネント
const WaittimeComponent = {
    // 状態管理
    state: {
        shops: [],
        isLoading: false,
        sortBy: 'waitTime', // 'waitTime', 'name', 'distance'
        selectedPrefecture: 'all'
    },

    // レンダリング
    render(params = []) {
        const contentArea = document.getElementById('contentArea');
        
        contentArea.innerHTML = `
            <style>
                .waittime-container {
                    padding: 20px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                .waittime-header {
                    margin-bottom: 20px;
                }
                
                .waittime-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .waittime-subtitle {
                    color: #666;
                    font-size: 14px;
                }
                
                .sort-options {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                
                .sort-btn {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    color: #1a1a1a;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                
                .sort-btn:hover {
                    background: #f5f5f5;
                }
                
                .sort-btn.active {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: #ffffff;
                }
                
                .waittime-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .waittime-card {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    padding: 16px;
                    transition: all 0.2s;
                    cursor: pointer;
                }
                
                .waittime-card:hover {
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                
                .waittime-shop-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                }
                
                .waittime-shop-name {
                    font-weight: bold;
                    font-size: 16px;
                    flex: 1;
                }
                
                .waittime-badge {
                    background: #ff5252;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .waittime-badge.short {
                    background: #4caf50;
                }
                
                .waittime-badge.medium {
                    background: #ff9800;
                }
                
                .waittime-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .waittime-details {
                    display: flex;
                    gap: 16px;
                    color: #666;
                    font-size: 14px;
                }
                
                .waittime-detail {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .waittime-action {
                    background: transparent;
                    border: 1px solid #d4a574;
                    color: #d4a574;
                    padding: 6px 12px;
                    border-radius: 16px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }
                
                .waittime-action:hover {
                    background: rgba(212, 165, 116, 0.1);
                }
                
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                
                @media (max-width: 768px) {
                    .waittime-container {
                        padding: 16px;
                    }
                    
                    .waittime-details {
                        flex-direction: column;
                        gap: 4px;
                        align-items: flex-start;
                    }
                }

                /* Dark Mode Overrides */
                .dark-mode .waittime-subtitle,
                .dark-mode .waittime-details {
                    color: #aaa;
                }
                .dark-mode .sort-btn {
                    background: #2a2a2a;
                    border-color: #333;
                    color: #e0e0e0;
                }
                .dark-mode .sort-btn:hover {
                    background: #333;
                }
                .dark-mode .sort-btn.active {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: #1a1a1a;
                }
                .dark-mode .waittime-card {
                    background: #2a2a2a;
                    border-color: #333;
                }
                .dark-mode .waittime-card:hover {
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                }
                
                /* 都道府県フィルター用スタイル */
                .prefecture-filter-section {
                    margin-bottom: 20px;
                }
                
                .filter-header {
                    margin-bottom: 10px;
                }
                
                .filter-header h3 {
                    margin: 0;
                    font-size: 16px;
                    color: #d4a574;
                }
                
                .prefecture-filters {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: 8px;
                    max-height: 200px;
                    overflow-y: auto;
                    padding: 10px;
                    background: #f9f9f9;
                    border-radius: 8px;
                }
                
                .prefecture-filter-btn {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    color: #666;
                    padding: 6px 12px;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 12px;
                    text-align: center;
                }
                
                .prefecture-filter-btn:hover {
                    background: #f5f5f5;
                }
                
                .prefecture-filter-btn.active {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: white;
                }
                
                .dark-mode .prefecture-filters {
                    background: #2a2a2a;
                }
                
                .dark-mode .prefecture-filter-btn {
                    background: #2a2a2a;
                    border-color: #333;
                    color: #e0e0e0;
                }
                
                .dark-mode .prefecture-filter-btn:hover {
                    background: #333;
                }
                
                .dark-mode .prefecture-filter-btn.active {
                    background: #d4a574;
                    border-color: #d4a574;
                    color: #1a1a1a;
                }
            </style>
            
            <div class="waittime-container">
                <div class="waittime-header">
                    <h1 class="waittime-title">待ち時間リスト</h1>
                    <p class="waittime-subtitle">近くの店舗の待ち時間をリアルタイムで確認</p>
                </div>
                
                <div class="sort-options">
                    <button class="sort-btn ${this.state.sortBy === 'waitTime' ? 'active' : ''}" data-sort="waitTime">
                        待ち時間順
                    </button>
                    <button class="sort-btn ${this.state.sortBy === 'name' ? 'active' : ''}" data-sort="name">
                        名前順
                    </button>
                    <button class="sort-btn ${this.state.sortBy === 'distance' ? 'active' : ''}" data-sort="distance">
                        距離順
                    </button>
                </div>
                
                <div class="waittime-list" id="waittimeList">
                    ${this.renderWaittimeList()}
                </div>
            </div>
        `;

        // イベントリスナーを設定
        this.bindEvents();
        
        // データを読み込み
        if (this.state.shops.length === 0) {
            this.loadWaittimeData();
        }
    },

    // 待ち時間リストのレンダリング
    renderWaittimeList() {
        if (this.state.isLoading) {
            return '<div class="loading">読み込み中...</div>';
        }

        // データがない場合はメッセージを表示
        if (this.state.shops.length === 0) {
            return '<div class="loading">待ち時間データがありません</div>';
        }

        // ソート
        let sortedShops = [...this.state.shops];
        if (this.state.sortBy === 'waitTime') {
            sortedShops.sort((a, b) => a.waitTime - b.waitTime);
        } else if (this.state.sortBy === 'name') {
            sortedShops.sort((a, b) => a.name.localeCompare(b.name));
        } else if (this.state.sortBy === 'distance') {
            sortedShops.sort((a, b) => a.distance - b.distance);
        }
        
        // 都道府県でフィルタリング
        if (this.state.selectedPrefecture !== 'all') {
            sortedShops = this.filterShopsByPrefecture(sortedShops, this.state.selectedPrefecture);
        }

        return sortedShops.map(shop => {
            let badgeClass = 'short';
            if (shop.waitTime > 30) badgeClass = 'long';
            else if (shop.waitTime > 15) badgeClass = 'medium';

            return `
                <div class="waittime-card" onclick="WaittimeComponent.showShopDetail(${shop.id})">
                    <div class="waittime-shop-header">
                        <div class="waittime-shop-name">${shop.name}</div>
                        <div class="waittime-badge ${badgeClass}">
                            ${shop.waitTime}分
                        </div>
                    </div>
                    <div class="waittime-info">
                        <div class="waittime-details">
                            <div class="waittime-detail">
                                <i class="fas fa-map-marker-alt"></i> ${shop.distance}km
                            </div>
                            <div class="waittime-detail">
                                <i class="fas fa-clock"></i> ${shop.lastUpdate}
                            </div>
                        </div>
                        <button class="waittime-action" onclick="event.stopPropagation(); WaittimeComponent.showShopDetail(${shop.id})">
                            詳細を見る
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // イベントバインド
    bindEvents() {
        // ソートボタン
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sortBy = e.target.dataset.sort;
                this.state.sortBy = sortBy;
                
                // アクティブ状態を更新
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // 再レンダリング
                const updatedHtml = this.renderWaittimeList();
                const listElement = document.getElementById('waittimeList');
                if (listElement) {
                    listElement.innerHTML = updatedHtml;
                }
            });
        });
        
        // 都道府県フィルターボタン
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('prefecture-filter-btn')) {
                this.filterByPrefecture(e.target.dataset.prefecture);
            }
        });
    },

    // 待ち時間データの読み込み
    async loadWaittimeData() {
        this.state.isLoading = true;
        const waittimeListElement = document.getElementById('waittimeList');
        if (waittimeListElement) {
            waittimeListElement.innerHTML = '<div class="loading">読み込み中...</div>';
        }
        
        try {
            // APIからデータを取得
            const data = await API.request('/api/v1/ramen/waittime');
            
            // 取得したデータを状態に保存
            this.state.shops = data.shops.map(shop => ({
                id: shop.id,
                name: shop.name,
                waitTime: shop.wait_time || 0,
                distance: shop.distance || 0,
                lastUpdate: shop.last_update ? API.formatTime(shop.last_update) : '不明'
            }));
            
            this.state.isLoading = false;
            const updatedHtml = this.renderWaittimeList();
            const listElement = document.getElementById('waittimeList');
            if (listElement) {
                listElement.innerHTML = updatedHtml;
            }
        } catch (error) {
            console.error('待ち時間データの読み込みに失敗しました:', error);
            this.state.isLoading = false;
            const listElement = document.getElementById('waittimeList');
            if (listElement) {
                listElement.innerHTML = `
                    <div class="error">
                        <p>データの読み込みに失敗しました</p>
                        <button onclick="WaittimeComponent.loadWaittimeData()" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            再読み込み
                        </button>
                    </div>
                `;
            }
        }
    },

    // 店舗詳細表示
    showShopDetail(shopId) {
        router.navigate('shop', [shopId]);
    },
    
    // 都道府県フィルターをレンダリング
    renderPrefectureFilters() {
        const prefectures = [
            '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
            '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
            '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県',
            '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
            '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県',
            '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
        ];
        
        let buttonsHtml = `
            <button class="prefecture-filter-btn ${this.state.selectedPrefecture === 'all' ? 'active' : ''}" data-prefecture="all">
                全国
            </button>
        `;

        for (const prefecture of prefectures) {
            buttonsHtml += `
                <button class="prefecture-filter-btn ${this.state.selectedPrefecture === prefecture ? 'active' : ''}" data-prefecture="${prefecture}">
                    ${prefecture}
                </button>
            `;
        }

        return buttonsHtml;
    },
    
    // 都道府県でフィルタリング
    filterByPrefecture(prefecture) {
        this.state.selectedPrefecture = prefecture;
        
        // アクティブ状態を更新
        document.querySelectorAll('.prefecture-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.prefecture === prefecture) {
                btn.classList.add('active');
            }
        });
        
        // 再レンダリング
        const updatedHtml = this.renderWaittimeList();
        const listElement = document.getElementById('waittimeList');
        if (listElement) {
            listElement.innerHTML = updatedHtml;
        }
    },
    
    // 都道府県から店舗をフィルタリング
    filterShopsByPrefecture(shops, prefecture) {
        if (!prefecture || prefecture === 'all') {
            return shops;
        }
        
        return shops.filter(shop => {
            // 店舗の住所から都道府県を判定
            const address = shop.address || '';
            return address.includes(prefecture);
        });
    }
};

// コンポーネントをルーターに登録
router.register('waittime', WaittimeComponent);