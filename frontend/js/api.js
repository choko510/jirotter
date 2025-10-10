// API通信
const API = {
    // Cookie管理
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    },

    setCookie(name, value, days = 7) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
    },

    // 認証トークンを取得
    getAuthHeader() {
        const token = this.getCookie('authToken');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    // タイムライン取得
    async getTimeline(tab, page = 1) {
        try {
            const response = await fetch(`/api/v1/posts?page=${page}&per_page=20`, {
                headers: this.getAuthHeader()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            const formattedPosts = data.posts.map(post => ({
                id: post.id,
                user: {
                    name: post.author_username,
                    handle: `@${post.author_username}`,
                    avatar: '<i class="fas fa-user"></i>'
                },
                text: post.content,
                image: post.image_url,
                time: this.formatTime(post.created_at),
                engagement: {
                    comments: post.replies.length,
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
            const response = await fetch(url, {
                headers: this.getAuthHeader()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
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

    // 投稿作成
    async postTweet(content, imageFile) {
        try {
            const formData = new FormData();
            formData.append('content', content);
            if (imageFile) {
                formData.append('image', imageFile);
            }

            const response = await fetch('/api/v1/posts', {
                method: 'POST',
                headers: this.getAuthHeader(),
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '投稿に失敗しました');
            }

            const data = await response.json();
            return { success: true, post: data };
        } catch (error) {
            console.error('投稿に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // 単一投稿取得
    async getPost(postId) {
        try {
            const response = await fetch(`/api/v1/posts/${postId}`, {
                headers: this.getAuthHeader()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return { success: true, post: data };
        } catch (error) {
            console.error('投稿の取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // 返信一覧取得
    async getRepliesForPost(postId) {
        try {
            const response = await fetch(`/api/v1/posts/${postId}/replies`, {
                headers: this.getAuthHeader()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return { success: true, replies: data };
        } catch (error) {
            console.error('返信の取得に失敗しました:', error);
            return { success: false, error: error.message, replies: [] };
        }
    },

    // 返信投稿
    async postReply(postId, content) {
        try {
            const response = await fetch(`/api/v1/posts/${postId}/replies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                },
                body: JSON.stringify({ content: content })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '返信に失敗しました');
            }
            const data = await response.json();
            return { success: true, reply: data };
        } catch (error) {
            console.error('返信に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // いいねする
    async likePost(postId) {
        try {
            const response = await fetch(`/api/v1/posts/${postId}/like`, {
                method: 'POST',
                headers: this.getAuthHeader()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'いいねに失敗しました');
            }
            return { success: true };
        } catch (error) {
            console.error('いいねに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // いいねを取り消す
    async unlikePost(postId) {
        try {
            const response = await fetch(`/api/v1/posts/${postId}/like`, {
                method: 'DELETE',
                headers: this.getAuthHeader()
            });
            if (response.status !== 204) { // No content on success
                const errorData = await response.json();
                throw new Error(errorData.detail || 'いいねの取り消しに失敗しました');
            }
            return { success: true };
        } catch (error) {
            console.error('いいねの取り消しに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザー登録
    async register(id, email, password) {
        try {
            const response = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.detail?.[0]?.msg || errorData.detail || '登録に失敗しました';
                throw new Error(errorMessage);
            }

            const data = await response.json();
            return { success: true, token: data };
        } catch (error) {
            console.error('登録に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ログイン
    async login(id, password) {
        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'ログインに失敗しました');
            }

            const data = await response.json();
            return { success: true, token: data };
        } catch (error) {
            console.error('ログインに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザープロフィール取得
    async getUserProfile(userId) {
        try {
            const response = await fetch(`/api/v1/users/${userId}`, {
                headers: this.getAuthHeader()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return { success: true, user: data };
        } catch (error) {
            console.error('プロフィールの取得に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーをフォローする
    async followUser(userId) {
        try {
            const response = await fetch(`/api/v1/users/${userId}/follow`, {
                method: 'POST',
                headers: this.getAuthHeader()
            });
            if (response.status !== 204) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'フォローに失敗しました');
            }
            return { success: true };
        } catch (error) {
            console.error('フォローに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーのフォローを解除する
    async unfollowUser(userId) {
        try {
            const response = await fetch(`/api/v1/users/${userId}/unfollow`, {
                method: 'POST',
                headers: this.getAuthHeader()
            });
            if (response.status !== 204) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'フォロー解除に失敗しました');
            }
            return { success: true };
        } catch (error) {
            console.error('フォロー解除に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ユーザーの投稿一覧取得
    async getUserPosts(userId) {
        try {
            const response = await fetch(`/api/v1/posts/user/${userId}`, {
                headers: this.getAuthHeader()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return { success: true, posts: data.posts };
        } catch (error) {
            console.error('ユーザー投稿の取得に失敗しました:', error);
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
    }
};

export default API;
