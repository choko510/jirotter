// 待ち時間リストコンポーネント
const WaittimeComponent = {
    // 状態管理
    state: {
        shops: [],
        isLoading: false,
        sortBy: 'waitTime' // 'waitTime', 'name', 'distance'
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

        // モックデータ
        const mockShops = [
            { id: 1, name: '下荒庄', waitTime: 15, distance: 0.3, lastUpdate: '5分前' },
            { id: 2, name: 'らーめん一', waitTime: 45, distance: 0.8, lastUpdate: '2分前' },
            { id: 3, name: '二郎藍', waitTime: 30, distance: 1.2, lastUpdate: '10分前' },
            { id: 4, name: '家系本舗', waitTime: 5, distance: 0.5, lastUpdate: '1分前' },
            { id: 5, name: '醤油らーめん田中', waitTime: 20, distance: 0.7, lastUpdate: '7分前' }
        ];

        // ソート
        let sortedShops = [...mockShops];
        if (this.state.sortBy === 'waitTime') {
            sortedShops.sort((a, b) => a.waitTime - b.waitTime);
        } else if (this.state.sortBy === 'name') {
            sortedShops.sort((a, b) => a.name.localeCompare(b.name));
        } else if (this.state.sortBy === 'distance') {
            sortedShops.sort((a, b) => a.distance - b.distance);
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
                this.renderWaittimeList();
            });
        });
    },

    // 待ち時間データの読み込み
    async loadWaittimeData() {
        this.state.isLoading = true;
        document.getElementById('waittimeList').innerHTML = '<div class="loading">読み込み中...</div>';
        
        try {
            // 実際の実装ではAPIからデータを取得
            // const shops = await API.getWaittimeData();
            
            // モックデータを使用
            setTimeout(() => {
                this.state.isLoading = false;
                this.renderWaittimeList();
            }, 1000);
        } catch (error) {
            console.error('待ち時間データの読み込みに失敗しました:', error);
            this.state.isLoading = false;
            document.getElementById('waittimeList').innerHTML = `
                <div class="error">
                    <p>データの読み込みに失敗しました</p>
                    <button onclick="WaittimeComponent.loadWaittimeData()" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        再読み込み
                    </button>
                </div>
            `;
        }
    },

    // 店舗詳細表示
    showShopDetail(shopId) {
        alert(`店舗ID: ${shopId} の詳細を表示`);
        // 実際の実装では、店舗詳細ページに遷移する
        // router.navigate('shop', [shopId]);
    }
};

// コンポーネントをルーターに登録
router.register('waittime', WaittimeComponent);