// アプリケーションのメインファイル
// API通信と共通機能

// API通信
const API = {
    defaultTimeout: 10000,
    _escapeElement: document.createElement('textarea'),

    // Cookie管理
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    },

    setCookie(name, value, days = 7) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict${secure}`;
    },

    deleteCookie(name) {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict${secure}`;
    },

    // 認証トークンを取得
    getAuthHeader() {
        const token = this.getCookie('authToken');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    async request(url, {
        method = 'GET',
        headers = {},
        body = undefined,
        includeAuth = true,
        timeoutMs = this.defaultTimeout,
        parseJson = true,
        credentials = 'same-origin'
    } = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const authHeaders = includeAuth ? this.getAuthHeader() : {};
        const combinedHeaders = new Headers({
            Accept: 'application/json',
            ...authHeaders,
            ...headers
        });

        // Add CSRF token for state-changing methods
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
            const csrfToken = this.getCookie('csrftoken');
            if (csrfToken) {
                combinedHeaders.set('X-CSRF-Token', csrfToken);
            }
        }

        let requestBody = body;
        const hasJsonContentType = combinedHeaders.has('Content-Type') && combinedHeaders.get('Content-Type').includes('application/json');

        if (body && !(body instanceof FormData)) {
            if (hasJsonContentType) {
                requestBody = typeof body === 'string' ? body : JSON.stringify(body);
            } else if (!combinedHeaders.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
                combinedHeaders.set('Content-Type', 'application/json');
                requestBody = typeof body === 'string' ? body : JSON.stringify(body);
            }
        }

        try {
            const response = await fetch(url, {
                method,
                headers: Object.fromEntries(combinedHeaders.entries()),
                body: requestBody,
                signal: controller.signal,
                credentials
            });

            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.detail?.[0]?.msg || errorData.detail || errorData.message || errorMessage;
                    } catch {
                        // ignore JSON parse errors and fall back to default message
                    }
                }
                throw new Error(errorMessage);
            }

            if (!parseJson) {
                return response;
            }

            if (response.status === 204) {
                return null;
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return await response.json();
            }

            return null;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('リクエストがタイムアウトしました');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    },

    // タイムライン取得
    async getTimeline(tab, page = 1) {
        try {
            // タブに応じてタイムラインの種類を指定
            const timelineType = tab === 'following' ? 'following' : 'recommend';
            const data = await this.request(`/api/v1/posts?page=${page}&per_page=20&timeline_type=${timelineType}`);
            
            const formattedPosts = data.posts.map(post => ({
                id: post.id,
                user: {
                    name: post.author_username,
                    handle: `@${post.author_username}`,
                    avatar: '<i class="fas fa-user"></i>'
                },
                text: post.content,
                image: post.image_url,  // 後方互換性
                thumbnail_url: post.thumbnail_url,
                original_image_url: post.original_image_url,
                time: this.formatTime(post.created_at),
                shop_id: post.shop_id,
                shop_name: post.shop_name,
                shop_address: post.shop_address,
                engagement: {
                    comments: post.replies_count,
                    retweets: 0,
                    likes: post.likes_count,
                    shares: 0
                },
                isLiked: post.is_liked_by_current_user
            }));

            return {
                posts: formattedPosts,
                hasMore: data.current_page < data.pages
            };

        } catch (error) {
            console.error('タイムラインの取得に失敗しました:', error);
            return { posts: [], hasMore: false };
        }
    },

    // 店舗検索
    async getShops(query, filters) {
        try {
            const url = query ? `/api/v1/ramen?keyword=${encodeURIComponent(query)}` : '/api/v1/ramen';
            const data = await this.request(url);
            return data.shops.map(shop => ({
                id: shop.id,
                name: shop.name,
                address: shop.address,
                rating: 5.0, // APIに評価がないためダミー
                category: 'ラーメン', // APIにカテゴリがないためダミー
                reviews: 100, // APIにレビュー数がないためダミー
                latitude: shop.latitude,
                longitude: shop.longitude
            }));
        } catch (error) {
            console.error('店舗の検索に失敗しました:', error);
            return [];
        }
    },

    // 店舗詳細取得
    async getShopDetail(shopId) {
        try {
            const data = await this.request(`/api/v1/ramen/${shopId}`);
            return { success: true, shop: data };
        } catch (error) {
            console.error('店舗詳細の取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // 店舗IDで投稿を取得
    async getPostsByShopId(shopId) {
        try {
            const data = await this.request(`/api/v1/posts?shop_id=${shopId}`);

            // 投稿データをフォーマット
            const formattedPosts = data.posts.map(post => ({
                id: post.id,
                user: {
                    name: post.author_username,
                    handle: `@${post.author_username}`,
                    avatar: '<i class="fas fa-user"></i>'
                },
                text: post.content,
                image: post.image_url,  // 後方互換性
                thumbnail_url: post.thumbnail_url,
                original_image_url: post.original_image_url,
                time: this.formatTime(post.created_at),
                shop_id: post.shop_id,
                shop_name: post.shop_name,
                shop_address: post.shop_address,
                engagement: {
                    comments: post.replies_count,
                    retweets: 0,
                    likes: post.likes_count,
                    shares: 0
                },
                isLiked: post.is_liked_by_current_user
            }));

            return {
                success: true,
                posts: formattedPosts
            };
        } catch (error) {
            console.error('店舗投稿の取得に失敗しました:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // 店舗関連投稿取得
    async getShopPosts(shopName) {
        try {
            // 店舗名を含む投稿を検索
            const data = await this.request(`/api/v1/posts?keyword=${encodeURIComponent(shopName)}`);

            // 投稿データをフォーマット
            const formattedPosts = data.posts.map(post => ({
                id: post.id,
                user: {
                    name: post.author_username,
                    handle: `@${post.author_username}`,
                    avatar: '<i class="fas fa-user"></i>'
                },
                text: post.content,
                image: post.image_url,  // 後方互換性
                thumbnail_url: post.thumbnail_url,
                original_image_url: post.original_image_url,
                time: this.formatTime(post.created_at),
                shop_id: post.shop_id,
                shop_name: post.shop_name,
                shop_address: post.shop_address,
                engagement: {
                    comments: post.replies_count,
                    retweets: 0,
                    likes: post.likes_count,
                    shares: 0
                },
                isLiked: post.is_liked_by_current_user
            }));

            return { success: true, posts: formattedPosts };
        } catch (error) {
            console.error('店舗投稿の取得に失敗しました:', error);
            return { success: false, error: error.message, posts: [] };
        }
    },

    // 投稿作成
    async postTweet(content, imageFile, shopId = null) {
        try {
            const formData = new FormData();
            formData.append('content', content);
            if (imageFile) {
                formData.append('image', imageFile);
            }
            if (shopId) {
                formData.append('shop_id', shopId);
            }

            const data = await this.request('/api/v1/posts', {
                method: 'POST',
                body: formData
            });
            // 新規投稿のデータも店舗情報を含めるように変換
            const formattedPost = {
                id: data.id,
                user: {
                    name: data.author_username,
                    handle: `@${data.author_username}`,
                    avatar: '<i class="fas fa-user"></i>'
                },
                text: data.content,
                image: data.image_url,  // 後方互換性
                thumbnail_url: data.thumbnail_url,
                original_image_url: data.original_image_url,
                time: this.formatTime(data.created_at),
                shop_id: data.shop_id,
                shop_name: data.shop_name,
                shop_address: data.shop_address,
                engagement: {
                    comments: 0,
                    retweets: 0,
                    likes: 0,
                    shares: 0
                },
                isLiked: false
            };
            return { success: true, post: formattedPost };
        } catch (error) {
            console.error('投稿に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // 単一投稿取得
    async getPost(postId) {
        try {
            const data = await this.request(`/api/v1/posts/${postId}`);
            return { success: true, post: data };
        } catch (error) {
            console.error('投稿の取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // 返信一覧取得
    async getRepliesForPost(postId) {
        try {
            const data = await this.request(`/api/v1/posts/${postId}/replies`);
            return { success: true, replies: data };
        } catch (error) {
            console.error('返信の取得に失敗しました:', error);
            return { success: false, error: error.message, replies: [] };
        }
    },

    // 返信投稿
    async postReply(postId, content) {
        try {
            const data = await this.request(`/api/v1/posts/${postId}/replies`, {
                method: 'POST',
                body: { content }
            });
            return { success: true, reply: data };
        } catch (error) {
            console.error('返信に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // いいねする
    async likePost(postId) {
        try {
            await this.request(`/api/v1/posts/${postId}/like`, {
                method: 'POST',
                parseJson: false
            });
            return { success: true };
        } catch (error) {
            console.error('いいねに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // いいねを取り消す
    async unlikePost(postId) {
        try {
            await this.request(`/api/v1/posts/${postId}/like`, {
                method: 'DELETE',
                parseJson: false
            });
            return { success: true };
        } catch (error) {
            console.error('いいねの取り消しに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザー登録
    async register(id, email, password) {
        try {
            const data = await this.request('/api/v1/auth/register', {
                method: 'POST',
                body: { id, email, password },
                includeAuth: false
            });
            return { success: true, token: data };
        } catch (error) {
            console.error('登録に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ログイン
    async login(id, password) {
        try {
            const data = await this.request('/api/v1/auth/login', {
                method: 'POST',
                body: { id, password },
                includeAuth: false
            });
            return { success: true, token: data };
        } catch (error) {
            console.error('ログインに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザープロフィール取得
    async getUserProfile(userId) {
        try {
            const data = await this.request(`/api/v1/users/${userId}`);
            return { success: true, user: data };
        } catch (error) {
            console.error('プロフィールの取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーをフォローする
    async followUser(userId) {
        try {
            await this.request(`/api/v1/users/${userId}/follow`, {
                method: 'POST',
                parseJson: false
            });
            return { success: true };
        } catch (error) {
            console.error('フォローに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーのフォローを解除する
    async unfollowUser(userId) {
        try {
            await this.request(`/api/v1/users/${userId}/unfollow`, {
                method: 'POST',
                parseJson: false
            });
            return { success: true };
        } catch (error) {
            console.error('フォロー解除に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーの投稿一覧取得
    async getUserPosts(userId) {
        try {
            const data = await this.request(`/api/v1/posts/user/${userId}`);
            return { success: true, posts: data.posts };
        } catch (error) {
            console.error('ユーザー投稿の取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーのフォロワー一覧取得
    async getFollowers(userId) {
        try {
            const data = await this.request(`/api/v1/users/${userId}/followers`);
            return { success: true, users: data };
        } catch (error) {
            console.error('フォロワーの取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーのフォロー中一覧取得
    async getFollowing(userId) {
        try {
            const data = await this.request(`/api/v1/users/${userId}/following`);
            return { success: true, users: data };
        } catch (error) {
            console.error('フォロー中の取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // 時間フォーマット
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) return `${diffMins}分前`;
        if (diffHours < 24) return `${diffHours}時間前`;
        if (diffDays < 7) return `${diffDays}日前`;
        
        return date.toLocaleDateString('ja-JP');
    },

    // HTMLエスケープ処理
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        this._escapeElement.textContent = text;
        return this._escapeElement.innerHTML;
    },

    // テキスト内の改行を<br>タグに変換（XSS対策済み）
    escapeHtmlWithLineBreaks(text) {
        if (text === null || text === undefined) return '';
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    },

    // 投稿を通報する
    async reportPost(postId, reason) {
        try {
            const data = await this.request(`/api/v1/posts/${postId}/report`, {
                method: 'POST',
                body: { reason }
            });
            return { success: true, report: data };
        } catch (error) {
            console.error('通報に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // プロフィール更新
    async updateUserProfile(updateData) {
        try {
            const data = await this.request('/api/v1/users/me', {
                method: 'PUT',
                body: updateData
            });
            return { success: true, user: data };
        } catch (error) {
            console.error('プロフィールの更新に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // アカウント削除
    async deleteAccount() {
        try {
            await this.request('/api/v1/users/me', {
                method: 'DELETE',
                parseJson: false
            });
            return { success: true };
        } catch (error) {
            console.error('アカウントの削除に失敗しました:', error);
            return { success: false, error: error.message };
        }
    }
};

// 共通機能
const Utils = {
    // モバイルメニューの開閉
    toggleSidebar() {
        const sidebar = document.getElementById('leftSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
        
        if (sidebar.classList.contains('show')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    },

    closeSidebarOnOverlay(event) {
        if (event.target.id === 'sidebarOverlay') {
            this.toggleSidebar();
        }
    },

    // モバイル検索の開閉
    openMobileSearch() {
        document.getElementById('mobileSearch').classList.add('show');
        document.body.style.overflow = 'hidden';
        // 検索結果をレンダリング
        this.renderMobileShops();
    },

    closeMobileSearch() {
        document.getElementById('mobileSearch').classList.remove('show');
        document.body.style.overflow = 'auto';
    },

    // モバイル用店舗リスト表示
    async renderMobileShops() {
        // ... (変更なし)
    },

    // ユーザープロフィールUI更新
    async updateUserProfileUI() {
        const authToken = API.getCookie('authToken');
        const userProfile = document.querySelector('.user-profile');
        const userCookie = API.getCookie('user');

        if (userProfile) {
            if (!authToken || !userCookie) {
                userProfile.innerHTML = `
                    <button onclick="AuthComponent.showLoginForm()" style="background: #d4a574; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer;">ログイン</button>
                `;
            } else {
                try {
                    const user = JSON.parse(decodeURIComponent(userCookie));
                    userProfile.innerHTML = `
                        <div style="text-align: center;">
                            <div style="font-weight: bold;">${user.username}</div>
                            <div style="font-size: 12px; color: #666;">@${user.id}</div>
                            <button onclick="Utils.logout()" style="margin-top: 8px; background: transparent; color: #666; border: 1px solid #e0e0e0; padding: 6px 12px; border-radius: 20px; cursor: pointer;">ログアウト</button>
                        </div>
                    `;
                } catch(e) {
                    console.error("Failed to parse user cookie", e);
                    // クッキーがおかしい場合はログアウトさせる
                    this.logout();
                }
            }
        }
    },

    // ログアウト処理
    logout() {
        API.deleteCookie('authToken');
        API.deleteCookie('user');
        this.showNotification('ログアウトしました', 'success');
        router.navigate('auth', ['login']);
        this.updateUserProfileUI();
    },

    // 通知表示
    showNotification(message, type = 'info', duration = 3000) {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 10); // Short delay to allow CSS transition

        // Hide and remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            notification.addEventListener('transitionend', () => {
                if (notification.parentNode === container) {
                    container.removeChild(notification);
                    if (container.childElementCount === 0) {
                        document.body.removeChild(container);
                    }
                }
            });
        }, duration);
    }
};

// グローバル関数（HTMLからの呼び出し用）
window.toggleSidebar = Utils.toggleSidebar;
window.closeSidebarOnOverlay = Utils.closeSidebarOnOverlay;

// --- ダークモード対応 ---
const Theme = {
    apply() {
        try {
            const settings = JSON.parse(localStorage.getItem('appSettings'));
            let theme = (settings && settings.theme) ? settings.theme : 'system';
            let darkModeEnabled = false;

            if (theme === 'system') {
                darkModeEnabled = window.matchMedia('(prefers-color-scheme: dark)').matches;
            } else if (theme === 'dark') {
                darkModeEnabled = true;
            }

            if (darkModeEnabled) {
                document.documentElement.classList.add('dark-mode');
            } else {
                document.documentElement.classList.remove('dark-mode');
            }
        } catch (e) {
            console.error("Failed to apply theme", e);
            // フォールバックとしてシステムのテーマ設定を利用
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark-mode');
            }
        }
    },
    init() {
        this.apply();
        // OSのテーマ変更をリッスン
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.apply);
    }
};

window.Theme = Theme; // グローバルに公開

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', function() {
    Theme.init(); // テーマの初期化
    Utils.updateUserProfileUI();
});