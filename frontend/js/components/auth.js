// 認証コンポーネント
const AuthComponent = {
    // 状態管理
    state: {
        currentView: 'login', // 'login', 'register', or 'email-verification'
        isSubmitting: false,
        pendingLoginData: null, // メールアドレス確認が必要な場合のログインデータを保持
        turnstile: {
            enabled: false,
            siteKey: null,
            widgetId: null,
            token: null,
            configLoaded: false,
            scriptPromise: null
        }
    },

    // レンダリング
    render(params = []) {
        const view = params[0] || 'login';
        this.state.currentView = view;

        const contentArea = document.getElementById('contentArea');

        // メールアドレス確認画面の場合
        if (view === 'email-verification') {
            this.renderEmailVerification();
            return;
        }

        // 認証フォームのHTMLを生成
        contentArea.innerHTML = `
            <style>
                .auth-container {
                    max-width: 400px;
                    margin: 40px auto;
                    padding: 24px;
                    background: var(--glass-bg);
                    backdrop-filter: var(--blur-md);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-md), 0 0 0 1px rgba(255, 255, 255, 0.4) inset;
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

                .turnstile-wrapper {
                    display: none;
                }

                .turnstile-wrapper.active {
                    display: block;
                }

                .turnstile-container {
                    min-height: 70px;
                    display: flex;
                    justify-content: center;
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
                        <input
                            type="text"
                            class="form-input"
                            id="id"
                            placeholder="例: ramen_taro（英数字とアンダースコアのみ）"
                            pattern="[a-zA-Z0-9_]+"
                            title="ユーザーIDは英数字とアンダースコア(_)のみで入力してください"
                            required
                        >
                    </div>
                    ${view === 'register' ? `
                        <div class="form-group">
                            <label class="form-label">メールアドレス</label>
                            <input type="email" class="form-input" id="email" placeholder="メールアドレスを入力" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">ニックネーム</label>
                            <input
                                type="text"
                                class="form-input"
                                id="username"
                                placeholder="プロフィールに表示する名前（任意）"
                                maxlength="40"
                            >
                        </div>
                    ` : ''}
                    <div class="form-group">
                        <label class="form-label">パスワード</label>
                        <input type="password" class="form-input" id="password" placeholder="パスワードを入力" required>
                    </div>
                    <div class="form-group turnstile-wrapper" id="turnstileWrapper">
                        <div id="turnstile-container" class="turnstile-container"></div>
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
        this.setupTurnstileWidget().catch(error => console.error('Turnstile setup failed', error));
    },

    async fetchTurnstileConfig() {
        if (this.state.turnstile.configLoaded) {
            return this.state.turnstile;
        }

        try {
            const config = await API.request('/api/v1/auth/turnstile-config', {
                method: 'GET',
                includeAuth: false,
                credentials: 'same-origin'
            });
            this.state.turnstile.enabled = Boolean(config?.enabled && config?.site_key);
            this.state.turnstile.siteKey = config?.site_key || null;
            this.state.turnstile.configLoaded = true;
        } catch (error) {
            console.error('Failed to fetch Turnstile config', error);
            this.state.turnstile.enabled = false;
            this.state.turnstile.siteKey = null;
        }

        return this.state.turnstile;
    },

    loadTurnstileScript() {
        if (window.turnstile) {
            return Promise.resolve();
        }

        if (this.state.turnstile.scriptPromise) {
            return this.state.turnstile.scriptPromise;
        }

        const promise = new Promise((resolve, reject) => {
            let script = document.getElementById('cf-turnstile-script');
            if (!script) {
                script = document.createElement('script');
                script.id = 'cf-turnstile-script';
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    script.dataset.loaded = 'true';
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load Turnstile script'));
                document.head.appendChild(script);
                return;
            }

            if (script.dataset.loaded === 'true') {
                resolve();
                return;
            }

            const handleLoad = () => {
                script.removeEventListener('load', handleLoad);
                script.removeEventListener('error', handleError);
                script.dataset.loaded = 'true';
                resolve();
            };
            const handleError = () => {
                script.removeEventListener('load', handleLoad);
                script.removeEventListener('error', handleError);
                reject(new Error('Failed to load Turnstile script'));
            };

            script.addEventListener('load', handleLoad);
            script.addEventListener('error', handleError);
        });

        this.state.turnstile.scriptPromise = promise.finally(() => {
            this.state.turnstile.scriptPromise = null;
        });

        return this.state.turnstile.scriptPromise;
    },

    async setupTurnstileWidget() {
        const container = document.getElementById('turnstile-container');
        if (!container || this.state.currentView === 'email-verification') {
            return;
        }

        const wrapper = document.getElementById('turnstileWrapper');
        const configState = await this.fetchTurnstileConfig();
        const shouldEnable = Boolean(configState.enabled && configState.siteKey);

        if (wrapper) {
            wrapper.classList.toggle('active', shouldEnable);
        }

        if (!shouldEnable) {
            this.state.turnstile.widgetId = null;
            this.state.turnstile.token = null;
            return;
        }

        try {
            await this.loadTurnstileScript();
        } catch (error) {
            console.error('Failed to load Turnstile script', error);
            return;
        }

        if (!window.turnstile || typeof window.turnstile.render !== 'function') {
            return;
        }

        this.state.turnstile.token = null;

        if (this.state.turnstile.widgetId !== null) {
            try {
                if (typeof window.turnstile.remove === 'function') {
                    window.turnstile.remove(this.state.turnstile.widgetId);
                } else if (typeof window.turnstile.reset === 'function') {
                    window.turnstile.reset(this.state.turnstile.widgetId);
                }
            } catch (error) {
                console.warn('Failed to reset existing Turnstile widget', error);
            }
            this.state.turnstile.widgetId = null;
        }

        this.state.turnstile.widgetId = window.turnstile.render(container, {
            sitekey: configState.siteKey,
            callback: (token) => {
                this.state.turnstile.token = token;
            },
            'expired-callback': () => {
                this.state.turnstile.token = null;
            },
            'error-callback': () => {
                this.state.turnstile.token = null;
                this.showMessage('セキュリティチェックでエラーが発生しました。再度お試しください。', 'error');
            }
        });
    },

    resetTurnstileWidget() {
        if (!this.state.turnstile.enabled) {
            return;
        }
        this.state.turnstile.token = null;
        if (window.turnstile && this.state.turnstile.widgetId !== null && typeof window.turnstile.reset === 'function') {
            try {
                window.turnstile.reset(this.state.turnstile.widgetId);
            } catch (error) {
                console.warn('Failed to reset Turnstile widget', error);
            }
        }
    },

    // メールアドレス確認画面のレンダリング
    renderEmailVerification() {
        const contentArea = document.getElementById('contentArea');

        contentArea.innerHTML = `
            <style>
                .auth-container {
                    max-width: 400px;
                    margin: 40px auto;
                    padding: 24px;
                    background: var(--glass-bg);
                    backdrop-filter: var(--blur-md);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-md), 0 0 0 1px rgba(255, 255, 255, 0.4) inset;
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
                    line-height: 1.5;
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

                .auth-warning {
                    background: rgba(245, 158, 11, 0.12);
                    color: #d97706;
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
            </style>
            
            <div class="auth-container">
                <div class="auth-header">
                    <div class="auth-title">メールアドレス確認</div>
                    <div class="auth-subtitle">
                        前回のログインと環境が異なります。<br>
                        セキュリティのため、登録しているメールアドレスを入力してください。
                    </div>
                </div>
                
                <div id="authMessage"></div>
                
                <form class="auth-form" id="authForm" onsubmit="AuthComponent.handleEmailVerification(event)">
                    <div class="form-group">
                        <label class="form-label">メールアドレス</label>
                        <input
                            type="email"
                            class="form-input"
                            id="email"
                            placeholder="登録しているメールアドレスを入力"
                            required
                        >
                    </div>
                    <button type="submit" class="auth-btn" id="authSubmitBtn">
                        ${this.state.isSubmitting ? '確認中...' : '確認してログイン'}
                    </button>
                </form>
                
                <div class="auth-switch">
                    <span class="auth-link" onclick="AuthComponent.switchView('login')">ログイン画面に戻る</span>
                </div>
            </div>
        `;

        // メール入力フィールドにフォーカス
        document.getElementById('email')?.focus();
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

        const requiresTurnstile = Boolean(this.state.turnstile.enabled);
        const turnstileToken = this.state.turnstile.token;
        if (requiresTurnstile && !turnstileToken) {
            this.showMessage('セキュリティチェックを完了してください。', 'error');
            return;
        }

        this.state.isSubmitting = true;
        document.getElementById('authSubmitBtn').disabled = true;

        try {
            let result;
            if (this.state.currentView === 'login') {
                result = await API.login(userId, password, turnstileToken);
            } else {
                const email = document.getElementById('email').value.trim();
                if (!email) {
                    this.showMessage('メールアドレスを入力してください', 'error');
                    this.state.isSubmitting = false;
                    document.getElementById('authSubmitBtn').disabled = false;
                    return;
                }

                // 任意ニックネーム（空文字は送信しない）
                const usernameInput = document.getElementById('username');
                const rawUsername = usernameInput ? usernameInput.value.trim() : '';
                const payload = {
                    id: userId,
                    email,
                    password
                };
                // バックエンドのUserCreateは現状usernameを受け取らないため、
                // 将来的に拡張する場合はここでpayload.usernameを追加。
                // if (rawUsername) payload.username = rawUsername;
                if (turnstileToken) {
                    payload.turnstile_token = turnstileToken;
                }

                result = await API.registerWithPayload
                    ? await API.registerWithPayload(payload)
                    : await API.register(userId, email, password, turnstileToken);
            }

            if (result.success) {
                // メールアドレス確認が必要な場合
                if (result.token.requires_email_verification) {
                    this.state.pendingLoginData = { userId, password };
                    this.showMessage(result.token.message, 'warning');
                    setTimeout(() => {
                        router.navigate('auth', ['email-verification']);
                    }, 1000);
                    return;
                }

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
            this.resetTurnstileWidget();
        }
    },

    // メールアドレス確認処理
    async handleEmailVerification(event) {
        event.preventDefault();

        if (this.state.isSubmitting) return;

        const email = document.getElementById('email').value.trim();

        if (!email) {
            this.showMessage('メールアドレスを入力してください', 'error');
            return;
        }

        if (!this.state.pendingLoginData) {
            this.showMessage('ログイン情報が見つかりません。再度ログインしてください。', 'error');
            this.switchView('login');
            return;
        }

        this.state.isSubmitting = true;
        document.getElementById('authSubmitBtn').disabled = true;

        try {
            const result = await API.verifyEmailForLogin(
                this.state.pendingLoginData.userId,
                this.state.pendingLoginData.password,
                email
            );

            if (result.success) {
                API.setCookie('authToken', result.token.access_token);
                API.setCookie('user', JSON.stringify(result.token.user));
                this.showMessage('ログインが完了しました！', 'success');

                // ユーザープロフィールUIを更新
                Utils.updateUserProfileUI();

                // タイムラインにリダイレクト
                setTimeout(() => {
                    router.navigate('timeline');
                }, 1000);
            } else {
                // エラーメッセージを表示
                let errorMessage = result.error;
                if (typeof errorMessage === 'object') {
                    errorMessage = JSON.stringify(errorMessage);
                }
                this.showMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error('メールアドレス確認に失敗しました:', error);
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