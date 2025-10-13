// スタンプラリーコンポーネント
const StudioComponent = {
    // 状態管理
    state: {
        stamps: [],
        userStamps: [],
        isLoading: false
    },

    // レンダリング
    render(params = []) {
        const contentArea = document.getElementById('contentArea');
        
        // CSSの動的読み込み
        Utils.loadCSS('studio');

        contentArea.innerHTML = `
            <div class="studio-container">
                <div class="studio-header">
                    <h1 class="studio-title">スタンプラリー</h1>
                    <p class="studio-subtitle">全国のラーメン店を巡ってスタンプを集めよう！</p>
                </div>
                
                <div class="studio-progress">
                    <div class="progress-header">
                        <div class="progress-title">コレクション進捗</div>
                        <div class="progress-count">3/10</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">あと7個で特典解放！</div>
                </div>
                
                <div class="stamps-grid" id="stampsGrid">
                    ${this.renderStampsGrid()}
                </div>
                
                <div class="rewards-section">
                    <div class="rewards-title">特典</div>
                    <div class="rewards-list">
                        <div class="reward-item">
                            <div class="reward-icon"><i class="fas fa-trophy"></i></div>
                            <div class="reward-info">
                                <div class="reward-name">ラーメンマスター</div>
                                <div class="reward-desc">全スタンプ制覇で特別バッジ</div>
                            </div>
                            <div class="reward-status">7/10</div>
                        </div>
                        <div class="reward-item">
                            <div class="reward-icon"><i class="fas fa-gift"></i></div>
                            <div class="reward-info">
                                <div class="reward-name">5個達成</div>
                                <div class="reward-desc">限定グッズプレゼント</div>
                            </div>
                            <div class="reward-status">3/5</div>
                        </div>
                        <div class="reward-item">
                            <div class="reward-icon"><i class="fas fa-celebration"></i></div>
                            <div class="reward-info">
                                <div class="reward-name">初めてのスタンプ</div>
                                <div class="reward-desc">歓迎メッセージ</div>
                            </div>
                            <div class="reward-status unlocked">解放済み</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // データを読み込み
        if (this.state.stamps.length === 0) {
            this.loadStampsData();
        }
    },

    // スタンプグリッドのレンダリング
    renderStampsGrid() {
        if (this.state.isLoading) {
            return '<div class="loading">読み込み中...</div>';
        }

        // モックデータ
        const mockStamps = [
            { id: 1, name: '下荒庄', location: '東京', unlocked: true, unlockedDate: '2023/10/01' },
            { id: 2, name: 'らーめん一', location: '大阪', unlocked: true, unlockedDate: '2023/10/05' },
            { id: 3, name: '二郎藍', location: '名古屋', unlocked: true, unlockedDate: '2023/10/10' },
            { id: 4, name: '家系本舗', location: '横浜', unlocked: false },
            { id: 5, name: '醤油らーめん田中', location: '京都', unlocked: false },
            { id: 6, name: '味噌らーめん山本', location: '札幌', unlocked: false },
            { id: 7, name: 'とんこつらーめん中村', location: '福岡', unlocked: false },
            { id: 8, name: 'つけ麺佐藤', location: '東京', unlocked: false },
            { id: 9, name: '油そば鈴木', location: '大阪', unlocked: false },
            { id: 10, name: 'まぜそば高橋', location: '名古屋', unlocked: false }
        ];

        return mockStamps.map(stamp => {
            const stampIcon = stamp.unlocked ? '<i class="fas fa-bowl-food"></i>' : '<i class="fas fa-question"></i>';
            const cardClass = stamp.unlocked ? 'unlocked' : '';
            
            return `
                <div class="stamp-card ${cardClass}" onclick="StudioComponent.showStampDetail(${stamp.id})">
                    <div class="stamp-icon">${stampIcon}</div>
                    <div class="stamp-name">${stamp.name}</div>
                    <div class="stamp-location">${stamp.location}</div>
                    ${stamp.unlocked ? `<div class="stamp-date">${stamp.unlockedDate}</div>` : ''}
                </div>
            `;
        }).join('');
    },

    // スタンプデータの読み込み
    async loadStampsData() {
        this.state.isLoading = true;
        document.getElementById('stampsGrid').innerHTML = '<div class="loading">読み込み中...</div>';
        
        try {
            // 実際の実装ではAPIからデータを取得
            // const stamps = await API.getStampsData();
            
            // モックデータを使用
            setTimeout(() => {
                this.state.isLoading = false;
                this.renderStampsGrid();
            }, 1000);
        } catch (error) {
            console.error('スタンプデータの読み込みに失敗しました:', error);
            this.state.isLoading = false;
            document.getElementById('stampsGrid').innerHTML = `
                <div class="error">
                    <p>データの読み込みに失敗しました</p>
                    <button onclick="StudioComponent.loadStampsData()" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        再読み込み
                    </button>
                </div>
            `;
        }
    },

    // スタンプ詳細表示
    showStampDetail(stampId) {
        alert(`スタンプID: ${stampId} の詳細を表示`);
        // 実際の実装では、スタンプ詳細モーダルを表示する
    }
};

// コンポーネントをルーターに登録
router.register('studio', StudioComponent);