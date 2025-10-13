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
        
        // CSSの動的読み込み
        Utils.loadCSS('waittime');

        contentArea.innerHTML = `
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