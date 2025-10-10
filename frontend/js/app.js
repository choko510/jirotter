import router from './router.js';
import Utils from './utils.js';
import AuthComponent from './components/auth.js';

// グローバル関数（HTMLからの呼び出し用）
// Ideally, these would be handled by event listeners in each component
window.toggleSidebar = Utils.toggleSidebar;
window.closeSidebarOnOverlay = (event) => Utils.closeSidebarOnOverlay(event);
window.openMobileSearch = Utils.openMobileSearch;
window.closeMobileSearch = Utils.closeMobileSearch;
window.logout = Utils.logout;
window.showLoginForm = () => AuthComponent.showLoginForm();


// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    // ルーターの初期化
    router.init();

    // ユーザープロフィールUIの初期化
    Utils.updateUserProfileUI();

    // イベントリスナーの設定
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', (event) => Utils.closeSidebarOnOverlay(event));
    }

    const mobileSearchIcon = document.querySelector('.mobile-search-icon');
    if (mobileSearchIcon) {
        mobileSearchIcon.addEventListener('click', Utils.openMobileSearch);
    }
});
