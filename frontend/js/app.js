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
        document.cookie = `${name}=${value}; expires=${expires}; path=/`;
    },

    // 認証トークンを取得
    getAuthHeader() {
        const token = this.getCookie('authToken');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    // タイムライン取得
    async getTimeline(tab) {
        try {
            const response = await fetch(`/api/v1/posts?page=1&per_page=20`, {
                headers: this.getAuthHeader()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // APIレスポンスをフロントエンドの形式に変換
            return data.posts.map(post => ({
                id: post.id,
                user: {
                    name: post.author_username,
                    handle: `@${post.author_username}`,
                    avatar: '<i class="fas fa-user"></i>'
                },
                text: post.content,
                image: null,
                time: this.formatTime(post.created_at),
                engagement: { comments: 0, retweets: 0, likes: 0, shares: 0 }
            }));
        } catch (error) {
            console.error('タイムラインの取得に失敗しました:', error);
            return [];
        }
    },

    // 店舗検索
    async getShops(query, filters) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    { id: 1, name: '下荒庄', rating: 5.0, category: '二郎風(詳細)', reviews: 1000 },
                    { id: 2, name: '店舗2', rating: 1.5, category: '~風(詳細)', reviews: 1000 },
                    { id: 3, name: '店舗3', rating: 1.5, category: '~風(詳細)', reviews: 1000 },
                    { id: 4, name: '店舗4', rating: 1.5, category: '~風(詳細)', reviews: 1000 },
                    { id: 5, name: '店舗5', rating: 1.5, category: '~風(詳細)', reviews: 1000 }
                ]);
            }, 300);
        });
    },

    // 投稿作成
    async postTweet(content) {
        try {
            const response = await fetch('/api/v1/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                },
                body: JSON.stringify({ content: content })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return { success: true, id: data.id };
        } catch (error) {
            console.error('投稿に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // コメント取得
    async getComments(postId) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    {
                        id: 1,
                        user: { name: 'ユーザーA', handle: '@userA', avatar: '<i class="fas fa-user"></i>' },
                        text: '美味しそう！どこの店舗ですか？',
                        time: '5分前',
                        likes: 3
                    },
                    {
                        id: 2,
                        user: { name: 'ユーザーB', handle: '@userB', avatar: '<i class="fas fa-user"></i>' },
                        text: 'ニンニク増しましたか？',
                        time: '10分前',
                        likes: 1
                    },
                    {
                        id: 3,
                        user: { name: 'ラーメン太郎', handle: '@ramen_taro', avatar: '<i class="fas fa-user"></i>' },
                        text: '野菜マシマシにすべきですね！',
                        time: '15分前',
                        likes: 8
                    },
                    {
                        id: 4,
                        user: { name: '二郎ファン', handle: '@jiro_fan', avatar: '<i class="fas fa-user"></i>' },
                        text: 'いいですね〜！私も今度行きます',
                        time: '30分前',
                        likes: 2
                    }
                ]);
            }, 300);
        });
    },

    // コメント投稿
    async postComment(postId, content) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({ success: true, id: Date.now() });
            }, 300);
        });
    },

    // ユーザー登録
    async register(username, email, password) {
        try {
            const response = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '登録に失敗しました');
            }
            
            const data = await response.json();
            return { success: true, token: data.access_token, user: data.user };
        } catch (error) {
            console.error('登録に失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // ログイン
    async login(username, password) {
        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'ログインに失敗しました');
            }
            
            const data = await response.json();
            return { success: true, token: data.access_token, user: data.user };
        } catch (error) {
            console.error('ログインに失敗しました:', error);
            return { success: false, error: error.message };
        }
    },

    // プロフィール取得
    async getProfile() {
        try {
            const response = await fetch('/api/v1/auth/profile', {
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
        const mobileShopList = document.getElementById('mobileShopList');
        const shops = await API.getShops('', {});
        
        mobileShopList.innerHTML = shops.map(shop => `
            <div class="shop-item" onclick="showShopDetail(${shop.id})">
                <div class="shop-name">
                    ${shop.name}
                    <span class="shop-rating">⭐${shop.rating.toFixed(1)}</span>
                </div>
                <div class="shop-details">
                    <span class="shop-category">${shop.category}</span>
                    <button class="detail-btn" onclick="event.stopPropagation(); showShopDetail(${shop.id})">詳細</button>
                </div>
            </div>
        `).join('');
    },

    // ユーザープロフィールUI更新
    async updateUserProfileUI() {
        const authToken = API.getCookie('authToken');
        const userProfile = document.querySelector('.user-profile');
        
        if (userProfile) {
            if (!authToken) {
                userProfile.innerHTML = `
                    <button onclick="AuthComponent.showLoginForm()" style="background: #d4a574; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer;">ログイン</button>
                `;
            } else {
                userProfile.innerHTML = `
                    <button onclick="Utils.logout()" style="background: transparent; color: #666; border: 1px solid #e0e0e0; padding: 8px 16px; border-radius: 20px; cursor: pointer;">ログアウト</button>
                `;
            }
        }
    },

    // ログアウト処理
    logout() {
        API.setCookie('authToken', '', -1);
        alert('ログアウトしました');
        router.navigate('timeline');
        this.updateUserProfileUI();
    },

    // 店舗詳細表示
    showShopDetail(shopId) {
        alert(`店舗ID: ${shopId} の詳細を表示`);
    },

    // フィルターボタン処理
    handleFilterClick(filterType) {
        alert(`${filterType}フィルター選択`);
    }
};

// グローバル関数（HTMLからの呼び出し用）
window.toggleSidebar = Utils.toggleSidebar;
window.closeSidebarOnOverlay = Utils.closeSidebarOnOverlay;
window.openMobileSearch = Utils.openMobileSearch;
window.closeMobileSearch = Utils.closeMobileSearch;
window.showShopDetail = Utils.showShopDetail;

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // フィルターボタン
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.classList.toggle('active');
            const filterType = this.dataset.filter;
            Utils.handleFilterClick(filterType);
        });
    });

    // 検索入力
    document.getElementById('searchInput')?.addEventListener('input', function(e) {
        // 検索処理
        console.log('検索:', e.target.value);
    });

    // モバイル検索入力
    document.getElementById('mobileSearchInput')?.addEventListener('input', function(e) {
        // モバイル検索処理
        console.log('モバイル検索:', e.target.value);
    });

    // ユーザープロフィールUIの初期化
    Utils.updateUserProfileUI();
});

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', function() {
    // すべてのコンポーネントを初期化
    if (typeof TimelineComponent !== 'undefined' && TimelineComponent.init) {
        TimelineComponent.init();
    }
    
    // ユーザープロフィールUIの初期化
    Utils.updateUserProfileUI();
    
    // 設定を読み込み
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            if (typeof SettingsComponent !== 'undefined') {
                SettingsComponent.state.settings = { ...SettingsComponent.state.settings, ...settings };
            }
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
        }
    }
    
    // デバッグ情報
    console.log('SPAアプリケーションが初期化されました');
    console.log('利用可能なルート:', Object.keys(router.routes));
});