// タイムラインコンポーネント
const TimelineComponent = {
    // 状態管理
    state: {
        currentTab: 'recommend',
        posts: [],
        currentPage: 1,
        hasMorePosts: true,
        isLoadingMore: false,
        isRefreshing: false,
        isPulling: false,
        pullStartY: 0,
        pullCurrentY: 0,
        pullDistance: 0,
        maxPullDistance: 120,
        pullThreshold: 80,
        selectedImage: null,
        autoRefreshInterval: null,
        lastRefreshTime: null,
        selectedShop: null,
        manualRefreshTriggered: false
    },

    _initialized: false,

    init() {
        if (this._initialized) {
            return;
        }
        this.bindEvents();
        this._initialized = true;
    },

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                this.switchTab(e.target);
            }
        });

        document.addEventListener('click', (e) => {
            const externalLink = e.target.closest('.timeline-external-link');
            if (externalLink) {
                e.preventDefault();
                e.stopPropagation();
                const encodedUrl = externalLink.getAttribute('data-url');
                if (encodedUrl) {
                    router.navigate('external-link', [encodedUrl]);
                }
            }
        });
        
        // ページの表示状態が変わったときに自動更新を再設定
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoRefresh();
            } else {
                this.setupAutoRefresh();
            }
        });
    },

    // 設定から自動更新の状態を取得
    isAutoRefreshEnabled() {
        try {
            const settings = JSON.parse(localStorage.getItem('appSettings'));
            if (!settings || typeof settings.autoRefresh === 'undefined') {
                return true;
            }
            return settings.autoRefresh === true;
        } catch (e) {
            console.error("Failed to get auto refresh setting", e);
            return false;
        }
    },

    // 自動更新を設定
    setupAutoRefresh() {
        this.stopAutoRefresh(); // 既存の自動更新をクリア
        
        if (this.isAutoRefreshEnabled()) {
            // 5分ごとに自動更新
            this.state.autoRefreshInterval = setInterval(() => {
                this.refreshTimeline();
            }, 300000);
        }
    },

    // 自動更新を停止
    stopAutoRefresh() {
        if (this.state.autoRefreshInterval) {
            clearInterval(this.state.autoRefreshInterval);
            this.state.autoRefreshInterval = null;
        }
    },

    // タイムラインを更新（新着投稿のみ）
    async refreshTimeline() {
        if (this.state.isLoadingMore || this.state.isRefreshing) return;

        this.state.isRefreshing = true;
        this.state.lastRefreshTime = new Date();

        if (this.state.manualRefreshTriggered) {
            const indicator = document.getElementById('pullToRefreshIndicator');
            if (indicator) {
                indicator.classList.add('active');
                indicator.classList.add('refreshing');
                indicator.style.height = '60px';
                indicator.textContent = '更新中...';
            }
        }

        try {
            // 現在の最新投稿IDを保持
            const latestPostId = this.state.posts.length > 0 ? this.state.posts[0].id : null;
            
            // タイムラインを再読み込み
            const result = await API.getTimeline(this.state.currentTab, 1);
            
            if (result.posts.length > 0) {
                // 新着投稿のみを抽出
                let newPosts = result.posts;
                if (latestPostId) {
                    newPosts = result.posts.filter(post => post.id > latestPostId);
                }
                
                if (newPosts.length > 0) {
                    // 新着投稿を先頭に追加
                    this.state.posts = [...newPosts, ...this.state.posts];
                    this.prependPosts(newPosts);
                    
                    // 新着投稿があることを通知
                    this.showNewPostsNotification(newPosts.length);
                }
            }
        } catch (error) {
            console.error('Error refreshing timeline:', error);
        } finally {
            this.state.isRefreshing = false;

            if (this.state.manualRefreshTriggered) {
                const indicator = document.getElementById('pullToRefreshIndicator');
                if (indicator) {
                    indicator.textContent = '最新の投稿を取得しました';
                }
                setTimeout(() => {
                    const indicatorElement = document.getElementById('pullToRefreshIndicator');
                    if (indicatorElement) {
                        indicatorElement.style.height = '0px';
                        indicatorElement.classList.remove('refreshing');
                        indicatorElement.classList.remove('active');
                        indicatorElement.textContent = '引っ張って更新';
                    }
                }, 1000);
                this.state.manualRefreshTriggered = false;
            }
        }
    },

    setupPullToRefresh() {
        const container = document.getElementById('timelineContainer');
        const timeline = document.getElementById('timeline');
        const indicator = document.getElementById('pullToRefreshIndicator');

        if (!container || !timeline || !indicator) return;

        if (container.dataset.pullListenersAttached === 'true') {
            return;
        }

        container.dataset.pullListenersAttached = 'true';

        const onPointerStart = (event) => this.onPullStart(event);
        const onPointerMove = (event) => this.onPullMove(event);
        const onPointerEnd = (event) => this.onPullEnd(event);

        container.addEventListener('touchstart', onPointerStart, { passive: true });
        container.addEventListener('touchmove', onPointerMove, { passive: false });
        container.addEventListener('touchend', onPointerEnd);
        container.addEventListener('touchcancel', onPointerEnd);

        container.addEventListener('mousedown', onPointerStart);
        container.addEventListener('mousemove', onPointerMove);
        container.addEventListener('mouseup', onPointerEnd);
        container.addEventListener('mouseleave', onPointerEnd);
    },

    onPullStart(event) {
        const container = document.getElementById('timelineContainer');
        if (!container || this.state.isRefreshing) return;

        if (event.type === 'mousedown' && event.button !== 0) {
            return;
        }

        if (container.scrollTop > 0) {
            this.state.isPulling = false;
            return;
        }

        const startY = this.getEventClientY(event);
        if (startY === null) {
            this.state.isPulling = false;
            return;
        }

        this.state.isPulling = true;
        this.state.pullStartY = startY;
        this.state.pullCurrentY = startY;
        this.state.pullDistance = 0;

        const indicator = document.getElementById('pullToRefreshIndicator');
        if (indicator) {
            indicator.style.height = '0px';
            indicator.textContent = '引っ張って更新';
            indicator.classList.add('active');
        }
    },

    onPullMove(event) {
        if (!this.state.isPulling || this.state.isRefreshing) return;

        const container = document.getElementById('timelineContainer');
        const timeline = document.getElementById('timeline');
        const indicator = document.getElementById('pullToRefreshIndicator');
        if (!container || !timeline || !indicator) return;

        if (container.scrollTop > 0) {
            this.onPullEnd(event);
            return;
        }

        const currentY = this.getEventClientY(event);
        if (currentY === null) return;

        const distance = Math.max(0, currentY - this.state.pullStartY);
        if (distance <= 0) return;

        if (event.cancelable) {
            event.preventDefault();
        }

        const limitedDistance = Math.min(distance, this.state.maxPullDistance);
        this.state.pullCurrentY = currentY;
        this.state.pullDistance = limitedDistance;

        timeline.style.transition = 'none';
        timeline.style.transform = `translateY(${limitedDistance}px)`;

        indicator.style.height = `${limitedDistance}px`;
        indicator.textContent = limitedDistance >= this.state.pullThreshold ? '離して更新' : '引っ張って更新';
    },

    onPullEnd(event) {
        if (!this.state.isPulling) return;

        this.state.isPulling = false;
        const shouldRefresh = this.state.pullDistance >= this.state.pullThreshold && !this.state.isRefreshing;

        this.resetPullStyles(shouldRefresh);

        if (shouldRefresh) {
            this.state.manualRefreshTriggered = true;
            this.refreshTimeline();
        }
    },

    resetPullStyles(keepIndicatorVisible = false) {
        const timeline = document.getElementById('timeline');
        const indicator = document.getElementById('pullToRefreshIndicator');

        if (timeline) {
            timeline.style.transition = 'transform 0.2s ease';
            timeline.style.transform = 'translateY(0px)';
            setTimeout(() => {
                timeline.style.transition = '';
            }, 200);
        }

        if (indicator) {
            if (keepIndicatorVisible) {
                indicator.style.height = '60px';
                indicator.classList.add('active');
                indicator.textContent = '更新中...';
            } else {
                indicator.style.height = '0px';
                indicator.classList.remove('active');
                indicator.classList.remove('refreshing');
                indicator.textContent = '引っ張って更新';
            }
        }

        this.state.pullDistance = 0;
    },

    getEventClientY(event) {
        if (event.touches && event.touches.length > 0) {
            return event.touches[0].clientY;
        }
        if (event.changedTouches && event.changedTouches.length > 0) {
            return event.changedTouches[0].clientY;
        }
        if (typeof event.clientY === 'number') {
            return event.clientY;
        }
        return null;
    },

    // 新着投稿をDOMの先頭に追加
    prependPosts(newPosts) {
        const timeline = document.getElementById('timeline');
        const postsHTML = newPosts.map(post => this.createPostHTML(post)).join('');
        timeline.insertAdjacentHTML('afterbegin', postsHTML);
        
        // 遅延読み込みを設定
        this.setupLazyLoading();
    },

    // 新着投稿通知を表示
    showNewPostsNotification(count) {
        const notification = document.createElement('div');
        notification.className = 'new-posts-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--color-primary);
            color: #fff;
            padding: 10px 20px;
            border-radius: 20px;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            transition: opacity 0.3s;
        `;
        notification.textContent = `${count}件の新着投稿があります`;
        
        document.body.appendChild(notification);
        
        // 3秒後に通知を非表示
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    render(params = []) {
        this.init();
        this.state.selectedImage = null;
        const contentArea = document.getElementById('contentArea');
        
        // ログイン状態をチェック
        const isLoggedIn = !!API.getCookie('authToken');
        const currentUser = API.getCurrentUser();
        const currentUserIconSrc = API.escapeHtml((currentUser && currentUser.profile_image_url) || 'assets/baseicon.png');

        contentArea.innerHTML = `
            <style>
                /* ... styles ... */
                .post-input-area {
                    padding: 20px;
                    margin: 0 16px 20px;
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    background: var(--color-surface);
                    box-shadow: var(--shadow-xs);
                }
                .post-input-wrapper { display: flex; gap: 12px; }
                .post-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--color-primary); flex-shrink: 0; }
                .post-input-content { flex: 1; }
                .post-textarea { width: 100%; background: transparent; border: none; font-size: 20px; resize: none; outline: none; min-height: 60px; color: inherit; }
                .post-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
                .post-icons { display: flex; gap: 4px; }
                .post-icon-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: transparent; color: var(--color-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease, background-color 0.2s ease; }
                .post-icon-btn:hover { background: var(--color-primary-soft); transform: translateY(-1px); }
                .tweet-btn { background: linear-gradient(135deg, var(--color-primary), var(--color-accent)); color: #fff; border: none; padding: 10px 24px; border-radius: 999px; font-weight: bold; cursor: pointer; box-shadow: var(--shadow-xs); transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .tweet-btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
                .tweet-btn:disabled { background: rgba(120, 108, 95, 0.25); cursor: not-allowed; box-shadow: none; transform: none; }
                .char-counter { color: var(--color-muted); font-size: 14px; margin-right: 12px; }
                .char-counter.warning { color: #ff9800; }
                .char-counter.error { color: #f44336; }
                .timeline-container { position: relative; overflow-y: auto; height: calc(100vh - 180px); overscroll-behavior: contain; }
                .pull-to-refresh-indicator {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-muted);
                    font-size: 14px;
                    height: 0;
                    transition: height 0.2s ease, opacity 0.2s ease;
                    opacity: 0;
                    overflow: hidden;
                }
                .pull-to-refresh-indicator.active {
                    opacity: 1;
                }
                .pull-to-refresh-indicator.refreshing {
                    opacity: 1;
                    font-weight: 600;
                }
                .dark-mode .pull-to-refresh-indicator {
                    color: rgba(47, 37, 25, 0.45);
                }
                .post-card {
                    background: var(--color-surface);
                    border: 1px solid rgba(231, 220, 205, 0.7);
                    border-radius: var(--radius-lg);
                    padding: 20px;
                    margin: 0 16px 20px;
                    box-shadow: var(--shadow-xs);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .post-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
                .post-header { display: flex; gap: 12px; margin-bottom: 12px; cursor: pointer; }
                .post-user-info { flex: 1; }
                .post-username { font-weight: bold; }
                .post-meta { color: var(--color-muted); font-size: 14px; }
                .post-engagement { display: flex; justify-content: space-around; margin-top: 12px; padding-top: 12px; }
                .engagement-btn { display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: var(--color-muted); cursor: pointer; padding: 6px 10px; border-radius: 999px; transition: background-color 0.2s ease, color 0.2s ease; }
                .engagement-btn:hover { background: var(--color-primary-soft); color: var(--color-primary); }
                .engagement-btn .liked { color: #e0245e; }
                .image-preview { max-width: 100px; max-height: 100px; border-radius: 10px; margin-top: 10px; }
                #timelineLoadingIndicator { text-align: center; padding: 20px; }
                .post-content {
                    line-height: 1.4;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    white-space: pre-wrap;
                    max-width: 100%;
                }
                .post-content.collapsed {
                    max-height: 4.2em;
                    overflow: hidden;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    white-space: pre-wrap;
                    max-width: 100%;
                }
                .show-more-btn { background: none; border: none; color: var(--color-primary); cursor: pointer; font-size: 14px; padding: 4px 0; }
                .show-more-btn:hover { text-decoration: underline; }
                .shop-reference { margin-top: 12px; padding: 14px; background: var(--color-surface-muted); border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s ease, transform 0.2s ease; border: 1px solid rgba(231, 220, 205, 0.5); }
                .shop-reference:hover { background: rgba(212, 165, 116, 0.12); transform: translateY(-1px); }
                .shop-reference-content { display: flex; align-items: center; color: var(--color-primary); }
                .shop-reference-content i { margin-right: 8px; }
                
                /* ログイン促しエリアのスタイル */
                .login-prompt-area {
                    padding: 20px;
                    border-bottom: 1px solid var(--color-border);
                    text-align: center;
                    background: var(--color-surface-muted);
                }
                .login-prompt-text {
                    margin-bottom: 16px;
                    color: var(--color-muted);
                    font-size: 16px;
                }
                .login-btn {
                    background: var(--color-primary);
                    color: #fff;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 20px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 16px;
                }
                .login-btn:hover {
                    background: var(--color-primary-hover);
                }

                /* Dark Mode Overrides */
                .dark-mode .post-input-area,
                .dark-mode .post-card {
                    background: #2a2a2a;
                    border-color: #3a3126;
                    box-shadow: none;
                }
                .dark-mode .post-card:hover {
                    background: #342b1f;
                }
                .dark-mode .post-meta,
                .dark-mode .char-counter,
                .dark-mode .engagement-btn {
                    color: rgba(255, 255, 255, 0.65);
                }
                .dark-mode .tweet-btn:disabled {
                    background: rgba(255, 255, 255, 0.12);
                    color: rgba(255, 255, 255, 0.5);
                }
                .dark-mode .shop-reference { background: #3a3126; border-color: #4a3f32; }
                .dark-mode .shop-reference:hover { background: #44392d; }
                .dark-mode .shop-reference-content { color: var(--color-primary); }
                .dark-mode .login-prompt-area { background: #2a2a2a; }
                .dark-mode .login-prompt-text { color: rgba(255, 255, 255, 0.65); }
                
                /* 通報モーダルスタイル */
                .report-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .report-modal {
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    width: 90%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: var(--shadow-md);
                    border: 1px solid rgba(231, 220, 205, 0.7);
                }
                .report-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                }
                .report-modal-header h3 {
                    margin: 0;
                }
                .close-modal {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--color-muted);
                    transition: color 0.2s ease;
                }
                .close-modal:hover { color: var(--color-primary); }
                .report-modal-content {
                    padding: 16px;
                    flex: 1;
                    overflow-y: auto;
                }
                .report-reason {
                    margin-bottom: 16px;
                }
                .report-reason label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                }
                .report-reason select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    outline: none;
                }
                .report-description {
                    margin-bottom: 16px;
                }
                .report-description label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                }
                .report-description textarea {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    outline: none;
                    resize: vertical;
                    min-height: 100px;
                }
                .report-modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 16px;
                    border-top: 1px solid var(--color-border);
                }
                .report-btn {
                    background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
                    color: #fff;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 999px;
                    cursor: pointer;
                    font-weight: 600;
                    box-shadow: var(--shadow-xs);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .report-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
                .cancel-btn {
                    background: transparent;
                    color: var(--color-muted);
                    border: 1px solid var(--color-border);
                    padding: 10px 20px;
                    border-radius: 999px;
                    cursor: pointer;
                    transition: background-color 0.2s ease, color 0.2s ease;
                }
                .cancel-btn:hover { background: var(--color-surface-muted); color: var(--color-primary); }
                .dark-mode .report-modal {
                    background: #2a2a2a;
                    color: #e0e0e0;
                }
                .dark-mode .report-modal-header,
                .dark-mode .report-modal-content,
                .dark-mode .report-modal-actions {
                    border-color: #333;
                }
                .dark-mode .report-reason select,
                .dark-mode .report-description textarea {
                    background: #333;
                    border-color: #444;
                    color: #e0e0e0;
                }
                .dark-mode .cancel-btn {
                    border-color: #444;
                    color: rgba(47, 37, 25, 0.45);
                }
            </style>
            
            ${isLoggedIn ? `
            <div class="post-input-area">
                <div class="post-input-wrapper">
                    <div class="post-avatar"><img src="${currentUserIconSrc}" alt="User Icon" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"></div>
                    <div class="post-input-content">
                        <textarea class="post-textarea" placeholder="今日食べる二郎は？" id="postTextarea" maxlength="200"></textarea>
                        <div id="imagePreviewContainer"></div>
                        <div id="shopPreviewContainer"></div>
                        <div class="post-actions">
                            <div class="post-icons">
                                <input type="file" id="imageUpload" accept="image/*" style="display: none;">
                                <button class="post-icon-btn" title="画像" onclick="document.getElementById('imageUpload').click()"><i class="fas fa-image"></i></button>
                                <button class="post-icon-btn" title="店舗" onclick="TimelineComponent.openShopModal()"><i class="fas fa-store"></i></button>
                            </div>
                            <div style="display: flex; align-items: center;">
                                <span class="char-counter" id="charCounter">0/200</span>
                                <button class="tweet-btn" id="tweetBtn" onclick="TimelineComponent.postTweet()" disabled>ツイート</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ` : `
            <div class="login-prompt-area">
                <div class="login-prompt-text">ログインして二郎を共有しよう</div>
                <button class="login-btn" onclick="router.navigate('auth', ['login'])">ログイン</button>
            </div>
            `}

            <div class="timeline-container" id="timelineContainer">
                <div class="pull-to-refresh-indicator" id="pullToRefreshIndicator">引っ張って更新</div>
                <div class="timeline" id="timeline"></div>
            </div>
        `;

        this.setupEventListeners();
        this.loadInitialPosts();
        this.setupAutoRefresh(); // 自動更新を設定
        
        // チェックイン通知を確認
        this.checkForNearbyShops();
    },

    setupEventListeners() {
        const timelineContainer = document.getElementById('timelineContainer');
        if (timelineContainer) {
            timelineContainer.onscroll = this.debounce(this.handleScroll.bind(this), 100);
        }

        const textarea = document.getElementById('postTextarea');
        const tweetBtn = document.getElementById('tweetBtn');
        const imageUpload = document.getElementById('imageUpload');
        
        // ログインしている場合のみイベントリスナーを設定
        if (textarea && tweetBtn && imageUpload) {
            textarea.addEventListener('input', () => {
                // テキストをフィルタリング
                const originalValue = textarea.value;
                const filteredValue = this.filterText(originalValue);
                
                // フィルタリング後に内容が変わった場合は修正
                if (filteredValue !== originalValue) {
                    const cursorPosition = textarea.selectionStart;
                    textarea.value = filteredValue;
                    
                    // カーソル位置を調整（削除された文字数を考慮）
                    const diff = originalValue.length - filteredValue.length;
                    textarea.setSelectionRange(Math.max(0, cursorPosition - diff), Math.max(0, cursorPosition - diff));
                }
                
                const length = textarea.value.length;
                const charCounter = document.getElementById('charCounter');
                if (charCounter) {
                    charCounter.textContent = `${length}/200`;
                    
                    // 文字数に応じて色を変更
                    charCounter.classList.remove('warning', 'error');
                    if (length > 180) {
                        charCounter.classList.add('error');
                    } else if (length > 150) {
                        charCounter.classList.add('warning');
                    }
                }
                
                tweetBtn.disabled = (!textarea.value.trim() && !this.state.selectedImage && !this.state.selectedShop) || length > 200;
            });
            imageUpload.addEventListener('change', (event) => this.handleImageSelect(event));
        }

        // GPS権限を確認
        this.checkGPSPermission();

        // プル・トゥ・リフレッシュ設定
        this.setupPullToRefresh();
    },

    debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    },

    handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            this.loadMorePosts();
        }
    },

    async loadInitialPosts() {
        this.state.posts = [];
        this.state.currentPage = 1;
        this.state.hasMorePosts = true;
        document.getElementById('timeline').innerHTML = '<div class="loading">読み込み中...</div>';
        await this.loadMorePosts();
    },

    async loadMorePosts() {
        if (this.state.isLoadingMore || !this.state.hasMorePosts) return;

        this.state.isLoadingMore = true;
        this.showLoadingIndicator(true);

        try {
            const result = await API.getTimeline(this.state.currentTab, this.state.currentPage);

            if (this.state.currentPage === 1) {
                document.getElementById('timeline').innerHTML = ''; // Clear loading message
            }

            if (result.posts.length > 0) {
                this.state.posts.push(...result.posts);
                this.appendPosts(result.posts);
                this.state.currentPage++;
            }

            this.state.hasMorePosts = result.hasMore;

            if (this.state.posts.length === 0 && !this.state.hasMorePosts) {
                document.getElementById('timeline').innerHTML = `<div style="text-align: center; padding: 40px; color: var(--color-muted);"><p>投稿がありません</p></div>`;
            }

        } catch (error) {
            console.error('Error loading more posts:', error);
            this.renderError();
        } finally {
            this.state.isLoadingMore = false;
            this.showLoadingIndicator(false);
        }
    },

    appendPosts(newPosts) {
        const timeline = document.getElementById('timeline');
        const postsHTML = newPosts.map(post => this.createPostHTML(post)).join('');
        timeline.insertAdjacentHTML('beforeend', postsHTML);
        
        // 遅延読み込みを設定
        this.setupLazyLoading();
    },

    createPostHTML(post) {
        // ユーザーハンドルの@を除去してエスケープ
        const userHandle = post.user.handle ? post.user.handle.substring(1) : '';
        const escapedUserHandle = API.escapeHtml(userHandle);

        const currentUser = API.getCurrentUser();
        const isOwner = currentUser && String(currentUser.id) === String(post.user_id);

        return `
            <div class="post-card" id="post-${post.id}" onclick="router.navigate('comment', [${post.id}])">
                <div class="post-header" onclick="event.stopPropagation(); router.navigate('profile', ['${escapedUserHandle}'])">
                    <div class="post-avatar">${post.user.avatar}</div>
                    <div class="post-user-info">
                        <div class="post-username">
                            <span>${API.escapeHtml(post.user.name)}</span>
                            <span class="post-meta">${API.escapeHtml(post.user.handle)} · ${API.escapeHtml(post.time)}</span>
                        </div>
                    </div>
                </div>
                <div class="post-text" id="post-text-${post.id}">
                    <div class="post-content collapsed" id="post-content-${post.id}">${this.formatPostText(post.text)}</div>
                    ${this.isLongText(post.text) ? `<button class="show-more-btn" onclick="event.stopPropagation(); TimelineComponent.toggleText(${post.id})">もっと見る</button>` : ''}
                </div>
                ${post.shop_id ? `
                <div class="shop-reference" onclick="event.stopPropagation(); router.navigate('shop', [${post.shop_id}])">
                    <div class="shop-reference-content">
                        <i class="fas fa-store"></i>
                        <span>${API.escapeHtml(post.shop_name || '')}</span>
                    </div>
                </div>
                ` : ''}
                ${this.createPostImageHTML(post)}
                <div class="post-engagement">
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.openCommentModal(${post.id})">
                        <i class="fas fa-comment"></i> ${post.engagement.comments}
                    </button>
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.handleLike(${post.id})">
                        <i class="fas fa-heart ${post.isLiked ? 'liked' : ''}"></i> <span>${post.engagement.likes}</span>
                    </button>
                    ${!isOwner ? `
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.openReportModal(${post.id})" title="通報">
                        <i class="fas fa-flag"></i>
                    </button>
                    ` : ''}
                    ${isOwner ? `
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.confirmAndDeletePost(${post.id})" title="削除">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            </div>
        `;
    },

    formatPostText(text) {
        if (!text) {
            return '';
        }

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const normalizedText = text.replace(/\r\n/g, '\n');
        const parts = normalizedText.split(urlRegex);

        const formatted = parts.map((part, index) => {
            // 奇数インデックスは正規表現にマッチしたURL
            if (index % 2 === 1) {
                const encodedUrl = encodeURIComponent(part);
                const safeText = API.escapeHtml(part);
                return `<a href="#" class="timeline-external-link" data-url="${encodedUrl}">${safeText}</a>`;
            }
            return API.escapeHtml(part);
        }).join('');

        return formatted.replace(/\n/g, '<br>');
    },

    showLoadingIndicator(show) {
        let indicator = document.getElementById('timelineLoadingIndicator');
        const container = document.getElementById('timeline');
        if (show) {
            if (!indicator && container) {
                indicator = document.createElement('div');
                indicator.id = 'timelineLoadingIndicator';
                indicator.className = 'loading';
                indicator.textContent = 'さらに読み込み中...';
                container.appendChild(indicator);
            }
        } else {
            if (indicator) {
                indicator.remove();
            }
        }
    },

    switchTab(tabElement) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        tabElement.classList.add('active');
        this.state.currentTab = tabElement.dataset.tab;

        // フォロー中タブの場合、ログイン状態を確認
        if (this.state.currentTab === 'following') {
            const token = API.getCookie('authToken');
            if (!token) {
                // ログインしていない場合、ログインを促すメッセージを表示
                const timeline = document.getElementById('timeline');
                if (timeline) {
                    timeline.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: var(--color-muted);">
                            <p style="margin-bottom: 16px;">フォロー中のユーザーの投稿を見るにはログインが必要です。</p>
                        </div>
                    `;
                }
                // Attach event listener to login button
                const loginBtn = document.querySelector('#timeline .login-btn[data-action="login"]');
                if (loginBtn) {
                    loginBtn.addEventListener('click', function() {
                        router.navigate('auth', ['login']);
                    });
                }
                // 投稿の読み込みは行わない
                return;
            }
        }

        // 投稿を読み込み
        this.loadInitialPosts();
        this.setupAutoRefresh();
    },

    async handleLike(postId) {
        const token = API.getCookie('authToken');
        if (!token) {
            alert('いいねするにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        const post = this.state.posts.find(p => p.id === postId);
        if (!post) return;

        const originalLikedState = post.isLiked;
        const originalLikesCount = post.engagement.likes;

        post.isLiked = !post.isLiked;
        post.engagement.likes += post.isLiked ? 1 : -1;
        this.updatePostDOM(postId);

        try {
            const result = post.isLiked ? await API.likePost(postId) : await API.unlikePost(postId);
            if (!result.success) {
                post.isLiked = originalLikedState;
                post.engagement.likes = originalLikesCount;
                this.updatePostDOM(postId);
                alert(`エラー: ${result.error}`);
            }
        } catch (error) {
            post.isLiked = originalLikedState;
            post.engagement.likes = originalLikesCount;
            this.updatePostDOM(postId);
            alert('いいねに失敗しました。');
        }
    },

    updatePostDOM(postId) {
        const post = this.state.posts.find(p => p.id === postId);
        if (!post) return;

        const postElement = document.getElementById(`post-${postId}`);
        if (!postElement) return;

        const likeButton = postElement.querySelector('.fa-heart');
        const likeCount = likeButton.nextElementSibling;

        likeButton.classList.toggle('liked', post.isLiked);
        likeCount.textContent = post.engagement.likes;
    },

    // 通常で使われる文字のみを許可するフィルタリング関数
    filterText(text) {
        // 許可する文字：ひらがな、カタカナ、漢字、英数字、記号（一部）、絵文字
        // Unicode範囲：
        // \u3040-\u309F: ひらがな
        // \u30A0-\u30FF: カタカナ
        // \u4E00-\u9FAF: 漢字（主な範囲）
        // \u3000-\u303F: 日本語の記号
        // \uFF00-\uFFEF: 半角カタカナ、全角記号など
        // \u2600-\u26FF: 各種記号
        // \u2700-\u27BF: 補助記号
        // \u1F600-\u1F64F: 絵文字（顔）
        // \u1F300-\u1F5FF: 絵文字（記号）
        // \u1F680-\u1F6FF: 絵文字（交通・記号）
        // \u1F700-\u1F77F: 絵文字（絵文字文字）
        // \u1F780-\u1F7FF: 絵文字（拡張）
        // \u1F800-\u1F8FF: 絵文字（補助）
        // \u1F900-\u1F9FF: 絵文字（補助記号）
        // \u2000-\u206F: 一般句読点
        // \u0020-\u007E: 基本ラテン文字（ASCII）
        // \u00A0-\u00FF: ラテン文字補助
        const allowedPattern = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\uFF00-\uFFEF\u2600-\u26FF\u2700-\u27BF\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u1F700-\u1F77F\u1F780-\u1F7FF\u1F800-\u1F8FF\u1F900-\u1F9FF\u2000-\u206F\u0020-\u007E\u00A0-\u00FF\s]+$/;
        
        // 改行と空白は許可
        const cleanedText = text.replace(/\s+/g, ' ').trim();
        
        if (!allowedPattern.test(cleanedText)) {
            // 許可されていない文字を削除
            return cleanedText.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\uFF00-\uFFEF\u2600-\u26FF\u2700-\u27BF\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u1F700-\u1F77F\u1F780-\u1F7FF\u1F800-\u1F8FF\u1F900-\u1F9FF\u2000-\u206F\u0020-\u007E\u00A0-\u00FF\s]/g, '');
        }
        
        return text;
    },

    async postTweet() {
        const textarea = document.getElementById('postTextarea');
        let content = textarea.value.trim();
        const imageFile = this.state.selectedImage;

        if (!content && !imageFile && !this.state.selectedShop) {
            alert('投稿内容を入力するか、画像、または店舗を選択してください');
            return;
        }

        // テキストをフィルタリング
        const filteredContent = this.filterText(content);
        
        // フィルタリング後に内容が変わった場合は警告
        if (filteredContent !== content) {
            alert('使用できない文字が含まれていました。自動的に修正されました。');
            content = filteredContent;
            textarea.value = content;
            
            // 文字数カウンターを更新
            const length = content.length;
            const charCounter = document.getElementById('charCounter');
            charCounter.textContent = `${length}/200`;
            
            // 文字数に応じて色を変更
            charCounter.classList.remove('warning', 'error');
            if (length > 180) {
                charCounter.classList.add('error');
            } else if (length > 150) {
                charCounter.classList.add('warning');
            }
            
            // ボタンの状態を更新
            const tweetBtn = document.getElementById('tweetBtn');
            tweetBtn.disabled = (!content.trim() && !this.state.selectedImage && !this.state.selectedShop) || length > 200;
            
            return;
        }

        const token = API.getCookie('authToken');
        if (!token) {
            alert('投稿するにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        // 店舗IDを取得
        const shopId = this.state.selectedShop ? this.state.selectedShop.id : null;

        const result = await API.postTweet(content, imageFile, shopId);
        if (result.success) {
            textarea.value = '';
            document.getElementById('tweetBtn').disabled = true;
            document.getElementById('imagePreviewContainer').innerHTML = '';
            document.getElementById('shopPreviewContainer').innerHTML = '';
            this.state.selectedImage = null;
            this.state.selectedShop = null;
            this.loadInitialPosts(); // Reload the timeline to show the new post
            this.setupAutoRefresh(); // 投稿後に自動更新を再設定
        } else {
            alert(`投稿に失敗しました: ${result.error}`);
        }
    },

    handleImageSelect(event) {
        const file = event.target.files[0];
        if (file) {
            // ファイルバリデーション
            const validation = this.validateImageFile(file);
            
            if (!validation.isValid) {
                alert(validation.error);
                // ファイル入力をリセット
                event.target.value = '';
                return;
            }
            
            this.state.selectedImage = file;
            const previewContainer = document.getElementById('imagePreviewContainer');
            previewContainer.innerHTML = `<img src="${URL.createObjectURL(file)}" class="image-preview" alt="Image preview"/>`;
            document.getElementById('tweetBtn').disabled = false;
        }
    },

    // 画像ファイルのバリデーション（クライアント側での基本的な検証のみ）
    validateImageFile(file) {
        // 許可するMIMEタイプ
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp'
        ];
        
        // ファイルサイズ上限（5MB）
        const maxSizeInBytes = 5 * 1024 * 1024;
        
        // MIMEタイプチェック
        if (!allowedMimeTypes.includes(file.type)) {
            return {
                isValid: false,
                error: '対応している画像形式はJPEG、PNG、GIF、WebPのみです'
            };
        }
        
        // ファイルサイズチェック
        if (file.size > maxSizeInBytes) {
            return {
                isValid: false,
                error: '画像サイズは5MB以下にしてください'
            };
        }
        
        // ファイル名チェック（危険な拡張子を排除）
        const dangerousExtensions = ['.php', '.js', '.exe', '.bat', '.cmd', '.sh', '.py', '.pl', '.rb'];
        const fileName = file.name.toLowerCase();
        
        for (const ext of dangerousExtensions) {
            if (fileName.endsWith(ext)) {
                return {
                    isValid: false,
                    error: 'このファイル形式は許可されていません'
                };
            }
        }
        
        return {
            isValid: true,
            error: null
        };
    },

    // IPアドレスから位置情報を取得
    async getLocationFromIP() {
        try {
            // ipinfo.ioを使用してIPアドレスから位置情報を取得
            const response = await fetch('https://ipinfo.io/json');
            
            if (!response.ok) {
                throw new Error('位置情報の取得に失敗しました');
            }
            
            const data = await response.json();
            
            // ipinfo.ioのレスポンス形式に対応
            if (data.error) {
                throw new Error(data.error.message || '位置情報の取得に失敗しました');
            }
            
            // locフィールドから緯度経度を抽出
            const [lat, lng] = data.loc ? data.loc.split(',').map(coord => parseFloat(coord)) : [null, null];
            
            if (!lat || !lng) {
                throw new Error('位置情報の取得に失敗しました');
            }
            
            return {
                lat: lat,
                lng: lng,
                city: data.city || '',
                country: data.country || '',
                region: data.region || '',
                postal: data.postal || '',
                timezone: data.timezone || '',
                org: data.org || ''
            };
            
        } catch (error) {
            console.error('IPベースの位置取得に失敗しました:', error);
            
            // デフォルト位置（東京）を返す
            return {
                lat: 35.6762,
                lng: 139.6503,
                city: '東京',
                country: '日本'
            };
        }
    },

    // 最寄りのラーメン店を取得
    async getNearbyShops(lat, lng, radius = 30) {
        try {
            const data = await API.request(`/api/v1/ramen/nearby?latitude=${lat}&longitude=${lng}&radius_km=${radius}`, {
                includeAuth: false
            });
            return data.shops || [];
        } catch (error) {
            console.error('最寄りの店舗情報の取得に失敗しました:', error);
            return [];
        }
    },

    // 店舗選択モーダルを開く
    openShopModal() {
        SearchComponent.openModal(this.selectShop.bind(this));
    },

    // 店舗を選択
    selectShop(shop) {
        if (shop) {
            this.state.selectedShop = shop;
            this.renderShopPreview();
            document.getElementById('tweetBtn').disabled = false;
        }
    },

    // 店舗プレビューをレンダリング
    renderShopPreview() {
        if (!this.state.selectedShop) return;
        
        const previewContainer = document.getElementById('shopPreviewContainer');
        previewContainer.innerHTML = `
            <div class="shop-preview" style="margin-top: 10px; padding: 10px; background: var(--color-surface-muted); border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-store" style="margin-right: 8px; color: var(--color-primary);"></i>
                    <div>
                        <div style="font-weight: bold;">${this.state.selectedShop.name}</div>
                        <div style="font-size: 12px; color: var(--color-muted);">${this.state.selectedShop.address}</div>
                    </div>
                </div>
                <button onclick="TimelineComponent.removeShop()" style="background: none; border: none; color: var(--color-muted); cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    },

    // 店舗選択を解除
    removeShop() {
        this.state.selectedShop = null;
        document.getElementById('shopPreviewContainer').innerHTML = '';
        
        const textarea = document.getElementById('postTextarea');
        const tweetBtn = document.getElementById('tweetBtn');
        tweetBtn.disabled = (!textarea.value.trim() && !this.state.selectedImage) || textarea.value.length > 200;
    },

    openCommentModal(postId) {
        router.navigate('comment', [postId]);
    },

    // 長いテキストかどうかを判定
    isLongText(text) {
        const lines = text.split('\n');
        return lines.length > 3 || text.length > 150;
    },

    // テキストの表示/非表示を切り替え
    toggleText(postId) {
        const content = document.getElementById(`post-content-${postId}`);
        if (!content) {
            return;
        }

        const button = content.nextElementSibling;
        
        if (!button) {
            return;
        }

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            button.textContent = '閉じる';
        } else {
            content.classList.add('collapsed');
            button.textContent = 'もっと見る';
        }
    },
    
    
    // 店舗検索して移動
    async searchAndNavigateToShop(shopName) {
        try {
            const shops = await API.getShops(shopName, {});
            if (shops.length > 0) {
                // 最初の検索結果に移動
                router.navigate('shop', [shops[0].id]);
            } else {
                alert(`「${shopName}」の店舗が見つかりませんでした`);
            }
        } catch (error) {
            console.error('店舗検索に失敗しました:', error);
            alert('店舗検索に失敗しました');
        }
    },

    // イベントリスナーを再設定する静的メソッド（他のコンポーネントから呼び出し用）
    attachPostEventListeners() {
        // タイムラインの投稿に対するイベントリスナーを再設定
        document.querySelectorAll('.post-card').forEach(postCard => {
            const postId = postCard.id.replace('post-', '');
            
            // いいねボタンのイベントリスナー
            const likeButton = postCard.querySelector('.engagement-btn:nth-child(1)');
            if (likeButton) {
                likeButton.onclick = (e) => {
                    e.stopPropagation();
                    this.handleLike(parseInt(postId));
                };
            }
            
            // 通報ボタンのイベントリスナー
            const reportButton = postCard.querySelector('.engagement-btn:nth-child(2)');
            if (reportButton) {
                reportButton.onclick = (e) => {
                    e.stopPropagation();
                    this.openReportModal(parseInt(postId));
                };
            }
        });
    },

    // 通報モーダルを開く
    openReportModal(postId) {
        // ログインチェック
        const token = API.getCookie('authToken');
        if (!token) {
            alert('通報するにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'report-modal-overlay';
        modal.innerHTML = `
            <div class="report-modal">
                <div class="report-modal-header">
                    <h3>投稿を通報</h3>
                    <button class="close-modal" onclick="TimelineComponent.closeReportModal()">&times;</button>
                </div>
                <div class="report-modal-content">
                    <div class="report-reason">
                        <label for="reportReason">通報理由</label>
                        <select id="reportReason">
                            <option value="">選択してください</option>
                            <optgroup label="スパム・宣伝">
                                <option value="スパム・広告">スパム・広告</option>
                                <option value="過度な宣伝">過度な宣伝</option>
                                <option value="繰り返し投稿">繰り返し投稿</option>
                            </optgroup>
                            <optgroup label="不適切な内容">
                                <option value="暴力的・グロテスクな内容">暴力的・グロテスクな内容</option>
                                <option value="性的な内容">性的な内容</option>
                                <option value="不快な表現">不快な表現</option>
                            </optgroup>
                            <optgroup label="ヘイトスピーチ・差別">
                                <option value="人種・民族差別">人種・民族差別</option>
                                <option value="性差別">性差別</option>
                                <option value="障害者差別">障害者差別</option>
                                <option value="その他の差別">その他の差別</option>
                            </optgroup>
                            <optgroup label="ハラスメント">
                                <option value="個人攻撃">個人攻撃</option>
                                <option value="脅迫">脅迫</option>
                                <option value="いじめ">いじめ</option>
                                <option value="ストーカー行為">ストーカー行為</option>
                            </optgroup>
                            <optgroup label="偽情報">
                                <option value="デマ・偽情報">デマ・偽情報</option>
                                <option value="医療・健康に関する誤情報">医療・健康に関する誤情報</option>
                                <option value="政治に関する誤情報">政治に関する誤情報</option>
                            </optgroup>
                            <optgroup label="著作権侵害">
                                <option value="無断転載">無断転載</option>
                                <option value="画像の無断使用">画像の無断使用</option>
                                <option value="その他の著作権侵害">その他の著作権侵害</option>
                            </optgroup>
                            <optgroup label="その他">
                                <option value="プライバシー侵害">プライバシー侵害</option>
                                <option value="自殺・自傷を助長する内容">自殺・自傷を助長する内容</option>
                                <option value="その他">その他</option>
                            </optgroup>
                        </select>
                    </div>
                </div>
                <div class="report-modal-actions">
                    <button class="cancel-btn" onclick="TimelineComponent.closeReportModal()">キャンセル</button>
                    <button class="report-btn" onclick="TimelineComponent.submitReport(${postId})">通報する</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },

    // 通報モーダルを閉じる
    closeReportModal() {
        const modal = document.querySelector('.report-modal-overlay');
        if (modal) {
            modal.remove();
        }
    },

    // 通報を送信
    async submitReport(postId) {
        const reasonSelect = document.getElementById('reportReason');
        
        const reason = reasonSelect.value;
        
        if (!reason) {
            alert('通報理由を選択してください');
            return;
        }
        
        try {
            const result = await API.reportPost(postId, reason);
            
            if (result.success) {
                alert('通報を送信しました');
                this.closeReportModal();
            } else {
                alert(`通報に失敗しました: ${result.error}`);
            }
        } catch (error) {
            console.error('通報エラー:', error);
            alert('通報に失敗しました');
        }
    },
    
    // GPS権限を確認
    async checkGPSPermission() {
        if (!navigator.geolocation) {
            return;
        }
        
        // GPS権限状態を確認
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                if (permission.state === 'granted') {
                    // GPSが許可されている場合、近隣店舗をチェック
                    this.checkForNearbyShops();
                }
            } catch (error) {
                console.error('GPS権限の確認に失敗しました:', error);
            }
        }
    },
    
    // 近隣店舗をチェック
    async checkForNearbyShops() {
        // ログインしていない場合はチェックしない
        if (!API.getCookie('authToken')) {
            return;
        }
        
        // GPSが利用可能な場合
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        // 近隣店舗を検索
                        const data = await API.request('/api/v1/checkin/nearby', {
                            method: 'POST',
                            body: {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                radius_km: 0.5,
                                include_ip_location: false
                            }
                        });
                        if (data.can_checkin && data.recommended_shop) {
                            // チェックイン通知を表示
                            CheckinComponent.showTimelineCheckinNotification([data.recommended_shop]);
                        }
                    } catch (error) {
                        console.error('近隣店舗チェックエラー:', error);
                    }
                },
                (error) => {
                    // GPSエラーの場合はIPベースのチェックを試行
                    this.checkForNearbyShopsByIP();
                }
            );
        } else {
            // GPSが利用できない場合はIPベースのチェックを試行
            this.checkForNearbyShopsByIP();
        }
    },
    
    // IPベースで近隣店舗をチェック
    async checkForNearbyShopsByIP() {
        // ログインしていない場合はチェックしない
        if (!API.getCookie('authToken')) {
            return;
        }
        
        // モバイルデバイスかつモバイルネットワークの場合のみ実行
        if (this.isMobileDevice() && this.isMobileNetwork()) {
            try {
                const data = await API.request('/api/v1/checkin/nearby', {
                    method: 'POST',
                    body: {
                        include_ip_location: true
                    }
                });
                if (data.can_checkin && data.recommended_shop) {
                    // チェックイン通知を表示
                    CheckinComponent.showTimelineCheckinNotification([data.recommended_shop]);
                }
            } catch (error) {
                console.error('IPベース近隣店舗チェックエラー:', error);
            }
        }
    },
    
    // モバイルデバイスかどうかを判定
    isMobileDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    },
    
    // モバイルネットワークかどうかを判定
    isMobileNetwork() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            return connection.type === 'cellular';
        }
        return false; // 判定できない場合はfalseを返す
    },

    // 投稿画像のHTMLを生成（picture要素を使用）
    createPostImageHTML(post) {
        // 新しい画像URLがある場合はpicture要素を使用
        if (post.thumbnail_url || post.original_image_url) {
            const thumbnailUrl = post.thumbnail_url || post.image;
            const originalUrl = post.original_image_url || post.image;
            
            return `
                <div class="post-image">
                    <picture>
                        <source srcset="${API.escapeHtml(originalUrl)}" media="(min-width: 768px)">
                        <img src="${API.escapeHtml(thumbnailUrl)}"
                             data-src="${API.escapeHtml(originalUrl)}"
                             style="width:60%; border-radius: 16px; margin-top: 12px;"
                             alt="Post image"
                             loading="lazy"
                             onclick="TimelineComponent.handleImageClick(event, '${API.escapeHtml(originalUrl)}')">
                    </picture>
                </div>
            `;
        }
        
        // 後方互換性のための従来の画像表示
        if (post.image) {
            return `
                <div class="post-image">
                    <img src="${API.escapeHtml(post.image)}"
                         style="width:60%; border-radius: 16px; margin-top: 12px;"
                         alt="Post image"
                         loading="lazy"
                         onclick="TimelineComponent.handleImageClick(event, '${API.escapeHtml(post.image)}')">
                </div>
            `;
        }
        
        return '';
    },

    // 画像クリック処理
    handleImageClick(event, imageUrl) {
        event.stopPropagation();
        // 画像モーダルを開く（既存の機能を利用）
        if (typeof CommentComponent !== 'undefined' && CommentComponent.openImageModal) {
            CommentComponent.openImageModal([imageUrl], 0);
        } else {
            // フォールバック：新しいタブで画像を開く
            window.open(imageUrl, '_blank');
        }
    },

    // 投稿削除の確認ダイアログと処理
    async confirmAndDeletePost(postId) {
        const token = API.getCookie('authToken');
        if (!token) {
            alert('削除するにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        if (!window.confirm('この投稿を削除しますか？')) {
            return;
        }

        try {
            const result = await API.request(`/api/v1/posts/${postId}`, {
                method: 'DELETE',
                includeAuth: true
            });

            // 成功時: stateとDOMから削除
            this.removePostFromStateAndDOM(postId);

            // サーバーから message が返る想定（app/routes/posts.py の delete_post）
            if (result && result.message) {
                console.log(result.message);
            }
        } catch (error) {
            console.error('投稿削除エラー:', error);
            if (error && error.detail) {
                alert(`削除に失敗しました: ${error.detail}`);
            } else {
                alert('削除に失敗しました');
            }
        }
    },

    // stateおよびDOMから投稿を削除
    removePostFromStateAndDOM(postId) {
        // stateから削除
        this.state.posts = this.state.posts.filter(p => p.id !== postId);

        // DOMから削除
        const postElement = document.getElementById(`post-${postId}`);
        if (postElement && postElement.parentNode) {
            postElement.parentNode.removeChild(postElement);
        }

        // 投稿が0件になった場合の表示
        if (this.state.posts.length === 0) {
            const timeline = document.getElementById('timeline');
            if (timeline) {
                timeline.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--color-muted);"><p>投稿がありません</p></div>`;
            }
        }
    },

    // 遅延読み込みの設定
    setupLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        // すでに高画質画像に切り替わっている場合はスキップ
                        if (img.dataset.loaded === 'true') {
                            observer.unobserve(img);
                            return;
                        }
                        
                        // ネットワーク状況に応じて画像の読み込みを制御
                        if (this.isSlowNetwork()) {
                            // 低速ネットワークの場合はサムネイルのまま
                            img.dataset.loaded = 'true';
                            observer.unobserve(img);
                            return;
                        }
                        
                        // 通常画質画像に切り替え
                        const highQualitySrc = img.dataset.src;
                        if (highQualitySrc && img.src !== highQualitySrc) {
                            const tempImg = new Image();
                            tempImg.onload = () => {
                                img.src = highQualitySrc;
                                img.removeAttribute('data-src');
                                img.dataset.loaded = 'true';
                            };
                            tempImg.src = highQualitySrc;
                        } else {
                            // 高画質画像がない場合でもロード済みとしてマーク
                            img.dataset.loaded = 'true';
                        }
                        
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px' // ビューポートの50px手前から読み込み開始
            });
            
            images.forEach(img => imageObserver.observe(img));
        } else {
            // IntersectionObserverがサポートされていない場合のフォールバック
            images.forEach(img => {
                // すでに高画質画像に切り替わっている場合はスキップ
                if (img.dataset.loaded === 'true') {
                    return;
                }
                
                if (this.isSlowNetwork()) {
                    img.dataset.loaded = 'true';
                    return; // 低速ネットワークの場合はサムネイルのまま
                }
                
                const highQualitySrc = img.dataset.src;
                if (highQualitySrc) {
                    img.src = highQualitySrc;
                    img.removeAttribute('data-src');
                    img.dataset.loaded = 'true';
                } else {
                    // 高画質画像がない場合でもロード済みとしてマーク
                    img.dataset.loaded = 'true';
                }
            });
        }
    },

    // ネットワーク速度の判定
    isSlowNetwork() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            // 接続タイプで判定
            if (connection.type === 'cellular') {
                // モバイルネットワークの場合
                if (connection.effectiveType === 'slow-2g' ||
                    connection.effectiveType === '2g' ||
                    connection.effectiveType === '3g') {
                    return true;
                }
            }
            
            // ダウンロード速度で判定
            if (connection.downlink && connection.downlink < 1.5) {
                return true; // 1.5Mbps未満は低速と判定
            }
        }
        
        return false;
    }
};

router.register('timeline', TimelineComponent);