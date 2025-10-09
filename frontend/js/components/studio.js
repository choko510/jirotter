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
        
        contentArea.innerHTML = `
            <style>
                .studio-container {
                    padding: 20px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                .studio-header {
                    margin-bottom: 20px;
                    text-align: center;
                }
                
                .studio-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .studio-subtitle {
                    color: #666;
                    font-size: 14px;
                }
                
                .studio-progress {
                    background: #f5f5f5;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 24px;
                }
                
                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .progress-title {
                    font-weight: bold;
                }
                
                .progress-count {
                    color: #d4a574;
                    font-weight: bold;
                }
                
                .progress-bar {
                    height: 8px;
                    background: #e0e0e0;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                
                .progress-fill {
                    height: 100%;
                    background: #d4a574;
                    width: 30%;
                    transition: width 0.3s ease;
                }
                
                .progress-text {
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }
                
                .stamps-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 16px;
                    margin-bottom: 24px;
                }
                
                .stamp-card {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    padding: 12px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .stamp-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }
                
                .stamp-card.unlocked {
                    border-color: #d4a574;
                    background: rgba(212, 165, 116, 0.05);
                }
                
                .stamp-icon {
                    font-size: 48px;
                    margin-bottom: 8px;
                    filter: grayscale(1);
                    opacity: 0.3;
                }
                
                .stamp-card.unlocked .stamp-icon {
                    filter: grayscale(0);
                    opacity: 1;
                }
                
                .stamp-name {
                    font-size: 12px;
                    font-weight: bold;
                    margin-bottom: 4px;
                }
                
                .stamp-location {
                    font-size: 10px;
                    color: #666;
                }
                
                .stamp-date {
                    font-size: 10px;
                    color: #d4a574;
                    margin-top: 4px;
                }
                
                .rewards-section {
                    background: #f9f9f9;
                    border-radius: 12px;
                    padding: 16px;
                }
                
                .rewards-title {
                    font-weight: bold;
                    margin-bottom: 12px;
                }
                
                .rewards-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .reward-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px;
                    background: #ffffff;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                }
                
                .reward-icon {
                    font-size: 24px;
                }
                
                .reward-info {
                    flex: 1;
                }
                
                .reward-name {
                    font-weight: bold;
                    font-size: 14px;
                }
                
                .reward-desc {
                    font-size: 12px;
                    color: #666;
                }
                
                .reward-status {
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    background: #e0e0e0;
                    color: #666;
                }
                
                .reward-status.unlocked {
                    background: #d4a574;
                    color: white;
                }
                
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                
                @media (max-width: 768px) {
                    .studio-container {
                        padding: 16px;
                    }
                    
                    .stamps-grid {
                        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                        gap: 12px;
                    }
                    
                    .stamp-icon {
                        font-size: 36px;
                    }
                }
            </style>
            
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