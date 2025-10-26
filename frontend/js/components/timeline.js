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
        pullStartY: 0,
        pullCurrentY: 0,
        pullDistance: 0,
        maxPullDistance: 120,
        pullThreshold: 80,
        selectedImage: null,
        autoRefreshInterval: null,
        lastRefreshTime: null,
        selectedShop: null
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
            return settings && settings.autoRefresh === true;
        } catch (e) {
            console.error("Failed to get auto refresh setting", e);
            return false;
        }
    },

    // 自動更新を設定
    setupAutoRefresh() {
        this.stopAutoRefresh(); // 既存の自動更新をクリア
        
        if (this.isAutoRefreshEnabled()) {
            // 1分ごとに自動更新
            this.state.autoRefreshInterval = setInterval(() => {
                this.refreshTimeline();
            }, 60000);
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
        }
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
            background: #d4a574;
            color: white;
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
                .timeline-page {
                    position: relative;
                    isolation: isolate;
                    min-height: calc(100vh - 70px);
                    padding: 32px 18px 56px;
                    background: radial-gradient(120% 140% at 50% 0%, #fff7eb 0%, #f8ede0 45%, #f2e3d4 100%);
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                    align-items: center;
                }

                .dark-mode .timeline-page {
                    background: radial-gradient(120% 140% at 50% 0%, #201910 0%, #17120c 45%, #100c08 100%);
                }

                .timeline-hero {
                    max-width: 960px;
                    margin: 0 auto 32px;
                    padding: 32px;
                    border-radius: 28px;
                    border: 1px solid rgba(212, 165, 116, 0.25);
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(18px);
                    box-shadow: 0 24px 45px rgba(212, 165, 116, 0.18);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 24px;
                }

                .timeline-hero > div {
                    flex: 1;
                }

                .timeline-eyebrow {
                    font-size: 13px;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                    color: #b17f3d;
                    margin-bottom: 12px;
                    font-weight: 700;
                }

                .timeline-title {
                    font-size: 32px;
                    line-height: 1.2;
                    margin: 0 0 12px;
                    color: #2f1b00;
                    font-weight: 800;
                }

                .timeline-subtitle {
                    font-size: 16px;
                    color: #5c5142;
                    margin: 0;
                }

                .timeline-hero-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 18px;
                    border-radius: 999px;
                    background: rgba(245, 196, 107, 0.2);
                    color: #8a6233;
                    font-weight: 600;
                    border: 1px solid rgba(212, 165, 116, 0.35);
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
                }

                .dark-mode .timeline-hero {
                    background: rgba(28, 28, 28, 0.88);
                    color: #f7f3eb;
                    border-color: rgba(212, 165, 116, 0.32);
                    box-shadow: 0 26px 52px rgba(0, 0, 0, 0.55);
                }

                .dark-mode .timeline-subtitle {
                    color: #d7cfc2;
                }

                .dark-mode .timeline-hero-badge {
                    background: rgba(212, 165, 116, 0.14);
                    color: #f5d9a3;
                    border-color: rgba(212, 165, 116, 0.35);
                }

                .timeline-main {
                    max-width: 960px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .composer-card {
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid rgba(212, 165, 116, 0.25);
                    border-radius: 24px;
                    padding: 24px;
                    box-shadow: 0 24px 46px rgba(212, 165, 116, 0.18);
                    backdrop-filter: blur(14px);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .post-input-wrapper {
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                }

                .post-avatar {
                    width: 56px;
                    height: 56px;
                    border-radius: 20px;
                    background: linear-gradient(135deg, #f6c46b 0%, #e09a3a 100%);
                    box-shadow: 0 12px 24px rgba(224, 154, 58, 0.4);
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid rgba(255, 255, 255, 0.7);
                    flex-shrink: 0;
                }

                .post-input-content {
                    flex: 1;
                }

                .post-textarea {
                    width: 100%;
                    border: 1px solid transparent;
                    border-radius: 18px;
                    padding: 14px 18px;
                    font-size: 18px;
                    line-height: 1.6;
                    resize: none;
                    background: rgba(246, 237, 224, 0.4);
                    color: #2f1b00;
                    transition: border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                    min-height: 92px;
                }

                .post-textarea:focus {
                    outline: none;
                    border-color: rgba(212, 165, 116, 0.65);
                    box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.18);
                    background: rgba(255, 255, 255, 0.98);
                }

                .post-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 16px;
                }

                .post-icons {
                    display: flex;
                    gap: 10px;
                }

                .post-icon-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 14px;
                    border: 1px solid rgba(212, 165, 116, 0.35);
                    background: rgba(212, 165, 116, 0.12);
                    color: #a26a24;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                }

                .post-icon-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 12px 24px rgba(212, 165, 116, 0.25);
                    background: rgba(212, 165, 116, 0.22);
                }

                .tweet-btn {
                    background: linear-gradient(135deg, #f6c46b 0%, #e09a3a 100%);
                    color: #2f1b00;
                    border: none;
                    padding: 10px 26px;
                    border-radius: 999px;
                    font-weight: 700;
                    cursor: pointer;
                    letter-spacing: 0.03em;
                    box-shadow: 0 16px 32px rgba(224, 154, 58, 0.35);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .tweet-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 22px 38px rgba(224, 154, 58, 0.45);
                }

                .tweet-btn:disabled {
                    background: rgba(180, 170, 150, 0.4);
                    color: rgba(63, 45, 25, 0.5);
                    box-shadow: none;
                    cursor: not-allowed;
                }

                #imagePreviewContainer,
                #shopPreviewContainer {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    margin-top: 12px;
                }

                .image-preview {
                    width: 96px;
                    height: 96px;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid rgba(212, 165, 116, 0.35);
                    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.12);
                }

                .shop-preview-card {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 14px;
                    border: 1px solid rgba(212, 165, 116, 0.35);
                    background: rgba(212, 165, 116, 0.1);
                    color: #7b552d;
                    font-weight: 600;
                    margin-top: 12px;
                }

                .shop-preview-text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .shop-preview-name {
                    font-size: 14px;
                }

                .shop-preview-address {
                    font-size: 12px;
                    color: #7d6a58;
                    font-weight: 500;
                }

                .shop-preview-remove {
                    margin-left: 8px;
                    background: transparent;
                    border: none;
                    color: #7d6a58;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 50%;
                    transition: background 0.2s ease, color 0.2s ease;
                }

                .shop-preview-remove:hover {
                    background: rgba(55, 37, 23, 0.08);
                    color: #2f1b00;
                }

                .timeline-feed {
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(212, 165, 116, 0.25);
                    border-radius: 28px;
                    box-shadow: 0 28px 52px rgba(212, 165, 116, 0.2);
                    backdrop-filter: blur(18px);
                    display: flex;
                    flex-direction: column;
                    min-height: 420px;
                }

                .timeline-tabs {
                    display: flex;
                    gap: 12px;
                    padding: 24px 28px 12px;
                    position: sticky;
                    top: 0;
                    background: inherit;
                    z-index: 2;
                }

                .timeline-tab {
                    flex: 1 1 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 14px 16px;
                    border-radius: 16px;
                    border: 1px solid rgba(212, 165, 116, 0.32);
                    background: rgba(212, 165, 116, 0.12);
                    color: #8a6233;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .timeline-tab.active {
                    background: linear-gradient(135deg, #f5c979 0%, #e09a3a 100%);
                    color: #2f1b00;
                    box-shadow: 0 16px 28px rgba(224, 154, 58, 0.35);
                }

                .timeline-tab:not(.active):hover {
                    transform: translateY(-1px);
                    background: rgba(212, 165, 116, 0.22);
                }

                .timeline-scroll {
                    position: relative;
                    flex: 1;
                    overflow-y: auto;
                    padding: 0 28px 28px;
                    height: calc(100vh - 320px);
                }

                .timeline-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding-top: 12px;
                }

                .post-card {
                    background: rgba(255, 255, 255, 0.95);
                    border: 1px solid rgba(212, 165, 116, 0.25);
                    border-radius: 22px;
                    padding: 20px;
                    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.08);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    cursor: pointer;
                }

                .post-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 28px 46px rgba(0, 0, 0, 0.12);
                }

                .post-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                    margin-bottom: 12px;
                }

                .post-user-info {
                    flex: 1;
                }

                .post-username {
                    font-weight: 700;
                    font-size: 16px;
                    color: #3b2614;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .post-meta {
                    color: #7d6a58;
                    font-size: 13px;
                    font-weight: 500;
                }

                .post-text {
                    color: #3d2d1e;
                    font-size: 15px;
                    line-height: 1.7;
                }

                .post-content.collapsed {
                    max-height: 4.4em;
                    overflow: hidden;
                }

                .show-more-btn {
                    background: none;
                    border: none;
                    color: #d4882a;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 6px 0;
                    font-weight: 600;
                }

                .show-more-btn:hover {
                    text-decoration: underline;
                }

                .shop-reference {
                    margin-top: 14px;
                    padding: 14px 16px;
                    background: rgba(212, 165, 116, 0.12);
                    border-radius: 16px;
                    border: 1px solid rgba(212, 165, 116, 0.25);
                    cursor: pointer;
                    transition: background 0.2s ease, transform 0.2s ease;
                    color: #8a6233;
                    font-weight: 600;
                }

                .shop-reference:hover {
                    background: rgba(212, 165, 116, 0.22);
                    transform: translateY(-1px);
                }

                .shop-reference-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .post-engagement {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    margin-top: 18px;
                    padding-top: 14px;
                    border-top: 1px solid rgba(212, 165, 116, 0.25);
                }

                .engagement-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: rgba(55, 37, 23, 0.05);
                    border: 1px solid transparent;
                    border-radius: 14px;
                    color: #72553a;
                    cursor: pointer;
                    padding: 10px 12px;
                    transition: background 0.2s ease, transform 0.2s ease;
                }

                .engagement-btn:hover {
                    background: rgba(55, 37, 23, 0.08);
                    transform: translateY(-1px);
                }

                .engagement-btn .liked {
                    color: #e24f6d;
                }

                .login-card {
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(212, 165, 116, 0.25);
                    border-radius: 24px;
                    padding: 32px;
                    text-align: center;
                    box-shadow: 0 26px 48px rgba(212, 165, 116, 0.18);
                }

                .login-card h3 {
                    margin: 0 0 12px;
                    font-size: 22px;
                    color: #3b2614;
                }

                .login-card p {
                    margin: 0 0 20px;
                    color: #7d6a58;
                }

                .login-btn {
                    padding: 12px 32px;
                    border-radius: 999px;
                    border: none;
                    font-weight: 700;
                    background: linear-gradient(135deg, #f6c46b 0%, #e09a3a 100%);
                    color: #2f1b00;
                    cursor: pointer;
                    box-shadow: 0 18px 36px rgba(224, 154, 58, 0.35);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .login-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 24px 44px rgba(224, 154, 58, 0.45);
                }

                .char-counter {
                    font-size: 14px;
                    font-weight: 600;
                    color: #7d6a58;
                    margin-right: 12px;
                }

                .char-counter.warning {
                    color: #d4882a;
                }

                .char-counter.error {
                    color: #e24f6d;
                }

                #timelineLoadingIndicator {
                    text-align: center;
                    padding: 24px 0;
                    color: #7d6a58;
                    font-weight: 600;
                }

                /* Dark Mode */
                .dark-mode .composer-card {
                    background: rgba(26, 26, 26, 0.9);
                    border-color: rgba(212, 165, 116, 0.35);
                    box-shadow: 0 26px 48px rgba(0, 0, 0, 0.55);
                }

                .dark-mode .post-avatar {
                    border-color: rgba(20, 20, 20, 0.9);
                }

                .dark-mode .post-textarea {
                    background: rgba(36, 36, 36, 0.8);
                    color: #f7f3eb;
                }

                .dark-mode .post-textarea:focus {
                    background: rgba(18, 18, 18, 0.98);
                }

                .dark-mode .post-icon-btn {
                    background: rgba(212, 165, 116, 0.12);
                    color: #f6d9a3;
                    border-color: rgba(212, 165, 116, 0.28);
                }

                .dark-mode .tweet-btn {
                    color: #1c1100;
                }

                .dark-mode #imagePreviewContainer,
                .dark-mode #shopPreviewContainer {
                    color: #f6d9a3;
                }

                .dark-mode .timeline-feed {
                    background: rgba(22, 22, 22, 0.92);
                    border-color: rgba(212, 165, 116, 0.3);
                    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
                }

                .dark-mode .timeline-tab {
                    background: rgba(212, 165, 116, 0.08);
                    border-color: rgba(212, 165, 116, 0.18);
                    color: #f6d9a3;
                }

                .dark-mode .timeline-tab.active {
                    color: #241200;
                }

                .dark-mode .timeline-scroll {
                    scrollbar-color: rgba(212, 165, 116, 0.35) transparent;
                }

                .dark-mode .post-card {
                    background: rgba(28, 28, 28, 0.96);
                    border-color: rgba(212, 165, 116, 0.35);
                    box-shadow: 0 24px 52px rgba(0, 0, 0, 0.6);
                }

                .dark-mode .post-username {
                    color: #f6d9a3;
                }

                .dark-mode .post-meta,
                .dark-mode .post-text,
                .dark-mode .shop-reference,
                .dark-mode .char-counter,
                .dark-mode #timelineLoadingIndicator {
                    color: #f6d9a3;
                }

                .dark-mode .shop-reference {
                    background: rgba(212, 165, 116, 0.12);
                    border-color: rgba(212, 165, 116, 0.32);
                }

                .dark-mode .post-engagement {
                    border-top-color: rgba(212, 165, 116, 0.25);
                }

                .dark-mode .engagement-btn {
                    background: rgba(245, 217, 163, 0.08);
                    color: #f6d9a3;
                }

                .dark-mode .login-card {
                    background: rgba(24, 24, 24, 0.94);
                    border-color: rgba(212, 165, 116, 0.35);
                    color: #f6d9a3;
                }

                .dark-mode .login-card p {
                    color: #d7cfc2;
                }

                .dark-mode .login-btn {
                    color: #1f1200;
                }

                .dark-mode .char-counter.warning {
                    color: #f6c46b;
                }

                .dark-mode .char-counter.error {
                    color: #ff7b96;
                }

                .dark-mode .image-preview {
                    border-color: rgba(212, 165, 116, 0.35);
                }

                .dark-mode .shop-preview-card {
                    background: rgba(212, 165, 116, 0.14);
                    border-color: rgba(212, 165, 116, 0.32);
                    color: #f6d9a3;
                }

                .dark-mode .shop-preview-address {
                    color: #d7cfc2;
                }

                .dark-mode .shop-preview-remove {
                    color: #d7cfc2;
                }

                .dark-mode .shop-preview-remove:hover {
                    background: rgba(245, 217, 163, 0.18);
                    color: #1f1200;
                }

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
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .report-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
                }
                .report-modal-header h3 {
                    margin: 0;
                }
                .close-modal {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                }
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
                    border: 1px solid #e0e0e0;
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
                    border: 1px solid #e0e0e0;
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
                    border-top: 1px solid #e0e0e0;
                }
                .report-btn {
                    background: #d4a574;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                }
                .cancel-btn {
                    background: transparent;
                    color: #666;
                    border: 1px solid #e0e0e0;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                }
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
                    color: #aaa;
                }

                @media (max-width: 900px) {
                    .timeline-hero {
                        flex-direction: column;
                        align-items: flex-start;
                        text-align: left;
                    }

                    .timeline-scroll {
                        height: auto;
                        max-height: 70vh;
                    }
                }

                @media (max-width: 600px) {
                    .timeline-page {
                        padding: 24px 12px 40px;
                    }

                    .timeline-hero {
                        padding: 24px;
                        border-radius: 24px;
                    }

                    .composer-card {
                        padding: 20px;
                    }

                    .post-input-wrapper {
                        flex-direction: column;
                    }

                    .post-avatar {
                        width: 48px;
                        height: 48px;
                        border-radius: 16px;
                    }

                    .timeline-tabs {
                        flex-direction: column;
                        padding: 20px 20px 8px;
                    }

                    .timeline-tab {
                        width: 100%;
                    }

                    .timeline-scroll {
                        padding: 0 20px 20px;
                    }

                    .timeline-feed {
                        border-radius: 22px;
                    }
                }
            </style>

            <div class="timeline-page">
                <div class="timeline-hero">
                    <div>
                        <p class="timeline-eyebrow">JIROTTER</p>
                        <h1 class="timeline-title">今日の二郎をシェアしよう</h1>
                        <p class="timeline-subtitle">旬の投稿やフォローしている仲間のレポートを一箇所でチェックできます。</p>
                    </div>
                    <div class="timeline-hero-badge"><i class="fas fa-utensils"></i>リアルタイム更新</div>
                </div>

                <section class="timeline-main">
                ${isLoggedIn ? `
                <div class="composer-card post-input-area">
                    <div class="post-input-wrapper">
                        <div class="post-avatar"><img src="${currentUserIconSrc}" alt="User Icon" style="width: 100%; height: 100%; border-radius: 16px; object-fit: cover;"></div>
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
                <div class="login-card">
                    <h3>ログインして二郎を共有しよう</h3>
                    <p>お気に入り店舗の記録やフォロー中の最新情報を逃さずチェックできます。</p>
                    <button class="login-btn" onclick="router.navigate('auth', ['login'])">ログイン</button>
                </div>
                `}

                <div class="timeline-feed">
                    <div class="timeline-tabs" role="tablist">
                        <button class="timeline-tab tab ${this.state.currentTab === 'recommend' ? 'active' : ''}" data-tab="recommend" role="tab" aria-selected="${this.state.currentTab === 'recommend'}">
                            <i class="fas fa-fire"></i>みんなの投稿
                        </button>
                        <button class="timeline-tab tab ${this.state.currentTab === 'following' ? 'active' : ''}" data-tab="following" role="tab" aria-selected="${this.state.currentTab === 'following'}">
                            <i class="fas fa-user-friends"></i>フォロー中
                        </button>
                    </div>
                    <div class="timeline-scroll" id="timelineContainer" role="feed" aria-live="polite">
                        <div class="timeline-list" id="timeline"></div>
                    </div>
                </div>
                </section>
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
                document.getElementById('timeline').innerHTML = `<div style="text-align: center; padding: 40px; color: #666;"><p>投稿がありません</p></div>`;
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
                    <div class="post-content collapsed" id="post-content-${post.id}">${API.escapeHtmlWithLineBreaks(post.text)}</div>
                    ${this.isLongText(post.text) ? `<button class="show-more-btn" onclick="event.stopPropagation(); TimelineComponent.toggleText(${post.id})">続きを見る</button>` : ''}
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
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.openCommentModal(${post.id})"><i class="fas fa-comment"></i> ${post.engagement.comments}</button>
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.handleLike(${post.id})">
                        <i class="fas fa-heart ${post.isLiked ? 'liked' : ''}"></i> <span>${post.engagement.likes}</span>
                    </button>
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.openReportModal(${post.id})" title="通報">
                        <i class="fas fa-flag"></i>
                    </button>
                </div>
            </div>
        `;
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
                        <div style="text-align: center; padding: 40px; color: #666;">
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
            <div class="shop-preview-card" role="note">
                <i class="fas fa-store"></i>
                <div class="shop-preview-text">
                    <div class="shop-preview-name">${API.escapeHtml(this.state.selectedShop.name)}</div>
                    <div class="shop-preview-address">${API.escapeHtml(this.state.selectedShop.address || '')}</div>
                </div>
                <button class="shop-preview-remove" type="button" onclick="TimelineComponent.removeShop()" aria-label="店舗選択を解除">
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
        const button = content.nextElementSibling;
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            button.textContent = '続きを見る';
        } else {
            content.classList.add('collapsed');
            button.textContent = '閉じる';
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