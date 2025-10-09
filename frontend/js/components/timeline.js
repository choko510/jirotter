// タイムラインコンポーネント
const TimelineComponent = {
    // 状態管理
    state: {
        currentTab: 'recommend',
        posts: [],
        isRefreshing: false,
        pullStartY: 0,
        pullCurrentY: 0,
        pullDistance: 0,
        maxPullDistance: 120,
        pullThreshold: 80
    },

    // 初期化
    init() {
        this.bindEvents();
    },

    // イベントバインド
    bindEvents() {
        // タブ切り替え
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                this.switchTab(e.target);
            }
        });
        
        // 引っ張って更新のイベントはrenderメソッド内でバインド
    },

    // レンダリング
    render(params = []) {
        const contentArea = document.getElementById('contentArea');
        
        // タイムラインのHTMLを生成
        contentArea.innerHTML = `
            <style>
                .post-input-area {
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .post-input-wrapper {
                    display: flex;
                    gap: 12px;
                }

                .post-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: #d4a574;
                    flex-shrink: 0;
                }

                .post-input-content {
                    flex: 1;
                }

                .post-textarea {
                    width: 100%;
                    background: transparent;
                    border: none;
                    color: #1a1a1a;
                    font-size: 20px;
                    resize: none;
                    outline: none;
                    min-height: 60px;
                    font-family: inherit;
                }

                .post-textarea::placeholder {
                    color: #999;
                }

                .post-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 12px;
                }

                .post-icons {
                    display: flex;
                    gap: 4px;
                    background: #f5f5f5;
                    border-radius: 20px;
                    padding: 2px;
                }

                .post-icon-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: none;
                    background: transparent;
                    color: #d4a574;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }

                .post-icon-btn:hover {
                    background: rgba(212, 165, 116, 0.1);
                }

                .tweet-btn {
                    background: #dbaf3adb;
                    color: #1a1a1a;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .tweet-btn:hover {
                    background: #c49564;
                }

                .tweet-btn:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }

                /* 引っ張って更新スタイル */
                .pull-to-refresh {
                    position: relative;
                    overflow: hidden;
                }

                .pull-indicator {
                    position: absolute;
                    top: -50px;
                    left: 0;
                    right: 0;
                    height: 50px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f9f9f9;
                    transition: transform 0.3s ease;
                    border-bottom: 1px solid #e0e0e0;
                    z-index: 100;
                }

                .pull-indicator.visible {
                    transform: translateY(50px);
                }

                .pull-indicator.refreshing {
                    transform: translateY(50px);
                }

                .pull-spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid #e0e0e0;
                    border-top: 2px solid #d4a574;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    display: none;
                }

                .pull-indicator.refreshing .pull-spinner {
                    display: block;
                }

                .pull-text {
                    margin-left: 10px;
                    font-size: 14px;
                    color: #666;
                }

                .pull-indicator.refreshing .pull-text {
                    display: none;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .timeline-container {
                    position: relative;
                    overflow-y: auto;
                    height: calc(100vh - 120px);
                    -webkit-overflow-scrolling: touch;
                    overscroll-behavior-y: contain;
                }

                .timeline {
                    /* スタイルは保持 */
                }

                @media (max-width: 768px) {
                    .timeline-container {
                        height: calc(100vh - 180px);
                    }
                }

                .post-card {
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
                    transition: background 0.2s;
                    cursor: pointer;
                }

                .post-card:hover {
                    background: #f9f9f9;
                }

                .post-header {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .post-user-info {
                    flex: 1;
                }

                .post-username {
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .post-meta {
                    color: #666;
                    font-size: 14px;
                }

                .post-image {
                    width: 100%;
                    border-radius: 16px;
                    margin-top: 12px;
                    background: #f5f5f5;
                    min-height: 200px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 48px;
                    border: 1px solid #e0e0e0;
                }

                .post-engagement {
                    display: flex;
                    justify-content: space-around;
                    margin-top: 12px;
                    padding-top: 12px;
                }

                .engagement-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: transparent;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 4px;
                    transition: color 0.2s, background 0.2s;
                }

                .engagement-btn:hover {
                    color: #d4a574;
                    background: rgba(212, 165, 116, 0.1);
                }

                @media (max-width: 768px) {
                    .post-input-area {
                        padding: 12px 16px;
                    }

                    .post-textarea {
                        font-size: 16px;
                    }

                    .post-card {
                        padding: 12px 16px;
                    }
                }
            </style>
            
            <div class="post-input-area">
                <div class="post-input-wrapper">
                    <div class="post-avatar"></div>
                    <div class="post-input-content">
                        <textarea class="post-textarea" placeholder="今日食べる二郎は？" id="postTextarea"></textarea>
                        <div class="post-actions">
                            <div class="post-icons">
                                <button class="post-icon-btn" title="画像"><i class="fas fa-image"></i></button>
                                <button class="post-icon-btn" title="GIF"><i class="fas fa-film"></i></button>
                                <button class="post-icon-btn" title="絵文字"><i class="fas fa-smile"></i></button>
                                <button class="post-icon-btn" title="場所"><i class="fas fa-map-marker-alt"></i></button>
                            </div>
                            <button class="tweet-btn" id="tweetBtn" onclick="TimelineComponent.postTweet()">ツイート</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pull-to-refresh">
                <div class="pull-indicator" id="pullIndicator">
                    <div class="pull-spinner"></div>
                    <div class="pull-text">引っ張って更新</div>
                </div>
                <div class="timeline-container" id="timelineContainer">
                    <div class="timeline" id="timeline">
                        <div class="loading">読み込み中...</div>
                    </div>
                </div>
            </div>
        `;

        // テキストエリアの入力監視
        const textarea = document.getElementById('postTextarea');
        const tweetBtn = document.getElementById('tweetBtn');
        
        textarea.addEventListener('input', function() {
            tweetBtn.disabled = !this.value.trim();
        });

        // 引っ張って更新のイベントバインド
        this.bindPullToRefreshEvents();

        // タイムラインを読み込み
        this.loadTimeline();
    },

    // タブ切り替え
    switchTab(tabElement) {
        // アクティブタブの更新
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        tabElement.classList.add('active');

        // 状態更新
        this.state.currentTab = tabElement.dataset.tab;
        
        // タイムラインを再読み込み
        this.loadTimeline();
    },

    // タイムライン読み込み
    async loadTimeline() {
        try {
            const posts = await API.getTimeline(this.state.currentTab);
            this.state.posts = posts;
            this.renderPosts();
        } catch (error) {
            console.error('タイムラインの読み込みに失敗しました:', error);
            this.renderError();
        }
    },

    // 投稿のレンダリング
    renderPosts() {
        const timeline = document.getElementById('timeline');
        
        if (this.state.posts.length === 0) {
            timeline.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <p>投稿がありません</p>
                </div>
            `;
            return;
        }

        timeline.innerHTML = this.state.posts.map(post => `
            <div class="post-card">
                <div class="post-header">
                    <div class="post-avatar">${post.user.avatar}</div>
                    <div class="post-user-info">
                        <div class="post-username">
                            <span>${post.user.name}</span>
                            <span class="post-meta">${post.user.handle} · ${post.time}</span>
                        </div>
                    </div>
                </div>
                <div class="post-text">${post.text.replace(/\n/g, '<br>')}</div>
                ${post.image ? `<div class="post-image">${post.image}</div>` : ''}
                <div class="post-engagement">
                    <button class="engagement-btn" onclick="TimelineComponent.openCommentModal(${post.id})"><i class="fas fa-comment"></i> ${post.engagement.comments}</button>
                    <button class="engagement-btn"><i class="fas fa-retweet"></i> ${post.engagement.retweets}</button>
                    <button class="engagement-btn"><i class="fas fa-heart"></i> ${post.engagement.likes}</button>
                    <button class="engagement-btn"><i class="fas fa-share"></i> ${post.engagement.shares}</button>
                </div>
            </div>
        `).join('');
    },

    // エラー表示
    renderError() {
        const timeline = document.getElementById('timeline');
        timeline.innerHTML = `
            <div class="error">
                <div>
                    <h2>読み込みエラー</h2>
                    <p>タイムラインの読み込みに失敗しました。</p>
                    <button onclick="TimelineComponent.loadTimeline()" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">再読み込み</button>
                </div>
            </div>
        `;
    },

    // 投稿機能
    async postTweet() {
        const textarea = document.getElementById('postTextarea');
        const content = textarea.value.trim();
        
        if (!content) {
            alert('投稿内容を入力してください');
            return;
        }

        // 認証チェック
        const token = API.getCookie('authToken');
        if (!token) {
            alert('投稿するにはログインしてください');
            return;
        }

        const result = await API.postTweet(content);
        if (result.success) {
            textarea.value = '';
            document.getElementById('tweetBtn').disabled = true;
            alert('投稿しました！');
            this.loadTimeline();
        } else {
            alert(`投稿に失敗しました: ${result.error}`);
        }
    },

    // 引っ張って更新のイベントバインド
    bindPullToRefreshEvents() {
        const timelineContainer = document.getElementById('timelineContainer');
        const pullIndicator = document.getElementById('pullIndicator');
        
        if (!timelineContainer || !pullIndicator) return;

        // タッチイベント
        timelineContainer.addEventListener('touchstart', (e) => {
            // タッチが1つの場合のみ処理
            if (e.touches.length === 1) {
                this.handlePullStart(e.touches[0].clientY);
            }
        }, { passive: true });

        timelineContainer.addEventListener('touchmove', (e) => {
            // タッチが1つの場合のみ処理
            if (e.touches.length === 1) {
                this.handlePullMove(e.touches[0].clientY);
                
                // 引っ張り中はデフォルトのスクロール動作を防止
                if (this.state.pullDistance > 0) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        timelineContainer.addEventListener('touchend', () => {
            this.handlePullEnd();
        });

        // タッチキャンセル時の処理
        timelineContainer.addEventListener('touchcancel', () => {
            this.handlePullEnd();
        });

        // マウスイベント（デスクトップ用）
        let isMouseDown = false;
        
        timelineContainer.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            this.handlePullStart(e.clientY);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            this.handlePullMove(e.clientY);
        });

        document.addEventListener('mouseup', () => {
            if (!isMouseDown) return;
            isMouseDown = false;
            this.handlePullEnd();
        });
    },

    // 引っ張り開始処理
    handlePullStart(clientY) {
        const timelineContainer = document.getElementById('timelineContainer');
        
        // タイムラインが最上部にある場合のみ引っ張りを有効にする
        if (timelineContainer.scrollTop === 0 && !this.state.isRefreshing) {
            this.state.pullStartY = clientY;
            this.state.pullCurrentY = clientY;
            this.state.pullDistance = 0;
            
            // モバイルでのバウンス効果を防止
            if (timelineContainer.style) {
                timelineContainer.style.overflowY = 'hidden';
            }
        }
    },

    // 引っ張り中処理
    handlePullMove(clientY) {
        if (this.state.pullStartY === 0 || this.state.isRefreshing) return;

        const timelineContainer = document.getElementById('timelineContainer');
        
        // タイムラインが最上部にある場合のみ処理
        if (timelineContainer.scrollTop > 0) return;

        this.state.pullCurrentY = clientY;
        this.state.pullDistance = Math.min(
            this.state.pullCurrentY - this.state.pullStartY,
            this.state.maxPullDistance
        );

        // 引っ張り距離に応じてインジケーターを表示
        const pullIndicator = document.getElementById('pullIndicator');
        if (this.state.pullDistance > 0) {
            const opacity = Math.min(this.state.pullDistance / this.state.pullThreshold, 1);
            pullIndicator.style.transform = `translateY(${Math.min(this.state.pullDistance, 50)}px)`;
            pullIndicator.style.opacity = opacity;
            
            // スレッショルドを超えたら更新テキストを変更
            const pullText = pullIndicator.querySelector('.pull-text');
            if (this.state.pullDistance >= this.state.pullThreshold) {
                pullText.textContent = '離して更新';
            } else {
                pullText.textContent = '引っ張って更新';
            }
        }
    },

    // 引っ張り終了処理
    async handlePullEnd() {
        if (this.state.pullStartY === 0 || this.state.isRefreshing) return;

        const timelineContainer = document.getElementById('timelineContainer');
        const pullIndicator = document.getElementById('pullIndicator');
        
        // スクロールを再有効化
        if (timelineContainer.style) {
            timelineContainer.style.overflowY = 'auto';
        }
        
        // スレッショルドを超えていたら更新を実行
        if (this.state.pullDistance >= this.state.pullThreshold) {
            await this.performRefresh();
        } else {
            // スレッショルドに達していない場合はインジケーターを非表示
            pullIndicator.style.transform = 'translateY(0)';
            pullIndicator.style.opacity = '0';
        }

        // 状態をリセット
        this.state.pullStartY = 0;
        this.state.pullCurrentY = 0;
        this.state.pullDistance = 0;
    },

    // 更新実行
    async performRefresh() {
        const pullIndicator = document.getElementById('pullIndicator');
        
        // 更新中状態にする
        this.state.isRefreshing = true;
        pullIndicator.classList.add('refreshing');
        
        try {
            // タイムラインを再読み込み
            await this.loadTimeline();
            
            // 成功したら更新完了を表示
            const pullText = pullIndicator.querySelector('.pull-text');
            pullText.textContent = '更新完了';
            pullText.style.display = 'block';
            
            // 1秒後にインジケーターを非表示
            setTimeout(() => {
                pullIndicator.classList.remove('refreshing');
                pullIndicator.style.transform = 'translateY(0)';
                pullIndicator.style.opacity = '0';
                pullText.style.display = 'none';
                pullText.textContent = '引っ張って更新';
                this.state.isRefreshing = false;
            }, 1000);
            
        } catch (error) {
            console.error('更新に失敗しました:', error);
            
            // エラー表示
            const pullText = pullIndicator.querySelector('.pull-text');
            pullText.textContent = '更新失敗';
            pullText.style.display = 'block';
            
            // 2秒後にインジケーターを非表示
            setTimeout(() => {
                pullIndicator.classList.remove('refreshing');
                pullIndicator.style.transform = 'translateY(0)';
                pullIndicator.style.opacity = '0';
                pullText.style.display = 'none';
                pullText.textContent = '引っ張って更新';
                this.state.isRefreshing = false;
            }, 2000);
        }
    },

    // コメントモーダルを開く
    openCommentModal(postId) {
        router.navigate('comment', [postId]);
    }
};

// コンポーネントをルーターに登録
router.register('timeline', TimelineComponent);