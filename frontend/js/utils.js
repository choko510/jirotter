import API from './api.js';
import router from './router.js';
import AuthComponent from './components/auth.js';

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
        // ... (this might need to be moved if it has direct DOM manipulation outside of a component)
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
};

export default Utils;
