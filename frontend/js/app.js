// アプリケーションのメインファイル
// API通信と共通機能

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
    },

    // HTMLエスケープ処理
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // テキスト内の改行を<br>タグに変換（XSS対策済み）
    escapeHtmlWithLineBreaks(text) {
        if (text === null || text === undefined) return '';
        return this.escapeHtml(text).replace(/\n/g, '<br>');
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
        API.setCookie('authToken', '', -1);
        API.setCookie('user', '', -1);
        alert('ログアウトしました');
        router.navigate('timeline');
        this.updateUserProfileUI();
    },

    // ... (その他のUtils関数は変更なし)
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
// ... (その他のグローバル関数は変更なし)

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // ... (変更なし)
    // ユーザープロフィールUIの初期化
    Utils.updateUserProfileUI();
});

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', function() {
    // ... (変更なし)
    Theme.init(); // テーマの初期化
    // ユーザープロフィールUIの初期化
    Utils.updateUserProfileUI();
});