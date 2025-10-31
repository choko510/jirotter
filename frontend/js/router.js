// ルーティング機能
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.previousRoute = null; // 前のルートを保持
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
        // 現在のルートを保存
        this.previousRoute = this.currentRoute;
        
        const hash = params.length > 0 ? `#${route}/${params.join('/')}` : `#${route}`;
        window.location.hash = hash;
    }
    
    // 前のページに戻る
    goBack() {
        if (this.previousRoute) {
            this.navigate(this.previousRoute);
        } else {
            // 前のルートがない場合はホームに戻る
            this.navigate('timeline');
        }
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

        const profileNavItem = document.getElementById('bottomNavProfile');
        if (profileNavItem) {
            if (activeRoute === 'profile') {
                profileNavItem.classList.add('active');
            } else {
                profileNavItem.classList.remove('active');
            }
        }
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

        if (!rightSidebar || !mainContent || !container) return;

        // 画面幅に応じてレイアウトを動的に変更
        const isDesktop = window.innerWidth > 768;

        if (isDesktop) {
            if (route === 'map') {
                // デスクトップでMapページの場合: 右サイドバーを非表示
                rightSidebar.style.display = 'none';
                mainContent.style.maxWidth = 'none';
                mainContent.style.borderRight = 'none';
                container.style.gridTemplateColumns = '260px 1fr 0px';
            } else {
                // デスクトップでその他のページの場合: 通常の3カラムレイアウト
                rightSidebar.style.display = '';
                mainContent.style.maxWidth = '';
                mainContent.style.borderRight = '';
                container.style.gridTemplateColumns = '';
            }
        } else {
            // モバイルの場合: すべてのインラインスタイルを解除し、CSSメディアクエリに任せる
            rightSidebar.style.display = '';
            mainContent.style.maxWidth = '';
            mainContent.style.borderRight = '';
            container.style.gridTemplateColumns = '';
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
    
    // スタンプラリーページのルートを登録
    if (typeof StampRallyComponent !== 'undefined') {
        router.register('stamp-rally', StampRallyComponent);
    }

    // ランキングページのルートを登録
    if (typeof RankingsComponent !== 'undefined') {
        router.register('rankings', RankingsComponent);
    }

    // プロフィールページのルートを登録（新しいバージョン）
    if (typeof ProfileComponent !== 'undefined') {
        router.register('profile', ProfileComponent);
    }
});