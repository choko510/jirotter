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
        selectedShop: null,
        shopSearchQuery: '',
        shopSearchResults: []
    },

    init() {
        this.bindEvents();
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
        this.state.selectedImage = null;
        const contentArea = document.getElementById('contentArea');

        // CSSの動的読み込み
        Utils.loadCSS('timeline');

        contentArea.innerHTML = `
            <div class="post-input-area">
                <div class="post-input-wrapper">
                    <div class="post-avatar"></div>
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

            <div class="timeline-container" id="timelineContainer">
                <div class="timeline" id="timeline"></div>
            </div>
        `;

        this.setupEventListeners();
        this.loadInitialPosts();
        this.setupAutoRefresh(); // 自動更新を設定
    },

    setupEventListeners() {
        const timelineContainer = document.getElementById('timelineContainer');
        timelineContainer.onscroll = this.debounce(this.handleScroll.bind(this), 100);

        const textarea = document.getElementById('postTextarea');
        const tweetBtn = document.getElementById('tweetBtn');
        const imageUpload = document.getElementById('imageUpload');
        
        textarea.addEventListener('input', () => {
            const length = textarea.value.length;
            const charCounter = document.getElementById('charCounter');
            charCounter.textContent = `${length}/200`;
            
            // 文字数に応じて色を変更
            charCounter.classList.remove('warning', 'error');
            if (length > 180) {
                charCounter.classList.add('error');
            } else if (length > 150) {
                charCounter.classList.add('warning');
            }
            
            tweetBtn.disabled = (!textarea.value.trim() && !this.state.selectedImage && !this.state.selectedShop) || length > 200;
        });
        imageUpload.addEventListener('change', (event) => this.handleImageSelect(event));
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
                    <div class="post-content" id="post-content-${post.id}">${API.escapeHtmlWithLineBreaks(post.text)}</div>
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
                ${post.image ? `<div class="post-image"><img src="${API.escapeHtml(post.image)}" style="width:100%; border-radius: 16px; margin-top: 12px;" alt="Post image"></div>` : ''}
                <div class="post-engagement">
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.openCommentModal(${post.id})"><i class="fas fa-comment"></i> ${post.engagement.comments}</button>
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.handleLike(${post.id})">
                        <i class="fas fa-heart ${post.isLiked ? 'liked' : ''}"></i> <span>${post.engagement.likes}</span>
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
        this.loadInitialPosts();
        this.setupAutoRefresh(); // タブ切り替え時に自動更新を再設定
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

    async postTweet() {
        const textarea = document.getElementById('postTextarea');
        const content = textarea.value.trim();
        const imageFile = this.state.selectedImage;

        if (!content && !imageFile && !this.state.selectedShop) {
            alert('投稿内容を入力するか、画像、または店舗を選択してください');
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
            this.state.selectedImage = file;
            const previewContainer = document.getElementById('imagePreviewContainer');
            previewContainer.innerHTML = `<img src="${URL.createObjectURL(file)}" class="image-preview" alt="Image preview"/>`;
            document.getElementById('tweetBtn').disabled = false;
        }
    },

    // 店舗選択モーダルを開く
    openShopModal() {
        const modal = document.createElement('div');
        modal.className = 'shop-modal-overlay';
        modal.innerHTML = `
            <div class="shop-modal">
                <div class="shop-modal-header">
                    <h3>店舗を選択</h3>
                    <button class="close-modal" onclick="TimelineComponent.closeShopModal()">&times;</button>
                </div>
                <div class="shop-modal-search">
                    <input type="text" id="shopSearchInput" placeholder="店名や住所を検索..." value="${this.state.shopSearchQuery}">
                    <button onclick="TimelineComponent.searchShops()"><i class="fas fa-search"></i></button>
                </div>
                <div class="shop-modal-results" id="shopSearchResults">
                    <div class="loading">検索中...</div>
                </div>
            </div>
        `;
        
        // モーダルのスタイルを追加
        const style = document.createElement('style');
        style.textContent = `
            .shop-modal-overlay {
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
            .shop-modal {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .shop-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
            }
            .shop-modal-header h3 {
                margin: 0;
            }
            .close-modal {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            }
            .shop-modal-search {
                display: flex;
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
            }
            .shop-modal-search input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #e0e0e0;
                border-radius: 20px;
                outline: none;
            }
            .shop-modal-search button {
                background: #d4a574;
                color: white;
                border: none;
                border-radius: 50%;
                width: 36px;
                height: 36px;
                margin-left: 8px;
                cursor: pointer;
            }
            .shop-modal-results {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }
            .shop-result-item {
                padding: 12px;
                border-radius: 8px;
                cursor: pointer;
                margin-bottom: 8px;
                border: 1px solid #e0e0e0;
            }
            .shop-result-item:hover {
                background: #f5f5f5;
            }
            .shop-result-name {
                font-weight: bold;
                margin-bottom: 4px;
            }
            .shop-result-address {
                font-size: 14px;
                color: #666;
            }
            .no-shop-results {
                padding: 20px;
                text-align: center;
                color: #666;
            }
            .dark-mode .shop-modal {
                background: #2a2a2a;
                color: #e0e0e0;
            }
            .dark-mode .shop-modal-header,
            .dark-mode .shop-modal-search {
                border-bottom-color: #333;
            }
            .dark-mode .shop-modal-search input {
                background: #333;
                border-color: #444;
                color: #e0e0e0;
            }
            .dark-mode .shop-result-item {
                border-color: #333;
            }
            .dark-mode .shop-result-item:hover {
                background: #333;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
        
        // 検索入力イベント
        const searchInput = document.getElementById('shopSearchInput');
        searchInput.addEventListener('input', (e) => {
            this.state.shopSearchQuery = e.target.value;
            // デバウンス処理
            clearTimeout(this.shopSearchTimeout);
            this.shopSearchTimeout = setTimeout(() => {
                this.searchShops();
            }, 500);
        });
        
        // 初回検索を実行
        this.searchShops();
    },

    // 店舗検索
    async searchShops() {
        const resultsContainer = document.getElementById('shopSearchResults');
        resultsContainer.innerHTML = '<div class="loading">検索中...</div>';
        
        try {
            const shops = await API.getShops(this.state.shopSearchQuery, {});
            this.state.shopSearchResults = shops;
            
            if (shops.length === 0) {
                resultsContainer.innerHTML = '<div class="no-shop-results">条件に一致する店舗が見つかりませんでした</div>';
            } else {
                resultsContainer.innerHTML = shops.map(shop => `
                    <div class="shop-result-item" onclick="TimelineComponent.selectShop(${shop.id})">
                        <div class="shop-result-name">${shop.name}</div>
                        <div class="shop-result-address">${shop.address}</div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('店舗検索に失敗しました:', error);
            resultsContainer.innerHTML = '<div class="no-shop-results">検索中にエラーが発生しました</div>';
        }
    },

    // 店舗を選択
    selectShop(shopId) {
        const shop = this.state.shopSearchResults.find(s => s.id === shopId);
        if (shop) {
            this.state.selectedShop = shop;
            this.renderShopPreview();
            this.closeShopModal();
            document.getElementById('tweetBtn').disabled = false;
        }
    },

    // 店舗プレビューをレンダリング
    renderShopPreview() {
        if (!this.state.selectedShop) return;
        
        const previewContainer = document.getElementById('shopPreviewContainer');
        previewContainer.innerHTML = `
            <div class="shop-preview" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-store" style="margin-right: 8px; color: #d4a574;"></i>
                    <div>
                        <div style="font-weight: bold;">${this.state.selectedShop.name}</div>
                        <div style="font-size: 12px; color: #666;">${this.state.selectedShop.address}</div>
                    </div>
                </div>
                <button onclick="TimelineComponent.removeShop()" style="background: none; border: none; color: #666; cursor: pointer;">
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

    // 店舗モーダルを閉じる
    closeShopModal() {
        const modal = document.querySelector('.shop-modal-overlay');
        if (modal) {
            modal.remove();
        }
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
            button.textContent = '閉じる';
        } else {
            content.classList.add('collapsed');
            button.textContent = '続きを見る';
        }
    },
    
    // 投稿HTMLを作成する静的メソッド（他のコンポーネントから呼び出し用）
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
                    <div class="post-content" id="post-content-${post.id}">${API.escapeHtmlWithLineBreaks(post.text)}</div>
                    ${this.isLongText(post.text) ? `<button class="show-more-btn" onclick="event.stopPropagation(); TimelineComponent.toggleText(${post.id})">続きを見る</button>` : ''}
                </div>
                ${post.image ? `<div class="post-image"><img src="${API.escapeHtml(post.image)}" style="width:100%; border-radius: 16px; margin-top: 12px;" alt="Post image"></div>` : ''}
                <div class="post-engagement">
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.openCommentModal(${post.id})"><i class="fas fa-comment"></i> ${post.engagement.comments}</button>
                    <button class="engagement-btn" onclick="event.stopPropagation(); TimelineComponent.handleLike(${post.id})">
                        <i class="fas fa-heart ${post.isLiked ? 'liked' : ''}"></i> <span>${post.engagement.likes}</span>
                    </button>
                </div>
            </div>
        `;
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
            const likeButton = postCard.querySelector('.engagement-btn:nth-child(2)');
            if (likeButton) {
                likeButton.onclick = (e) => {
                    e.stopPropagation();
                    this.handleLike(parseInt(postId));
                };
            }
            
            // コメントボタンのイベントリスナー
            const commentButton = postCard.querySelector('.engagement-btn:nth-child(1)');
            if (commentButton) {
                commentButton.onclick = (e) => {
                    e.stopPropagation();
                    this.openCommentModal(parseInt(postId));
                };
            }
        });
    }
};

router.register('timeline', TimelineComponent);