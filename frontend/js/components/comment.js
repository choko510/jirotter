// コメントコンポーネント
const CommentComponent = {
    // 状態管理
    state: {
        currentPost: null,
        comments: []
    },

    // レンダリング
    render(params = []) {
        const postId = params[0];
        if (!postId) {
            router.navigate('timeline');
            return;
        }

        const contentArea = document.getElementById('contentArea');
        
        // コメントモーダルのHTMLを生成
        contentArea.innerHTML = `
            <style>
                .comment-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: #ffffff;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .comment-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: #ffffff;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }

                .comment-back {
                    background: transparent;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #1a1a1a;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background 0.2s;
                }

                .comment-back:hover {
                    background: #f5f5f5;
                }

                .comment-title {
                    font-weight: bold;
                    font-size: 18px;
                }

                .comment-body {
                    overflow-y: auto;
                    max-height: calc(100vh - 120px);
                }

                .original-post {
                    padding: 16px;
                    border-bottom: 8px solid #f5f5f5;
                }

                .comment-input-section {
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .comment-input-wrapper {
                    display: flex;
                    gap: 12px;
                }

                .comment-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #d4a574;
                    flex-shrink: 0;
                }

                .comment-textarea {
                    width: 100%;
                    background: #f5f5f5;
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    padding: 12px;
                    color: #1a1a1a;
                    font-size: 15px;
                    resize: none;
                    outline: none;
                    min-height: 80px;
                    font-family: inherit;
                }

                .comment-textarea::placeholder {
                    color: #999;
                }

                .comment-submit-btn {
                    background: #d4a574;
                    color: #ffffff;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.2s;
                    align-self: flex-end;
                    margin-top: 8px;
                }

                .comment-submit-btn:hover {
                    background: #c49564;
                }

                .comment-submit-btn:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }

                .comments-list {
                    padding: 0;
                }

                .comment-item {
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
                    transition: background 0.2s;
                }

                .comment-item:hover {
                    background: #f9f9f9;
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
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .comment-text {
                    margin-top: 8px;
                    line-height: 1.5;
                }

                .comment-time {
                    color: #666;
                    font-size: 14px;
                }

                .comment-actions {
                    display: flex;
                    gap: 16px;
                    margin-top: 8px;
                    padding-left: 52px;
                }

                .comment-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    padding: 4px;
                    font-size: 14px;
                    transition: color 0.2s;
                }

                .comment-action-btn:hover {
                    color: #d4a574;
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

                .post-text {
                    line-height: 1.5;
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

                @media (max-width: 768px) {
                    .comment-container {
                        border-radius: 0;
                        max-width: 100%;
                        height: 100vh;
                        max-height: 100vh;
                    }

                    .comment-body {
                        max-height: calc(100vh - 120px);
                    }

                    .comment-textarea {
                        font-size: 16px;
                    }
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
                                <textarea class="comment-textarea" id="commentTextarea" placeholder="コメントを入力..."></textarea>
                                <button class="comment-submit-btn" id="commentSubmitBtn" onclick="CommentComponent.submitComment()" disabled>返信</button>
                            </div>
                        </div>
                    </div>
                    <div class="comments-list" id="commentsList">
                        <div class="loading">コメントを読み込み中...</div>
                    </div>
                </div>
            </div>
        `;

        // テキストエリアの入力監視
        const textarea = document.getElementById('commentTextarea');
        const submitBtn = document.getElementById('commentSubmitBtn');
        
        textarea.addEventListener('input', function() {
            submitBtn.disabled = !this.value.trim();
        });

        // 投稿とコメントを読み込み
        this.loadPostAndComments(postId);
    },

    // 投稿とコメントの読み込み
    async loadPostAndComments(postId) {
        try {
            // タイムラインから投稿を取得
            const posts = await API.getTimeline('recommend');
            const post = posts.find(p => p.id === parseInt(postId));
            
            if (!post) {
                this.renderError('投稿が見つかりません');
                return;
            }
            
            this.state.currentPost = post;
            this.renderOriginalPost(post);
            
            // コメントを取得
            const comments = await API.getComments(postId);
            this.state.comments = comments;
            this.renderComments();
            
        } catch (error) {
            console.error('投稿とコメントの読み込みに失敗しました:', error);
            this.renderError('読み込みに失敗しました');
        }
    },

    // 元の投稿をレンダリング
    renderOriginalPost(post) {
        const originalPost = document.getElementById('originalPost');
        originalPost.innerHTML = `
            <div class="post-header">
                <div class="comment-avatar">${post.user.avatar}</div>
                <div class="post-user-info">
                    <div class="post-username">
                        <span>${post.user.name}</span>
                        <span class="post-meta">${post.user.handle} · ${post.time}</span>
                    </div>
                </div>
            </div>
            <div class="post-text">${post.text}</div>
            ${post.image ? `<div class="post-image">${post.image}</div>` : ''}
        `;
    },

    // コメントをレンダリング
    renderComments() {
        const commentsList = document.getElementById('commentsList');
        
        if (this.state.comments.length === 0) {
            commentsList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <p>コメントがありません</p>
                </div>
            `;
            return;
        }

        commentsList.innerHTML = this.state.comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-avatar">${comment.user.avatar}</div>
                    <div class="comment-user-info">
                        <div class="comment-username">
                            <span>${comment.user.name}</span>
                            <span class="comment-time">${comment.user.handle} · ${comment.time}</span>
                        </div>
                    </div>
                </div>
                <div class="comment-text">${comment.text}</div>
                <div class="comment-actions">
                    <button class="comment-action-btn"><i class="fas fa-heart"></i> ${comment.likes}</button>
                    <button class="comment-action-btn"><i class="fas fa-comment"></i> 返信</button>
                </div>
            </div>
        `).join('');
    },

    // コメントを投稿
    async submitComment() {
        const textarea = document.getElementById('commentTextarea');
        const content = textarea.value.trim();
        
        if (!content) {
            alert('コメントを入力してください');
            return;
        }
        
        if (!this.state.currentPost) return;
        
        // 認証チェック
        const token = API.getCookie('authToken');
        if (!token) {
            alert('コメントするにはログインしてください');
            return;
        }
        
        await API.postComment(this.state.currentPost.id, content);
        
        // 新しいコメントを追加
        const newComment = {
            id: Date.now(),
            user: { name: 'あなた', handle: '@you', avatar: '<i class="fas fa-user"></i>' },
            text: content,
            time: 'たった今',
            likes: 0
        };
        
        this.state.comments.unshift(newComment);
        this.renderComments();
        textarea.value = '';
        document.getElementById('commentSubmitBtn').disabled = true;
        
        alert('コメントを投稿しました！');
    },

    // エラー表示
    renderError(message) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="error">
                <div>
                    <h2>エラー</h2>
                    <p>${message}</p>
                    <button onclick="router.navigate('timeline')" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">戻る</button>
                </div>
            </div>
        `;
    }
};

// コンポーネントをルーターに登録
router.register('comment', CommentComponent);