// コメントコンポーネント
const CommentComponent = {
    // 状態管理
    state: {
        currentPost: null,
        comments: [],
        isLoading: true,
        error: null,
        // 画像モーダル関連の状態
        imageModal: {
            isOpen: false,
            images: [],
            currentIndex: 0,
            zoom: 1,
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            position: { x: 0, y: 0 }
        }
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
                    background: var(--color-surface);
                    min-height: 100vh;
                    border: 1px solid rgba(231, 220, 205, 0.7);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                }

                .comment-header {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                    position: sticky;
                    top: 0;
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(14px);
                    z-index: 10;
                }

                .comment-back {
                    background: transparent;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: var(--color-text);
                    padding: 8px;
                    margin-right: 12px;
                    border-radius: 50%;
                    transition: background 0.2s;
                }

                .comment-back:hover {
                    background: var(--color-surface-muted);
                }

                .comment-title {
                    font-size: 18px;
                    font-weight: bold;
                }

                /* 元の投稿表示 */
                .original-post {
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
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

                .post-username span {
                    cursor: pointer;
                }

                .post-username span:hover {
                    text-decoration: underline;
                }

                .post-meta {
                    color: var(--color-muted);
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
                    color: var(--color-primary);
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
                    cursor: pointer;
                    transition: transform 0.2s;
                }

                .post-image img:hover {
                    transform: scale(0.98);
                }

                .post-engagement {
                    display: flex;
                    justify-content: space-around;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid var(--color-border);
                }

                .engagement-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: transparent;
                    border: none;
                    color: var(--color-muted);
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .engagement-btn:hover {
                    background: var(--color-surface-muted);
                    color: var(--color-primary);
                }

                .engagement-btn .liked {
                    color: #e0245e;
                }

                /* コメント入力 */
                .comment-input-section {
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                }

                .comment-input-wrapper {
                    display: flex;
                    gap: 12px;
                }

                .comment-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: var(--color-primary);
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
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
                    color: rgba(47, 37, 25, 0.45);
                }

                .comment-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 8px;
                }

                .char-counter {
                    color: var(--color-muted);
                    font-size: 14px;
                }

                .char-counter.warning {
                    color: #ff9800;
                }

                .char-counter.error {
                    color: #f44336;
                }

                .comment-submit-btn {
                    background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
                    color: #fff;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 999px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    box-shadow: var(--shadow-xs);
                }

                .comment-submit-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-sm);
                }

                .comment-submit-btn:disabled {
                    background: rgba(120, 108, 95, 0.25);
                    color: rgba(120, 108, 95, 0.7);
                    cursor: not-allowed;
                    box-shadow: none;
                    transform: none;
                }

                /* コメントリスト */
                .comments-list {
                    padding: 0 16px;
                }

                .comment-item {
                    padding: 20px 0;
                    border-bottom: 1px solid var(--color-border);
                    transition: background 0.2s ease;
                }

                .comment-item:hover {
                    background: var(--color-surface-muted);
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

                .comment-username span {
                    cursor: pointer;
                }

                .comment-username span:hover {
                    text-decoration: underline;
                }

                .comment-time {
                    color: var(--color-muted);
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
                    color: var(--color-muted);
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .comment-action-btn:hover {
                    background: var(--color-surface-muted);
                    color: var(--color-primary);
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
                    background: #1f1a14;
                    color: #f5f0e9;
                    border-color: #3a3126;
                    box-shadow: none;
                }

                .dark-mode .comment-header {
                    background: rgba(31, 26, 20, 0.92);
                    border-bottom-color: #3a3126;
                }

                .dark-mode .comment-back {
                    color: #f5f0e9;
                }

                .dark-mode .comment-back:hover {
                    background: #342b1f;
                }

                .dark-mode .original-post,
                .dark-mode .comment-input-section,
                .dark-mode .comment-item {
                    border-bottom-color: #3a3126;
                }

                .dark-mode .post-meta,
                .dark-mode .comment-time,
                .dark-mode .comment-action-btn {
                    color: rgba(255, 255, 255, 0.65);
                }

                .dark-mode .comment-textarea {
                    color: #f5f0e9;
                }

                .dark-mode .comment-textarea::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }

                .dark-mode .comment-item:hover {
                    background: #2a231a;
                }

                .dark-mode .comment-action-btn:hover {
                    background: #333;
                    color: var(--color-primary);
                }

                .dark-mode .post-engagement {
                    border-top-color: #333;
                }

                .dark-mode .engagement-btn {
                    color: rgba(255, 255, 255, 0.65);
                }

                .dark-mode .engagement-btn:hover {
                    background: #333;
                    color: var(--color-primary);
                }

                /* 画像モーダルスタイル */
                .image-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s, visibility 0.3s;
                }

                .image-modal-overlay.show {
                    opacity: 1;
                    visibility: visible;
                }

                .image-modal-container {
                    position: relative;
                    width: 90%;
                    height: 90%;
                    max-width: 1200px;
                    max-height: 800px;
                    display: flex;
                    flex-direction: column;
                }

                .image-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    color: #fff;
                }

                .image-modal-close {
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }

                .image-modal-close:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .image-modal-content {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }

                .image-modal-image-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: grab;
                }

                .image-modal-image-container.dragging {
                    cursor: grabbing;
                }

                .image-modal-image {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    transform-origin: center;
                    transition: transform 0.1s;
                    user-select: none;
                    -webkit-user-drag: none;
                }

                .image-modal-nav {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(0, 0, 0, 0.5);
                    color: #fff;
                    border: none;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 18px;
                    transition: background 0.2s;
                    z-index: 10;
                }

                .image-modal-nav:hover {
                    background: rgba(0, 0, 0, 0.7);
                }

                .image-modal-nav.prev {
                    left: 20px;
                }

                .image-modal-nav.next {
                    right: 20px;
                }

                .image-modal-nav.disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                .image-modal-controls {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 16px;
                    background: rgba(0, 0, 0, 0.5);
                    padding: 12px 20px;
                    border-radius: 30px;
                    color: #fff;
                }

                .image-modal-control-btn {
                    background: none;
                    border: none;
                    color: #fff;
                    cursor: pointer;
                    font-size: 18px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }

                .image-modal-control-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .image-modal-indicator {
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    min-width: 60px;
                    justify-content: center;
                }

                .image-modal-loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #fff;
                    font-size: 18px;
                }

                /* モバイル対応 */
                @media (max-width: 768px) {
                    .image-modal-container {
                        width: 100%;
                        height: 100%;
                        max-width: none;
                        max-height: none;
                    }

                    .image-modal-header {
                        padding: 12px 16px;
                    }

                    .image-modal-nav {
                        width: 40px;
                        height: 40px;
                        font-size: 16px;
                    }

                    .image-modal-nav.prev {
                        left: 10px;
                    }

                    .image-modal-nav.next {
                        right: 10px;
                    }

                    .image-modal-controls {
                        bottom: 16px;
                        padding: 8px 16px;
                        gap: 12px;
                    }

                    .image-modal-control-btn {
                        width: 32px;
                        height: 32px;
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
                
                <!-- 画像モーダル -->
                <div class="image-modal-overlay" id="imageModal">
                    <div class="image-modal-container">
                        <div class="image-modal-header">
                            <div class="image-modal-indicator" id="imageModalIndicator">1 / 1</div>
                            <button class="image-modal-close" id="imageModalClose">&times;</button>
                        </div>
                        <div class="image-modal-content">
                            <button class="image-modal-nav prev" id="imageModalPrev">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <div class="image-modal-image-container" id="imageModalImageContainer">
                                <img class="image-modal-image" id="imageModalImage" src="" alt="拡大画像">
                                <div class="image-modal-loading" id="imageModalLoading" style="display: none;">
                                    <i class="fas fa-spinner fa-spin"></i> 読み込み中...
                                </div>
                            </div>
                            <button class="image-modal-nav next" id="imageModalNext">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div class="image-modal-controls">
                            <button class="image-modal-control-btn" id="imageModalZoomOut" title="縮小">
                                <i class="fas fa-search-minus"></i>
                            </button>
                            <button class="image-modal-control-btn" id="imageModalZoomReset" title="元のサイズ">
                                <i class="fas fa-compress"></i>
                            </button>
                            <button class="image-modal-control-btn" id="imageModalZoomIn" title="拡大">
                                <i class="fas fa-search-plus"></i>
                            </button>
                        </div>
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
        
        // 画像モーダルのイベントリスナーを設定
        this.setupImageModalListeners();
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
        const postAvatarSrc = API.escapeHtml(post.author_profile_image_url || 'assets/baseicon.png');
        originalPost.innerHTML = `
            <div class="post-header">
                <div class="comment-avatar"><img src="${postAvatarSrc}" alt="${API.escapeHtml(post.author_username)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"></div>
                <div class="post-user-info">
                    <div class="post-username">
                        <span onclick="event.stopPropagation(); router.navigate('profile', ['${API.escapeHtml(post.user_id)}'])">${API.escapeHtml(post.author_username)}</span>
                        <span class="post-meta">@${API.escapeHtml(post.user_id)} · ${API.formatTime(post.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="post-text" id="post-text-${post.id}">
                <div class="post-content" id="post-content-${post.id}">${API.escapeHtmlWithLineBreaks(post.content)}</div>
                ${this.isLongText(post.content) ? `<button class="show-more-btn" onclick="CommentComponent.toggleText('post', ${post.id})">続きを見る</button>` : ''}
            </div>
            ${this.createPostImageHTML(post)}
            <div class="post-engagement">
                <button class="engagement-btn" onclick="CommentComponent.handleLike(${post.id})">
                    <i class="fas fa-heart ${post.is_liked_by_current_user ? 'liked' : ''}" id="like-icon-${post.id}"></i> 
                    <span id="like-count-${post.id}">${post.likes_count || 0}</span>
                </button>
                <button class="engagement-btn" onclick="CommentComponent.sharePost(${post.id})">
                    <i class="fas fa-share"></i> 共有
                </button>
            </div>
        `;
    },

    // コメントをレンダリング
    renderComments() {
        const commentsList = document.getElementById('commentsList');
        
        if (this.state.comments.length === 0) {
            commentsList.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--color-muted);"><p>コメントがありません</p></div>`;
            return;
        }

       commentsList.innerHTML = this.state.comments.map(comment => `
           <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <div class="comment-avatar"><img src="${API.escapeHtml(comment.author_profile_image_url || 'assets/baseicon.png')}" alt="${API.escapeHtml(comment.author_username)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"></div>
                    <div class="comment-user-info">
                        <div class="comment-username">
                            <span onclick="event.stopPropagation(); router.navigate('profile', ['${API.escapeHtml(comment.user_id)}'])">${API.escapeHtml(comment.author_username)}</span>
                            <span class="comment-time">@${API.escapeHtml(comment.user_id)} · ${API.formatTime(comment.created_at)}</span>
                        </div>
                    </div>
                </div>
                <div class="comment-text" id="comment-text-${comment.id}">
                    <div class="comment-content" id="comment-content-${comment.id}">${API.escapeHtmlWithLineBreaks(comment.content)}</div>
                    ${this.isLongText(comment.content) ? `<button class="show-more-btn" onclick="CommentComponent.toggleText('comment', ${comment.id})">続きを見る</button>` : ''}
                </div>
               ${this.createCommentImageHTML(comment)}
               <div class="comment-actions">
                   <button class="comment-action-btn" onclick="CommentComponent.handleCommentLike(${comment.id})">
                       <i class="fas fa-heart ${comment.is_liked_by_current_user ? 'liked' : ''}" id="comment-like-icon-${comment.id}"></i>
                       <span id="comment-like-count-${comment.id}">${comment.likes_count || 0}</span>
                   </button>
                   <button class="comment-action-btn" onclick="CommentComponent.shareComment(${comment.id})">
                       <i class="fas fa-share"></i> 共有
                   </button>
                   ${this.renderDeleteButton(comment)}
               </div>
           </div>
       `).join('');
   },

   // 削除ボタンの表示制御
   renderDeleteButton(comment) {
       const token = API.getCookie('authToken');
       if (!token) return '';

       // ログインユーザー情報が全体どこかで管理されている前提
       // API.getCurrentUser() があればそれを利用し、なければサーバー側で検証されるため常に表示しても良いが、
       // ここでは安全側に「コメント投稿者のみ」表示する想定で user_id を比較
       const currentUserId = API.getCurrentUserId ? API.getCurrentUserId() : null;

       if (currentUserId && String(currentUserId) === String(comment.user_id)) {
           return `
               <button class="comment-action-btn" onclick="CommentComponent.confirmAndDeleteReply(${comment.id})">
                   <i class="fas fa-trash-alt"></i> 削除
               </button>
           `;
       }

       return '';
   },

   // 返信削除処理
   async confirmAndDeleteReply(commentId) {
       if (!confirm('この返信を削除しますか？')) {
           return;
       }

       const token = API.getCookie('authToken');
       if (!token) {
           alert('削除するにはログインしてください');
           router.navigate('auth', ['login']);
           return;
       }

       try {
           const result = await API.deleteReply(commentId);

           if (!result.success) {
               alert(`削除に失敗しました: ${result.error}`);
               return;
           }

           // ローカル状態から削除
           this.state.comments = this.state.comments.filter(c => c.id !== commentId);

           // DOMから削除
           const item = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
           if (item) {
               item.remove();
           }

       } catch (error) {
           console.error('返信削除中にエラーが発生しました:', error);
           alert('返信の削除に失敗しました。時間をおいて再度お試しください。');
       }
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
            
            // 遅延読み込みを再設定
            setTimeout(() => {
                this.setupLazyLoading();
            }, 100);
        } else {
            alert(`コメントの投稿に失敗しました: ${result.error}`);
        }
    },

    // いいね処理
    async handleLike(postId) {
        const token = API.getCookie('authToken');
        if (!token) {
            alert('いいねするにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        const post = this.state.currentPost;
        if (!post || post.id !== postId) return;

        const originalLikedState = post.is_liked_by_current_user;
        const originalLikesCount = post.likes_count || 0;

        // UIを即座に更新
        post.is_liked_by_current_user = !originalLikedState;
        post.likes_count = originalLikedState ? originalLikesCount - 1 : originalLikesCount + 1;
        
        const likeIcon = document.getElementById(`like-icon-${postId}`);
        const likeCount = document.getElementById(`like-count-${postId}`);
        
        if (likeIcon) {
            likeIcon.classList.toggle('liked', post.is_liked_by_current_user);
        }
        
        if (likeCount) {
            likeCount.textContent = post.likes_count;
        }

        try {
            const result = post.is_liked_by_current_user ? 
                await API.likePost(postId) : 
                await API.unlikePost(postId);
                
            if (!result.success) {
                // 失敗した場合は元に戻す
                post.is_liked_by_current_user = originalLikedState;
                post.likes_count = originalLikesCount;
                
                if (likeIcon) {
                    likeIcon.classList.toggle('liked', originalLikedState);
                }
                
                if (likeCount) {
                    likeCount.textContent = originalLikesCount;
                }
                
                alert(`エラー: ${result.error}`);
            }
        } catch (error) {
            // 失敗した場合は元に戻す
            post.is_liked_by_current_user = originalLikedState;
            post.likes_count = originalLikesCount;
            
            if (likeIcon) {
                likeIcon.classList.toggle('liked', originalLikedState);
            }
            
            if (likeCount) {
                likeCount.textContent = originalLikesCount;
            }
            
            alert('いいねに失敗しました。');
        }
    },

    // コメントのいいね処理
    async handleCommentLike(commentId) {
        const token = API.getCookie('authToken');
        if (!token) {
            alert('いいねするにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        const comment = this.state.comments.find(c => c.id === commentId);
        if (!comment) return;

        const originalLikedState = comment.is_liked_by_current_user;
        const originalLikesCount = comment.likes_count || 0;

        // UIを即座に更新
        comment.is_liked_by_current_user = !originalLikedState;
        comment.likes_count = originalLikedState ? originalLikesCount - 1 : originalLikesCount + 1;
        
        const likeIcon = document.getElementById(`comment-like-icon-${commentId}`);
        const likeCount = document.getElementById(`comment-like-count-${commentId}`);
        
        if (likeIcon) {
            likeIcon.classList.toggle('liked', comment.is_liked_by_current_user);
        }
        
        if (likeCount) {
            likeCount.textContent = comment.likes_count;
        }

        try {
            // コメントのいいねAPIがあれば使用する
            // 現在は投稿といいねAPIを共通で使用
            const result = comment.is_liked_by_current_user ? 
                await API.likePost(commentId) : 
                await API.unlikePost(commentId);
                
            if (!result.success) {
                // 失敗した場合は元に戻す
                comment.is_liked_by_current_user = originalLikedState;
                comment.likes_count = originalLikesCount;
                
                if (likeIcon) {
                    likeIcon.classList.toggle('liked', originalLikedState);
                }
                
                if (likeCount) {
                    likeCount.textContent = originalLikesCount;
                }
                
                alert(`エラー: ${result.error}`);
            }
        } catch (error) {
            // 失敗した場合は元に戻す
            comment.is_liked_by_current_user = originalLikedState;
            comment.likes_count = originalLikesCount;
            
            if (likeIcon) {
                likeIcon.classList.toggle('liked', originalLikedState);
            }
            
            if (likeCount) {
                likeCount.textContent = originalLikesCount;
            }
            
            alert('いいねに失敗しました。');
        }
    },

    // 投稿を共有
    sharePost(postId) {
        const post = this.state.currentPost;
        if (!post || post.id !== postId) return;

        // 現在のURLを取得
        const currentUrl = window.location.href;
        const shareUrl = `${window.location.origin}/#comment/${postId}`;
        
        // Web Share APIが利用可能かチェック
        if (navigator.share) {
            navigator.share({
                title: `${post.author_username}さんの投稿`,
                text: post.content,
                url: shareUrl
            }).catch(err => {
                console.log('共有がキャンセルされました', err);
                // フォールバックとしてクリップボードにコピー
                this.copyToClipboard(shareUrl);
            });
        } else {
            // フォールバックとしてクリップボードにコピー
            this.copyToClipboard(shareUrl);
        }
    },

    // コメントを共有
    shareComment(commentId) {
        const comment = this.state.comments.find(c => c.id === commentId);
        if (!comment) return;

        // 現在のURLを取得
        const shareUrl = `${window.location.origin}/#comment/${this.state.currentPost.id}`;
        
        // Web Share APIが利用可能かチェック
        if (navigator.share) {
            navigator.share({
                title: `${comment.author_username}さんのコメント`,
                text: comment.content,
                url: shareUrl
            }).catch(err => {
                console.log('共有がキャンセルされました', err);
                // フォールバックとしてクリップボードにコピー
                this.copyToClipboard(shareUrl);
            });
        } else {
            // フォールバックとしてクリップボードにコピー
            this.copyToClipboard(shareUrl);
        }
    },

    // クリップボードにコピー
    copyToClipboard(text) {
        // テキストエリアを作成してコピー
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; // 画面外に配置
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('リンクをクリップボードにコピーしました');
            } else {
                alert('コピーに失敗しました');
            }
        } catch (err) {
            console.error('コピーに失敗しました:', err);
            alert('コピーに失敗しました');
        }
        
        document.body.removeChild(textarea);
    },

    // エラー表示
    renderError(message) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `<div class="error">...</div>`;
    },

    // 画像モーダルのイベントリスナーを設定
    setupImageModalListeners() {
        const modal = document.getElementById('imageModal');
        const closeBtn = document.getElementById('imageModalClose');
        const prevBtn = document.getElementById('imageModalPrev');
        const nextBtn = document.getElementById('imageModalNext');
        const zoomInBtn = document.getElementById('imageModalZoomIn');
        const zoomOutBtn = document.getElementById('imageModalZoomOut');
        const zoomResetBtn = document.getElementById('imageModalZoomReset');
        const imageContainer = document.getElementById('imageModalImageContainer');
        const modalImage = document.getElementById('imageModalImage');

        // 閉じるボタン
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeImageModal());
        }

        // モーダル背景クリックで閉じる
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeImageModal();
                }
            });
        }

        // ESCキーで閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.imageModal.isOpen) {
                this.closeImageModal();
            }
        });

        // ナビゲーションボタン
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigateImage(-1));
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigateImage(1));
        }

        // ズームボタン
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomImage(0.2));
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomImage(-0.2));
        }

        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => this.resetImageZoom());
        }

        // 画像のドラッグ機能
        if (imageContainer && modalImage) {
            let startX, startY, initialX, initialY;

            const handleMouseDown = (e) => {
                if (this.state.imageModal.zoom <= 1) return;
                
                this.state.imageModal.isDragging = true;
                imageContainer.classList.add('dragging');
                
                startX = e.clientX;
                startY = e.clientY;
                initialX = this.state.imageModal.position.x;
                initialY = this.state.imageModal.position.y;
                
                e.preventDefault();
            };

            const handleMouseMove = (e) => {
                if (!this.state.imageModal.isDragging) return;
                
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                this.state.imageModal.position.x = initialX + dx;
                this.state.imageModal.position.y = initialY + dy;
                
                this.updateImageTransform();
            };

            const handleMouseUp = () => {
                this.state.imageModal.isDragging = false;
                imageContainer.classList.remove('dragging');
            };

            // マウスイベント
            imageContainer.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // タッチイベント
            imageContainer.addEventListener('touchstart', (e) => {
                if (this.state.imageModal.zoom <= 1) return;
                
                const touch = e.touches[0];
                handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
            });

            document.addEventListener('touchmove', (e) => {
                if (!this.state.imageModal.isDragging) return;
                
                const touch = e.touches[0];
                handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            });

            document.addEventListener('touchend', handleMouseUp);

            // ダブルクリックでズーム
            imageContainer.addEventListener('dblclick', () => {
                if (this.state.imageModal.zoom === 1) {
                    this.state.imageModal.zoom = 2;
                } else {
                    this.resetImageZoom();
                }
                this.updateImageTransform();
            });

            // マウスホイールでズーム
            imageContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoomImage(delta);
            });
        }

        // スワイプで画像切り替え
        let touchStartX = 0;
        let touchEndX = 0;

        if (modal) {
            modal.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            });

            modal.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe();
            });
        }
    },

    // スワイプ処理
    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // 左にスワイプ - 次の画像
                this.navigateImage(1);
            } else {
                // 右にスワイプ - 前の画像
                this.navigateImage(-1);
            }
        }
    },

    // 画像モーダルを開く
    openImageModal(images, startIndex = 0) {
        if (!images || images.length === 0) return;
        
        this.state.imageModal.images = images;
        this.state.imageModal.currentIndex = startIndex;
        this.state.imageModal.isOpen = true;
        this.state.imageModal.zoom = 1;
        this.state.imageModal.position = { x: 0, y: 0 };
        
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('imageModalImage');
        const loading = document.getElementById('imageModalLoading');
        
        if (modal && modalImage) {
            // ローディング表示
            if (loading) loading.style.display = 'block';
            modalImage.style.opacity = '0';
            
            // 画像を読み込んで表示
            modalImage.onload = () => {
                if (loading) loading.style.display = 'none';
                modalImage.style.opacity = '1';
            };
            
            modalImage.onerror = () => {
                if (loading) loading.style.display = 'none';
                console.error('画像の読み込みに失敗しました');
            };
            
            modalImage.src = images[startIndex];
            
            // モーダルを表示
            modal.classList.add('show');
            
            // UIを更新
            this.updateImageModalUI();
            
            // スクロールを無効化
            document.body.style.overflow = 'hidden';
        }
    },

    // 画像モーダルを閉じる
    closeImageModal() {
        const modal = document.getElementById('imageModal');
        
        if (modal) {
            modal.classList.remove('show');
            this.state.imageModal.isOpen = false;
            
            // スクロールを有効化
            document.body.style.overflow = '';
            
            // 少し遅延して画像をクリア
            setTimeout(() => {
                const modalImage = document.getElementById('imageModalImage');
                if (modalImage) {
                    modalImage.src = '';
                }
            }, 300);
        }
    },

    // 画像ナビゲーション
    navigateImage(direction) {
        const newIndex = this.state.imageModal.currentIndex + direction;
        const images = this.state.imageModal.images;
        
        if (newIndex < 0 || newIndex >= images.length) return;
        
        this.state.imageModal.currentIndex = newIndex;
        this.state.imageModal.zoom = 1;
        this.state.imageModal.position = { x: 0, y: 0 };
        
        const modalImage = document.getElementById('imageModalImage');
        const loading = document.getElementById('imageModalLoading');
        
        if (modalImage) {
            // ローディング表示
            if (loading) loading.style.display = 'block';
            modalImage.style.opacity = '0';
            
            // 画像を読み込んで表示
            modalImage.onload = () => {
                if (loading) loading.style.display = 'none';
                modalImage.style.opacity = '1';
            };
            
            modalImage.onerror = () => {
                if (loading) loading.style.display = 'none';
                console.error('画像の読み込みに失敗しました');
            };
            
            modalImage.src = images[newIndex];
            this.updateImageTransform();
        }
        
        this.updateImageModalUI();
    },

    // 画像ズーム
    zoomImage(delta) {
        const newZoom = Math.max(0.5, Math.min(5, this.state.imageModal.zoom + delta));
        this.state.imageModal.zoom = newZoom;
        this.updateImageTransform();
    },

    // 画像ズームリセット
    resetImageZoom() {
        this.state.imageModal.zoom = 1;
        this.state.imageModal.position = { x: 0, y: 0 };
        this.updateImageTransform();
    },

    // 画像の変換を更新
    updateImageTransform() {
        const modalImage = document.getElementById('imageModalImage');
        if (modalImage) {
            const { zoom, position } = this.state.imageModal;
            modalImage.style.transform = `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`;
        }
    },

    // 画像モーダルのUIを更新
    updateImageModalUI() {
        const { images, currentIndex } = this.state.imageModal;
        const indicator = document.getElementById('imageModalIndicator');
        const prevBtn = document.getElementById('imageModalPrev');
        const nextBtn = document.getElementById('imageModalNext');
        
        // インジケーターを更新
        if (indicator) {
            indicator.textContent = `${currentIndex + 1} / ${images.length}`;
        }
        
        // ナビゲーションボタンの状態を更新
        if (prevBtn) {
            prevBtn.classList.toggle('disabled', currentIndex === 0);
        }
        
        if (nextBtn) {
            nextBtn.classList.toggle('disabled', currentIndex === images.length - 1);
        }
    },

    // 投稿画像のHTMLを生成（picture要素を使用）
    createPostImageHTML(post) {
        // 新しい画像URLがある場合はpicture要素を使用
        if (post.thumbnail_url || post.original_image_url) {
            const thumbnailUrl = post.thumbnail_url || post.image_url;
            const originalUrl = post.original_image_url || post.image_url;
            
            return `
                <div class="post-image">
                    <picture>
                        <source srcset="${API.escapeHtml(originalUrl)}" media="(min-width: 768px)">
                        <img src="${API.escapeHtml(thumbnailUrl)}"
                             style="width:100%; border-radius: 16px; margin-top: 12px;"
                             alt="Post image"
                             loading="lazy"
                             data-src="${API.escapeHtml(originalUrl)}"
                             onclick="CommentComponent.openImageModal(['${API.escapeHtml(originalUrl)}'], 0)">
                    </picture>
                </div>
            `;
        }
        
        // 後方互換性のための従来の画像表示
        if (post.image_url) {
            return `
                <div class="post-image">
                    <img src="${API.escapeHtml(post.image_url)}"
                         style="width:100%; border-radius: 16px; margin-top: 12px;"
                         alt="Post image"
                         loading="lazy"
                         onclick="CommentComponent.openImageModal(['${API.escapeHtml(post.image_url)}'], 0)">
                </div>
            `;
        }
        
        return '';
    },

    // コメント画像のHTMLを生成
    createCommentImageHTML(comment) {
        // 新しい画像URLがある場合はpicture要素を使用
        if (comment.thumbnail_url || comment.original_image_url) {
            const thumbnailUrl = comment.thumbnail_url || comment.image_url;
            const originalUrl = comment.original_image_url || comment.image_url;
            
            return `
                <div class="post-image">
                    <picture>
                        <source srcset="${API.escapeHtml(originalUrl)}" media="(min-width: 768px)">
                        <img src="${API.escapeHtml(thumbnailUrl)}"
                             style="width:100%; border-radius: 16px; margin-top: 12px;"
                             alt="Comment image"
                             loading="lazy"
                             data-src="${API.escapeHtml(originalUrl)}"
                             onclick="CommentComponent.openImageModal(['${API.escapeHtml(originalUrl)}'], 0)">
                    </picture>
                </div>
            `;
        }
        
        // 後方互換性のための従来の画像表示
        if (comment.image_url) {
            return `
                <div class="post-image">
                    <img src="${API.escapeHtml(comment.image_url)}"
                         style="width:100%; border-radius: 16px; margin-top: 12px;"
                         alt="Comment image"
                         loading="lazy"
                         onclick="CommentComponent.openImageModal(['${API.escapeHtml(comment.image_url)}'], 0)">
                </div>
            `;
        }
        
        return '';
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

// コンポーネントをルーターに登録
router.register('comment', CommentComponent);