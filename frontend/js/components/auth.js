// 認証コンポーネント
const AuthComponent = {
    // 状態管理
    state: {
        currentView: 'login', // 'login' or 'register'
        isSubmitting: false
    },

    // レンダリング
    render(params = []) {
        const view = params[0] || 'login';
        this.state.currentView = view;
        
        const contentArea = document.getElementById('contentArea');
        
        // CSSの動的読み込み
        Utils.loadCSS('auth');

        // 認証フォームのHTMLを生成
        contentArea.innerHTML = `
            <div class="auth-container">
                <div class="auth-header">
                    <div class="auth-title">${view === 'login' ? 'ログイン' : 'アカウント作成'}</div>
                    <div class="auth-subtitle">
                        ${view === 'login' ? 'アカウントにログインしてください' : '新しいアカウントを作成してください'}
                    </div>
                </div>
                
                <div id="authMessage"></div>
                
                <form class="auth-form" id="authForm" onsubmit="AuthComponent.handleSubmit(event)">
                    <div class="form-group">
                        <label class="form-label">ユーザーID</label>
                        <input type="text" class="form-input" id="id" placeholder="ユーザーIDを入力（英数字のみ）" pattern="[a-zA-Z0-9]+" title="ユーザーIDは英数字のみで入力してください" required>
                    </div>
                    ${view === 'register' ? `
                        <div class="form-group">
                            <label class="form-label">メールアドレス</label>
                            <input type="email" class="form-input" id="email" placeholder="メールアドレスを入力" required>
                        </div>
                    ` : ''}
                    <div class="form-group">
                        <label class="form-label">パスワード</label>
                        <input type="password" class="form-input" id="password" placeholder="パスワードを入力" required>
                    </div>
                    <button type="submit" class="auth-btn" id="authSubmitBtn">
                        ${this.state.isSubmitting ? '処理中...' : (view === 'login' ? 'ログイン' : '登録')}
                    </button>
                </form>
                
                <div class="auth-switch">
                    ${view === 'login' ? 
                        'アカウントをお持ちでないですか？ <span class="auth-link" onclick="AuthComponent.switchView(\'register\')">アカウント作成</span>' :
                        'すでにアカウントをお持ちですか？ <span class="auth-link" onclick="AuthComponent.switchView(\'login\')">ログイン</span>'
                    }
                </div>
            </div>
        `;

        // フォームにフォーカス
        document.getElementById('id')?.focus();
    },

    // フォーム送信処理
    async handleSubmit(event) {
        event.preventDefault();
        
        if (this.state.isSubmitting) return;
        
        const userId = document.getElementById('id').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!userId || !password) {
            this.showMessage('すべての項目を入力してください', 'error');
            return;
        }
        
        this.state.isSubmitting = true;
        document.getElementById('authSubmitBtn').disabled = true;
        
        try {
            let result;
            if (this.state.currentView === 'login') {
                result = await API.login(userId, password);
            } else {
                const email = document.getElementById('email').value.trim();
                if (!email) {
                    this.showMessage('メールアドレスを入力してください', 'error');
                    this.state.isSubmitting = false;
                    document.getElementById('authSubmitBtn').disabled = false;
                    return;
                }
                result = await API.register(userId, email, password);
            }
            
            if (result.success) {
                API.setCookie('authToken', result.token.access_token);
                API.setCookie('user', JSON.stringify(result.token.user));
                this.showMessage(`${this.state.currentView === 'login' ? 'ログイン' : '登録'}が完了しました！`, 'success');
                
                // ユーザープロフィールUIを更新
                Utils.updateUserProfileUI();
                
                // タイムラインにリダイレクト
                setTimeout(() => {
                    router.navigate('timeline');
                }, 1000);
            } else {
                this.showMessage(result.error, 'error');
            }
        } catch (error) {
            console.error(`${this.state.currentView === 'login' ? 'ログイン' : '登録'}に失敗しました:`, error);
            this.showMessage('エラーが発生しました。もう一度お試しください。', 'error');
        } finally {
            this.state.isSubmitting = false;
            document.getElementById('authSubmitBtn').disabled = false;
        }
    },

    // ビュー切り替え
    switchView(view) {
        router.navigate('auth', [view]);
    },

    // メッセージ表示
    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('authMessage');
        if (!messageContainer) return;
        
        messageContainer.innerHTML = `
            <div class="auth-${type}">
                ${message}
            </div>
        `;
        
        // 5秒後にメッセージを非表示
        setTimeout(() => {
            messageContainer.innerHTML = '';
        }, 5000);
    },

    // ログインフォーム表示（グローバル関数）
    showLoginForm() {
        router.navigate('auth', ['login']);
    },

    // 登録フォーム表示（グローバル関数）
    showRegisterForm() {
        router.navigate('auth', ['register']);
    }
};

// コンポーネントをルーターに登録
router.register('auth', AuthComponent);

// グローバル関数を登録
window.showLoginForm = AuthComponent.showLoginForm;
window.showRegisterForm = AuthComponent.showRegisterForm;