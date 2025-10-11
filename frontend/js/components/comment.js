// コメントコンポーネント
const CommentComponent = {
    // 状態管理
    state: {
        currentPost: null,
        comments: [],
        isLoading: true,
        error: null,
    },

    // レンダリング
    async render(params = []) {
        const postId = params[0];
        if (!postId) {
            router.navigate('timeline');
            return;
        }

        this.state.isLoading = true;
        
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <style>
                /* コンテナとヘッダー */
                .comment-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: #ffffff;
                    min-height: 100vh;
                }

                .comment-header {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
                    position: sticky;
                    top: 0;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(12px);
                    z-index: 10;
                }

                .comment-back {
                    background: transparent;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #1a1a1a;
                    padding: 8px;
                    margin-right: 12px;
                    border-radius: 50%;
                    transition: background 0.2s;
                }

                .comment-back:hover {
                    background: #f5f5f5;
                }

                .comment-title {
                    font-size: 18px;
                    font-weight: bold;
                }

                /* 元の投稿表示 */
                .original-post {
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
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
                }

                .post-meta {
                    color: #666;
                    font-size: 14px;
                }

                .post-text {
                    line-height: 1.4;
                    margin-bottom: 8px;
                }

                .post-content {
                    line-height: 1.4;
                }

                .post-content.collapsed {
                    max-height: 4.2em;
                    overflow: hidden;
                }

                .show-more-btn {
                    background: none;
                    border: none;
                    color: #d4a574;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 4px 0;
                }

                .show-more-btn:hover {
                    text-decoration: underline;
                }

                .post-image img {
                    border-radius: 16px;
                    max-width: 100%;
                }

                /* コメント入力 */
                .comment-input-section {
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .comment-input-wrapper {
                    display: flex;
                    gap: 12px;
                }

                .comment-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: #d4a574;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .comment-textarea {
                    width: 100%;
                    background: transparent;
                    border: none;
                    font-size: 16px;
                    resize: none;
                    outline: none;
                    min-height: 60px;
                    padding: 12px 0;
                    line-height: 1.4;
                }

                .comment-textarea::placeholder {
                    color: #999;
                }

                .comment-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 8px;
                }

                .char-counter {
                    color: #666;
                    font-size: 14px;
                }

                .char-counter.warning {
                    color: #ff9800;
                }

                .char-counter.error {
                    color: #f44336;
                }

                .comment-submit-btn {
                    background: #d4a574;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .comment-submit-btn:hover:not(:disabled) {
                    background: #c19660;
                }

                .comment-submit-btn:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }

                /* コメントリスト */
                .comments-list {
                    padding: 0 16px;
                }

                .comment-item {
                    padding: 16px 0;
                    border-bottom: 1px solid #e0e0e0;
                    transition: background 0.2s;
                }

                .comment-item:hover {
                    background: #f9f9f9;
                    margin: 0 -16px;
                    padding-left: 16px;
                    padding-right: 16px;
                }

                .comment-header {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 8px;
                }

                .comment-user-info {
                    flex: 1;
                }

                .comment-username {
                    font-weight: bold;
                }

                .comment-time {
                    color: #666;
                    font-size: 14px;
                }

                .comment-text {
                    line-height: 1.4;
                    margin-bottom: 12px;
                }

                .comment-content {
                    line-height: 1.4;
                }

                .comment-content.collapsed {
                    max-height: 4.2em;
                    overflow: hidden;
                }

                .comment-actions {
                    display: flex;
                    gap: 16px;
                }

                .comment-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .comment-action-btn:hover {
                    background: #f5f5f5;
                    color: #d4a574;
                }

                /* レスポンシブ対応 */
                @media (max-width: 768px) {
                    .comment-container {
                        max-width: 100%;
                    }
                    
                    .comment-header {
                        padding: 12px 16px;
                    }
                    
                    .comment-avatar {
                        width: 40px;
                        height: 40px;
                    }
                    
                    .comment-textarea {
                        font-size: 16px; /* iOSでのズーム防止 */
                    }
                }

                /* ダークモード対応 */
                .dark-mode .comment-container {
                    background: #1a1a1a;
                    color: #e0e0e0;
                }

                .dark-mode .comment-header {
                    background: rgba(26, 26, 26, 0.85);
                    border-bottom-color: #333;
                }

                .dark-mode .comment-back {
                    color: #e0e0e0;
                }

                .dark-mode .comment-back:hover {
                    background: #2a2a2a;
                }

                .dark-mode .original-post,
                .dark-mode .comment-input-section,
                .dark-mode .comment-item {
                    border-bottom-color: #333;
                }

                .dark-mode .post-meta,
                .dark-mode .comment-time {
                    color: #999;
                }

                .dark-mode .comment-textarea {
                    color: #e0e0e0;
                }

                .dark-mode .comment-textarea::placeholder {
                    color: #888;
                }

                .dark-mode .comment-item:hover {
                    background: #2a2a2a;
                }

                .dark-mode .comment-action-btn {
                    color: #999;
                }

                .dark-mode .comment-action-btn:hover {
                    background: #333;
                    color: #d4a574;
                }
            </style>
            
            <div class="comment-container">
                <div class="comment-header">
                    <button class="comment-back" onclick="router.navigate('timeline')">←</button>
                    <div class="comment-title">コメント</div>
                </div>
                <div class="comment-body">
                    <div class="original-post" id="originalPost">
                        <div class="loading">読み込み中...</div>
                    </div>
                    <div class="comment-input-section">
                        <div class="comment-input-wrapper">
                            <div class="comment-avatar"></div>
                            <div style="flex: 1;">
                                <textarea class="comment-textarea" id="commentTextarea" placeholder="コメントを入力..." maxlength="200"></textarea>
                                <div class="comment-actions">
                                    <span class="char-counter" id="commentCharCounter">0/200</span>
                                    <button class="comment-submit-btn" id="commentSubmitBtn" disabled>返信</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="comments-list" id="commentsList">
                        <div class="loading">コメントを読み込み中...</div>
                    </div>
                </div>
            </div>
        `;

        await this.loadPostAndComments(postId);

        // Add event listeners after rendering
        const textarea = document.getElementById('commentTextarea');
        const submitBtn = document.getElementById('commentSubmitBtn');
        
        if(textarea && submitBtn) {
            const charCounter = document.getElementById('commentCharCounter');
            textarea.addEventListener('input', () => {
                const length = textarea.value.length;
                charCounter.textContent = `${length}/200`;
                
                // 文字数に応じて色を変更
                charCounter.classList.remove('warning', 'error');
                if (length > 180) {
                    charCounter.classList.add('error');
                } else if (length > 150) {
                    charCounter.classList.add('warning');
                }
                
                submitBtn.disabled = !textarea.value.trim() || length > 200;
            });
            submitBtn.addEventListener('click', () => this.submitComment());
        }
    },

    // 投稿とコメントの読み込み
    async loadPostAndComments(postId) {
        this.state.isLoading = true;
        this.state.error = null;
        try {
            const postResult = await API.getPost(postId);
            if (!postResult.success) throw new Error(postResult.error);
            this.state.currentPost = postResult.post;
            
            const repliesResult = await API.getRepliesForPost(postId);
            if (!repliesResult.success) throw new Error(repliesResult.error);
            this.state.comments = repliesResult.replies;

        } catch (error) {
            console.error('投稿とコメントの読み込みに失敗しました:', error);
            this.state.error = '投稿とコメントの読み込みに失敗しました。';
        } finally {
            this.state.isLoading = false;
            this.updateDOM();
        }
    },

    updateDOM() {
        if (this.state.isLoading) return;

        if (this.state.error) {
            this.renderError(this.state.error);
            return;
        }

        this.renderOriginalPost();
        this.renderComments();
    },

    // 元の投稿をレンダリング
    renderOriginalPost() {
        const post = this.state.currentPost;
        if (!post) return;

        const originalPost = document.getElementById('originalPost');
        originalPost.innerHTML = `
            <div class="post-header">
                <div class="comment-avatar"><i class="fas fa-user"></i></div>
                <div class="post-user-info">
                    <div class="post-username">
                        <span>${API.escapeHtml(post.author_username)}</span>
                        <span class="post-meta">@${API.escapeHtml(post.user_id)} · ${API.formatTime(post.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="post-text" id="post-text-${post.id}">
                <div class="post-content" id="post-content-${post.id}">${API.escapeHtmlWithLineBreaks(post.content)}</div>
                ${this.isLongText(post.content) ? `<button class="show-more-btn" onclick="CommentComponent.toggleText('post', ${post.id})">続きを見る</button>` : ''}
            </div>
            ${post.image_url ? `<div class="post-image"><img src="${API.escapeHtml(post.image_url)}" style="width:100%; border-radius: 16px; margin-top: 12px;" alt="Post image"></div>` : ''}
        `;
    },

    // コメントをレンダリング
    renderComments() {
        const commentsList = document.getElementById('commentsList');
        
        if (this.state.comments.length === 0) {
            commentsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;"><p>コメントがありません</p></div>`;
            return;
        }

        commentsList.innerHTML = this.state.comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-avatar"><i class="fas fa-user"></i></div>
                    <div class="comment-user-info">
                        <div class="comment-username">
                            <span>${API.escapeHtml(comment.author_username)}</span>
                            <span class="comment-time">@${API.escapeHtml(comment.user_id)} · ${API.formatTime(comment.created_at)}</span>
                        </div>
                    </div>
                </div>
                <div class="comment-text" id="comment-text-${comment.id}">
                    <div class="comment-content" id="comment-content-${comment.id}">${API.escapeHtmlWithLineBreaks(comment.content)}</div>
                    ${this.isLongText(comment.content) ? `<button class="show-more-btn" onclick="CommentComponent.toggleText('comment', ${comment.id})">続きを見る</button>` : ''}
                </div>
                <div class="comment-actions">
                    <button class="comment-action-btn"><i class="fas fa-heart"></i> 0</button>
                    <button class="comment-action-btn"><i class="fas fa-comment"></i> 返信</button>
                </div>
            </div>
        `).join('');
    },

    // 長いテキストかどうかを判定
    isLongText(text) {
        const lines = text.split('\n');
        return lines.length > 3 || text.length > 150;
    },

    // テキストの表示/非表示を切り替え
    toggleText(type, id) {
        const content = document.getElementById(`${type}-content-${id}`);
        const button = content.nextElementSibling;
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            button.textContent = '閉じる';
        } else {
            content.classList.add('collapsed');
            button.textContent = '続きを見る';
        }
    },

    // コメントを投稿
    async submitComment() {
        const textarea = document.getElementById('commentTextarea');
        const content = textarea.value.trim();
        
        if (!content || !this.state.currentPost) return;
        
        const token = API.getCookie('authToken');
        if (!token) {
            alert('コメントするにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }
        
        const result = await API.postReply(this.state.currentPost.id, content);
        
        if (result.success) {
            textarea.value = '';
            document.getElementById('commentSubmitBtn').disabled = true;
            // Reload comments
            await this.loadPostAndComments(this.state.currentPost.id);
        } else {
            alert(`コメントの投稿に失敗しました: ${result.error}`);
        }
    },

    // エラー表示
    renderError(message) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `<div class="error">...</div>`;
    }
};

// コンポーネントをルーターに登録
router.register('comment', CommentComponent);