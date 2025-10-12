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
        lastRefreshTime: null
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
        contentArea.innerHTML = `
            <style>
                /* ... styles ... */
                .post-input-area { padding: 16px; border-bottom: 1px solid #e0e0e0; }
                .post-input-wrapper { display: flex; gap: 12px; }
                .post-avatar { width: 48px; height: 48px; border-radius: 50%; background: #d4a574; flex-shrink: 0; }
                .post-input-content { flex: 1; }
                .post-textarea { width: 100%; background: transparent; border: none; font-size: 20px; resize: none; outline: none; min-height: 60px; }
                .post-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
                .post-icons { display: flex; gap: 4px; }
                .post-icon-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: transparent; color: #d4a574; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .tweet-btn { background: #dbaf3adb; color: #1a1a1a; border: none; padding: 8px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; }
                .tweet-btn:disabled { background: #ccc; cursor: not-allowed; }
                .char-counter { color: #666; font-size: 14px; margin-right: 12px; }
                .char-counter.warning { color: #ff9800; }
                .char-counter.error { color: #f44336; }
                .timeline-container { position: relative; overflow-y: auto; height: calc(100vh - 180px); }
                .post-card { padding: 16px; border-bottom: 1px solid #e0e0e0; transition: background 0.2s; }
                .post-card:hover { background: #f9f9f9; }
                .post-header { display: flex; gap: 12px; margin-bottom: 12px; cursor: pointer; }
                .post-user-info { flex: 1; }
                .post-username { font-weight: bold; }
                .post-meta { color: #666; font-size: 14px; }
                .post-engagement { display: flex; justify-content: space-around; margin-top: 12px; padding-top: 12px; }
                .engagement-btn { display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: #666; cursor: pointer; }
                .engagement-btn .liked { color: #e0245e; }
                .image-preview { max-width: 100px; max-height: 100px; border-radius: 10px; margin-top: 10px; }
                #timelineLoadingIndicator { text-align: center; padding: 20px; }
                .post-content { line-height: 1.4; }
                .post-content.collapsed { max-height: 4.2em; overflow: hidden; }
                .show-more-btn { background: none; border: none; color: #d4a574; cursor: pointer; font-size: 14px; padding: 4px 0; }
                .show-more-btn:hover { text-decoration: underline; }
            </style>
            
            <div class="post-input-area">
                <div class="post-input-wrapper">
                    <div class="post-avatar"></div>
                    <div class="post-input-content">
                        <textarea class="post-textarea" placeholder="今日食べる二郎は？" id="postTextarea" maxlength="200"></textarea>
                        <div id="imagePreviewContainer"></div>
                        <div class="post-actions">
                            <div class="post-icons">
                                <input type="file" id="imageUpload" accept="image/*" style="display: none;">
                                <button class="post-icon-btn" title="画像" onclick="document.getElementById('imageUpload').click()"><i class="fas fa-image"></i></button>
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
            
            tweetBtn.disabled = (!textarea.value.trim() && !this.state.selectedImage) || length > 200;
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

        if (!content && !imageFile) {
            alert('投稿内容を入力するか、画像を選択してください');
            return;
        }

        const token = API.getCookie('authToken');
        if (!token) {
            alert('投稿するにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        const result = await API.postTweet(content, imageFile);
        if (result.success) {
            textarea.value = '';
            document.getElementById('tweetBtn').disabled = true;
            document.getElementById('imagePreviewContainer').innerHTML = '';
            this.state.selectedImage = null;
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