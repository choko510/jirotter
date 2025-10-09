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
                /* ... styles ... */
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
                                <button class="comment-submit-btn" id="commentSubmitBtn" disabled>返信</button>
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
            textarea.addEventListener('input', () => {
                submitBtn.disabled = !textarea.value.trim();
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
                        <span>${post.author_username}</span>
                        <span class="post-meta">@${post.user_id} · ${API.formatTime(post.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="post-text">${post.content.replace(/\n/g, '<br>')}</div>
            ${post.image_url ? `<div class="post-image"><img src="${post.image_url}" style="width:100%; border-radius: 16px; margin-top: 12px;" alt="Post image"></div>` : ''}
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
                            <span>${comment.author_username}</span>
                            <span class="comment-time">@${comment.user_id} · ${API.formatTime(comment.created_at)}</span>
                        </div>
                    </div>
                </div>
                <div class="comment-text">${comment.content.replace(/\n/g, '<br>')}</div>
                <div class="comment-actions">
                    <button class="comment-action-btn"><i class="fas fa-heart"></i> 0</button>
                    <button class="comment-action-btn"><i class="fas fa-comment"></i> 返信</button>
                </div>
            </div>
        `).join('');
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