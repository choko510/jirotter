// ルーティング機能
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.init();
    }

    // ルートを登録
    register(route, component) {
        this.routes[route] = component;
    }

    // 初期化
    init() {
        // ハッシュ変更イベントをリッスン
        window.addEventListener('hashchange', () => {
            this.handleRoute();
        });

        // 初回読み込み時のルート処理
        window.addEventListener('load', () => {
            this.handleRoute();
        });

        // ナビゲーションアイテムのクリックイベント
        document.querySelectorAll('[data-route]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = item.getAttribute('data-route');
                this.navigate(route);
            });
        });

        // 店舗詳細ページへのリンククリックイベント
        document.addEventListener('click', (e) => {
            const shopLink = e.target.closest('.shop-link');
            if (shopLink) {
                e.preventDefault();
                const shopId = shopLink.getAttribute('data-shop-id');
                if (shopId) {
                    this.navigate('shop', [shopId]);
                }
            }
        });
    }

    // ルート処理
    handleRoute() {
        const hash = window.location.hash.slice(1) || 'timeline';
        const [route, ...params] = hash.split('/');
        
        // 以前のCSSをアンロード
        Utils.unloadCSS();

        // ナビゲーションのアクティブ状態を更新
        this.updateActiveNavigation(route);
        
        // main-headerの表示/非表示を制御
        this.toggleMainHeader(route);
        
        // right-sidebarとmain-contentの表示/非表示を制御
        this.toggleSidebarLayout(route);
        
        // コンポーネントをレンダリング
        if (this.routes[route]) {
            this.currentRoute = route;
            this.routes[route].render(params);
        } else {
            // 404ページ
            this.renderNotFound();
        }
    }

    // ナビゲーション
    navigate(route, params = []) {
        const hash = params.length > 0 ? `#${route}/${params.join('/')}` : `#${route}`;
        window.location.hash = hash;
    }

    // アクティブナビゲーションの更新
    updateActiveNavigation(activeRoute) {
        // デスクトップナビゲーション
        document.querySelectorAll('.nav-item').forEach(item => {
            const route = item.getAttribute('data-route');
            if (route === activeRoute) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // モバイルナビゲーション
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            const route = item.getAttribute('data-route');
            if (route === activeRoute) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // main-headerの表示/非表示を制御
    toggleMainHeader(route) {
        const mainHeader = document.querySelector('.main-header');
        if (mainHeader) {
            if (route === 'timeline') {
                mainHeader.style.display = '';
            } else {
                mainHeader.style.display = 'none';
            }
        }
    }

    // right-sidebarとmain-contentの表示/非表示を制御
    toggleSidebarLayout(route) {
        const rightSidebar = document.querySelector('.right-sidebar');
        const mainContent = document.querySelector('.main-content');
        const container = document.querySelector('.container');
        
        if (rightSidebar && mainContent && container) {
            if (route === 'map') {
                // mapページの場合、右サイドバーを非表示にし、main-contentを広げる
                rightSidebar.style.display = 'none';
                mainContent.style.maxWidth = 'none';
                mainContent.style.width = 'calc(100vw - 260px)'; // 左サイドバーの幅を引いた残りすべて
                mainContent.style.borderRight = 'none';
                mainContent.style.flex = '1'; // フレックスアイテムとして伸縮する
                container.style.gridTemplateColumns = '260px 1fr 0px'; // 右サイドバーを0pxに
            } else {
                // その他のページの場合、元のレイアウトに戻す
                rightSidebar.style.display = '';
                mainContent.style.maxWidth = '';
                mainContent.style.width = '';
                mainContent.style.borderRight = '';
                mainContent.style.flex = '';
                container.style.gridTemplateColumns = '';
            }
        }
    }

    // 404ページのレンダリング
    renderNotFound() {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="error">
                <div>
                    <h2>ページが見つかりません</h2>
                    <p>指定されたページは存在しません。</p>
                    <button onclick="router.navigate('timeline')" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">ホームに戻る</button>
                </div>
            </div>
        `;
    }
}

// グローバルルーターインスタンス
const router = new Router();

// DOMが読み込まれた後にコンポーネントを登録
document.addEventListener('DOMContentLoaded', function() {
    // 店舗詳細ページのルートを登録
    router.register('shop', ShopDetailComponent);
});