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
        
        // 認証フォームのHTMLを生成
        contentArea.innerHTML = `
            <style>
                .auth-container {
                    max-width: 400px;
                    margin: 40px auto;
                    padding: 24px;
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid rgba(231, 220, 205, 0.7);
                }

                .auth-header {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .auth-title {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--color-text);
                    margin-bottom: 8px;
                }

                .auth-subtitle {
                    color: var(--color-muted);
                    font-size: 14px;
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .form-label {
                    font-weight: 500;
                    color: var(--color-text);
                }

                .form-input {
                    padding: 12px 16px;
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    font-size: 16px;
                    outline: none;
                    transition: border-color 0.2s;
                }

                .form-input:focus {
                    border-color: var(--color-primary);
                }

                .form-input::placeholder {
                    color: rgba(47, 37, 25, 0.45);
                }

                .auth-btn {
                    background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
                    color: #fff;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 999px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    box-shadow: var(--shadow-xs);
                }

                .auth-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-sm);
                }

                .auth-btn:disabled {
                    background: rgba(120, 108, 95, 0.25);
                    color: rgba(120, 108, 95, 0.7);
                    cursor: not-allowed;
                    box-shadow: none;
                    transform: none;
                }

                .auth-switch {
                    text-align: center;
                    margin-top: 20px;
                    color: var(--color-muted);
                }

                .auth-link {
                    color: var(--color-primary);
                    text-decoration: none;
                    font-weight: 500;
                    cursor: pointer;
                    transition: color 0.2s ease;
                }

                .auth-link:hover {
                    color: var(--color-primary-hover);
                }

                .auth-error {
                    background: rgba(209, 106, 95, 0.12);
                    color: var(--color-danger);
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    font-size: 14px;
                }

                .auth-success {
                    background: rgba(111, 193, 118, 0.14);
                    color: #2e7d32;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    font-size: 14px;
                }

                @media (max-width: 768px) {
                    .auth-container {
                        margin: 20px;
                        padding: 20px;
                    }
                }

                /* Dark Mode Overrides */
                .dark-mode .auth-container {
                    background: #2a2a2a;
                    box-shadow: none;
                    border-color: #3a3126;
                }
                .dark-mode .auth-title,
                .dark-mode .form-label {
                    color: #f5f0e9;
                }
                .dark-mode .auth-subtitle,
                .dark-mode .auth-switch {
                    color: rgba(255, 255, 255, 0.65);
                }
                .dark-mode .form-input {
                    background: #1a1a1a;
                    border-color: #333;
                    color: #e0e0e0;
                }
                .dark-mode .form-input:focus {
                    border-color: var(--color-primary);
                }
                .dark-mode .form-input::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }
            </style>
            
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
                        <input type="text" class="form-input" id="id" placeholder="ユーザーIDを入力（英数字とアンダースコアのみ）" pattern="[a-zA-Z0-9_]+" title="ユーザーIDは英数字とアンダースコア(_)のみで入力してください" required>
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
                // エラーメッセージを表示（文字列以外の場合は文字列に変換）
                let errorMessage = result.error;
                if (typeof errorMessage === 'object') {
                    errorMessage = JSON.stringify(errorMessage);
                }
                this.showMessage(errorMessage, 'error');
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