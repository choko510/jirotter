// アプリケーションのメインファイル
// API通信と共通機能

// API通信
const API = {
    defaultTimeout: 10000,
    _escapeElement: document.createElement('textarea'),
    _userExistenceCache: new Map(),

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

    getCurrentUser() {
        const userCookie = this.getCookie('user');
        if (!userCookie) return null;
        try {
            return JSON.parse(decodeURIComponent(userCookie));
        } catch (error) {
            console.error('Failed to parse user cookie', error);
            return null;
        }
    },

    async checkUserExists(userId) {
        const normalized = typeof userId === 'string' ? userId.trim() : '';
        if (!normalized) {
            return false;
        }

        const cacheKey = normalized.toLowerCase();
        if (this._userExistenceCache.has(cacheKey)) {
            return this._userExistenceCache.get(cacheKey);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

        try {
            const response = await fetch(`/api/v1/users/${encodeURIComponent(normalized)}`, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    ...this.getAuthHeader()
                },
                signal: controller.signal,
                credentials: 'same-origin'
            });

            if (response.status === 404) {
                this._userExistenceCache.set(cacheKey, false);
                return false;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this._userExistenceCache.set(cacheKey, true);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('ユーザー情報の確認がタイムアウトしました');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
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
                        if (typeof errorData.detail === 'object' && errorData.detail !== null) {
                            // Handle nested error objects like { "detail": { "password": "message" } }
                            const firstErrorKey = Object.keys(errorData.detail)[0];
                            errorMessage = errorData.detail[firstErrorKey] || errorMessage;
                        } else {
                            // Handle other error formats
                            errorMessage = errorData.detail?.[0]?.msg || errorData.detail || errorData.message || errorMessage;
                        }
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
                user_id: post.user_id,
                user: {
                    name: post.author_username,
                    handle: `@${post.author_username}`,
                    avatar: `<img src="${API.escapeHtml(post.author_profile_image_url || 'assets/baseicon.png')}" alt="User Icon" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
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
    async getShops(query = '', filters = {}) {
        try {
            const params = new URLSearchParams();
            let endpoint = '/api/v1/ramen';
            const hasLocation = filters &&
                filters.latitude !== undefined &&
                filters.longitude !== undefined &&
                filters.latitude !== '' &&
                filters.longitude !== '' &&
                Number.isFinite(Number(filters.latitude)) &&
                Number.isFinite(Number(filters.longitude));

            if (hasLocation) {
                endpoint = '/api/v1/ramen/nearby';
                params.append('latitude', Number(filters.latitude));
                params.append('longitude', Number(filters.longitude));
                const radius = Number.isFinite(Number(filters.radius_km)) ? Number(filters.radius_km) : 5;
                params.append('radius_km', radius);
            } else {
                if (query) {
                    params.append('keyword', query);
                }
                if (filters && filters.prefecture) {
                    params.append('prefecture', filters.prefecture);
                }
            }

            const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
            const data = await this.request(url);
            const shops = Array.isArray(data?.shops) ? data.shops : [];

            return shops.map(shop => ({
                id: shop.id,
                name: shop.name,
                address: shop.address,
                business_hours: shop.business_hours ?? null,
                closed_day: shop.closed_day ?? null,
                seats: shop.seats ?? null,
                latitude: shop.latitude,
                longitude: shop.longitude,
                distance: typeof shop.distance === 'number' ? shop.distance : null,
                wait_time: typeof shop.wait_time === 'number' ? shop.wait_time : null,
                last_update: shop.last_update ?? null
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

    async getShopReviews(shopId, { limit = 20, offset = 0 } = {}) {
        try {
            const params = new URLSearchParams({
                limit: String(limit),
                offset: String(offset)
            });
            const data = await this.request(
                `/api/v1/shops/${shopId}/reviews?${params.toString()}`,
                { includeAuth: true }
            );
            return {
                success: true,
                reviews: data.reviews ?? [],
                total: data.total ?? 0,
                average_rating: typeof data.average_rating === 'number' ? data.average_rating : null,
                rating_distribution: data.rating_distribution ?? {},
                user_review_id: data.user_review_id ?? null
            };
        } catch (error) {
            console.error('店舗レビューの取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    async createShopReview(shopId, payload) {
        try {
            const data = await this.request(`/api/v1/shops/${shopId}/reviews`, {
                method: 'POST',
                body: payload,
                includeAuth: true
            });
            return { success: true, review: data };
        } catch (error) {
            console.error('店舗レビューの投稿に失敗しました:', error);
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
                    avatar: `<img src="${API.escapeHtml(post.author_profile_image_url || 'assets/baseicon.png')}" alt="User Icon" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
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
                    avatar: `<img src="${API.escapeHtml(post.author_profile_image_url || 'assets/baseicon.png')}" alt="User Icon" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
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
                    avatar: `<img src="${API.escapeHtml(data.author_profile_image_url || 'assets/baseicon.png')}" alt="User Icon" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
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

    // 返信削除
    async deleteReply(replyId) {
        try {
            await this.request(`/api/v1/replies/${replyId}`, {
                method: 'DELETE',
                parseJson: true
            });
            return { success: true };
        } catch (error) {
            console.error('返信削除に失敗しました:', error);
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

    // CSRFトークンを取得
    async getCsrfToken() {
        try {
            await this.request('/api/v1/auth/csrf-token', {
                method: 'GET',
                includeAuth: false,
                parseJson: true,
                credentials: 'include'  // クッキーを含める
            });
            return true;
        } catch (error) {
            console.error('CSRFトークンの取得に失敗しました:', error);
            return false;
        }
    },

    // ユーザー登録
    async register(id, email, password) {
        try {
            // 登録前にCSRFトークンを取得
            await this.getCsrfToken();
            
            // リクエストボディをJSON文字列に変換
            const requestBody = JSON.stringify({ id, email, password });
            
            const data = await this.request('/api/v1/auth/register', {
                method: 'POST',
                body: requestBody,
                includeAuth: false,
                credentials: 'include',  // クッキーを含める
                headers: {
                    'Content-Type': 'application/json'
                }
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
            // ログイン前にCSRFトークンを取得
            await this.getCsrfToken();
            
            // リクエストボディをJSON文字列に変換
            const requestBody = JSON.stringify({ id, password });
            
            const data = await this.request('/api/v1/auth/login', {
                method: 'POST',
                body: requestBody,
                includeAuth: false,
                credentials: 'include',  // クッキーを含める
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return { success: true, token: data };
        } catch (error) {
            console.error('ログインに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // メールアドレス確認によるログイン
    async verifyEmailForLogin(id, password, email) {
        try {
            // 確認前にCSRFトークンを取得
            await this.getCsrfToken();
            
            // リクエストボディをJSON文字列に変換
            const requestBody = JSON.stringify({ id, password, email });
            
            const data = await this.request('/api/v1/auth/verify-email', {
                method: 'POST',
                body: requestBody,
                includeAuth: false,
                credentials: 'include',  // クッキーを含める
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return { success: true, token: data };
        } catch (error) {
            console.error('メールアドレス確認に失敗しました:', error);
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
            // 404エラーの場合は特別なエラーメッセージを返す
            if (error.message.includes('404') || error.message.includes('ユーザーが見つかりません')) {
                return { success: false, error: 'ユーザーが見つかりません' };
            }
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
    getFollowers: async function(userId) {
        try {
            const data = await this.request(`/api/v1/users/${userId}/followers`);
            return { success: true, users: data };
        } catch (error) {
            console.error('フォロワーの取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーのフォロー中一覧取得
    getFollowing: async function(userId) {
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

    async uploadProfileIcon(file) {
        try {
            const formData = new FormData();
            formData.append('icon', file);

            const data = await this.request('/api/v1/users/me/icon', {
                method: 'POST',
                body: formData
            });
            return { success: true, url: data.profile_image_url };
        } catch (error) {
            console.error('アイコンのアップロードに失敗しました:', error);
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
    },

    // 認証状態とアカウント状態を取得
    async getAuthStatus() {
        try {
            const data = await this.request('/api/v1/auth/status');
            
            // 存在しないアカウント or 未認証の場合はクッキー削除 + リロードで強制ログアウト
            if (!data || data.authenticated === false) {
                this.deleteCookie('authToken');
                this.deleteCookie('user');
                // ページ全体をリロードして状態をクリーンにする
                window.location.reload();
                return { success: false, status: data || null };
            }

            return { success: true, status: data };
        } catch (error) {
            console.error('認証状態の取得に失敗しました:', error);
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
        
        if (!sidebar || !overlay) return;

        const isOpening = !sidebar.classList.contains('show');

        // 開閉トグル
        sidebar.classList.toggle('show', isOpening);
        overlay.classList.toggle('show', isOpening);

        if (isOpening) {
            document.body.style.overflow = 'hidden';

            // サイドバー内メニュークリック時に確実に自動クローズ
            const menuLinks = sidebar.querySelectorAll('a, button, [data-close-sidebar]');
            menuLinks.forEach(link => {
                // 既存のハンドラを壊さず、バブリングで拾う
                link.addEventListener('click', () => {
                    sidebar.classList.remove('show');
                    overlay.classList.remove('show');
                    document.body.style.overflow = 'auto';
                });
            });
        } else {
            document.body.style.overflow = 'auto';
        }
    },

    closeSidebarOnOverlay(event) {
        if (event.target.id === 'sidebarOverlay') {
            this.toggleSidebar();
        }
    },

    // ユーザープロフィールUI更新
    async updateUserProfileUI() {
        const authToken = API.getCookie('authToken');
        const userProfile = document.querySelector('.user-profile');
        const currentUser = API.getCurrentUser();

        if (userProfile) {
            if (!authToken || !currentUser) {
                userProfile.innerHTML = `
                    <button onclick="AuthComponent.showLoginForm()" style="background: #d4a574; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; margin-top: 10px;">ログイン</button>
                `;
            } else {
                const iconSrc = API.escapeHtml(currentUser.profile_image_url || 'assets/baseicon.png');
                userProfile.innerHTML = `
                    <div class="profile-icon" style="cursor: pointer;" onclick="Utils.goToUserProfile('${currentUser.id}')">
                        <img src="${iconSrc}" alt="User Icon" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                    </div>
                    <div style="text-align: center; margin-top: 10px;">
                        <div style="font-weight: bold; cursor: pointer;" onclick="Utils.goToUserProfile('${currentUser.id}')">${currentUser.username}</div>
                        <div style="font-size: 12px; color: #666;">@${currentUser.id}</div>
                        <button onclick="Utils.logout()" style="margin-top: 8px; background: transparent; color: #666; border: 1px solid #e0e0e0; padding: 6px 12px; border-radius: 20px; cursor: pointer;">ログアウト</button>
                    </div>
                `;
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
    },

    // ユーザープロフィールページに遷移
    goToUserProfile(userId) {
        router.navigate('profile', [userId]);
    },

    // 現在のユーザーのプロフィールページに遷移
    goToCurrentUserProfile() {
        const currentUser = API.getCurrentUser();
        if (currentUser) {
            this.goToUserProfile(currentUser.id);
        } else {
            // ユーザーがログインしていない場合はログインページに遷移
            router.navigate('auth', ['login']);
        }
    },

    // Ban状態をチェックして通知を表示
    async checkAndShowBanNotification() {
        const authToken = API.getCookie('authToken');
        if (!authToken) return; // 未ログインの場合はチェックしない

        try {
            const result = await API.getAuthStatus();
            if (result.success && result.status.is_banned) {
                this.showBanNotification(result.status);
            }
        } catch (error) {
            // 401エラー（認証失敗）の場合はトークンをクリアして再ログインを促す
            if (error.message.includes('401') || error.message.includes('認証情報が不足しています') || error.message.includes('無効な認証情報です')) {
                console.log('認証トークンが無効です。トークンをクリアします。');
                API.deleteCookie('authToken');
                API.deleteCookie('user');
                this.updateUserProfileUI();
                this.showNotification('認証が切れました。再度ログインしてください。', 'warning', 5000);
            } else {
                console.error('Ban状態のチェックに失敗しました:', error);
            }
        }
    },

    // Ban通知を表示
    showBanNotification(authStatus) {
        // 既に通知が表示されている場合は何もしない
        if (document.getElementById('banNotification')) return;

        const notification = document.createElement('div');
        notification.id = 'banNotification';
        notification.className = 'ban-notification';
        
        let message = authStatus.status_message || 'アカウントが停止されています';
        if (authStatus.ban_expires_at) {
            const expiryDate = new Date(authStatus.ban_expires_at);
            message += `（${expiryDate.toLocaleDateString('ja-JP')} ${expiryDate.toLocaleTimeString('ja-JP')}まで）`;
        }

        notification.innerHTML = `
            <div class="ban-notification-content">
                <i class="fas fa-exclamation-triangle ban-notification-icon"></i>
                <span>${message}</span>
            </div>
            <button class="ban-notification-close" onclick="Utils.closeBanNotification()">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.insertBefore(notification, document.body.firstChild);
        document.body.classList.add('has-ban-notification');
    },

    // Ban通知を閉じる
    closeBanNotification() {
        const notification = document.getElementById('banNotification');
        if (notification) {
            notification.remove();
            document.body.classList.remove('has-ban-notification');
        }
    }
};

// グローバル関数（HTMLからの呼び出し用）
window.toggleSidebar = Utils.toggleSidebar;
window.closeSidebarOnOverlay = Utils.closeSidebarOnOverlay;
window.closeBanNotification = Utils.closeBanNotification;

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', function() {
   Utils.updateUserProfileUI();
    
    // Ban状態をチェックして通知を表示
    Utils.checkAndShowBanNotification();
    
    // ロゴにクリックイベントを追加してホームに遷移
    const appIcon = document.getElementById('appIcon');
    if (appIcon) {
        appIcon.addEventListener('click', function() {
            router.navigate('timeline');
        });
        appIcon.style.cursor = 'pointer'; // カーソルをポインターに変更
    }
    
    // アプリケーション起動時にCSRFトークンを取得
    API.getCsrfToken().catch(error => {
        console.error('初期CSRFトークンの取得に失敗しました:', error);
    });
});
