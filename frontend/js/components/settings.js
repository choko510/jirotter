// 設定コンポーネント
const SettingsComponent = {
    // 状態管理
    state: {
        user: null,
        settings: {
            notifications: true,
            theme: 'system', // 'light', 'dark', 'system'
            locationSharing: true,
            autoRefresh: true
        }
    },

    // 認証状態をチェック
    isAuthenticated() {
        const authToken = API.getCookie('authToken');
        const userCookie = API.getCookie('user');
        return !!(authToken && userCookie);
    },

    // 設定の読み込み
    loadSettings() {
        try {
            const savedSettings = JSON.parse(localStorage.getItem('appSettings'));
            if (savedSettings) {
                // 保存された設定を現在の状態にマージ
                Object.assign(this.state.settings, savedSettings);
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    },

    // レンダリング
    render(params = []) {
        this.loadSettings(); // レンダリング前に設定を読み込む
        const contentArea = document.getElementById('contentArea');
        const isLoggedIn = this.isAuthenticated();
        
        // ユーザー情報の取得
        let userName = 'ユーザー名';
        let userHandle = '@username';
        
        if (isLoggedIn) {
            try {
                const userCookie = API.getCookie('user');
                if (userCookie) {
                    const user = JSON.parse(decodeURIComponent(userCookie));
                    userName = user.username || userName;
                    userHandle = `@${user.id}` || userHandle;
                }
            } catch (e) {
                console.error("Failed to parse user cookie", e);
            }
        }
        
        contentArea.innerHTML = `
            <style>
                .settings-container {
                    padding: 20px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                .settings-header {
                    margin-bottom: 24px;
                }
                
                .settings-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .settings-subtitle {
                    color: #666;
                    font-size: 14px;
                }
                
                .settings-section {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    margin-bottom: 20px;
                    overflow: hidden;
                }
                
                .settings-section-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    font-weight: bold;
                    background: #f9f9f9;
                }
                
                .settings-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .settings-item:last-child {
                    border-bottom: none;
                }
                
                .settings-item:hover {
                    background: #f9f9f9;
                }
                
                .settings-item-left {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .settings-item-title {
                    font-weight: 500;
                }
                
                .settings-item-desc {
                    font-size: 14px;
                    color: #666;
                }
                
                .settings-item-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .toggle-switch {
                    position: relative;
                    width: 48px;
                    height: 24px;
                    background: #ccc;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .toggle-switch.active {
                    background: var(--color-primary);
                }
                
                .toggle-switch::after {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 20px;
                    height: 20px;
                    background: white;
                    border-radius: 50%;
                    transition: transform 0.2s;
                }
                
                .toggle-switch.active::after {
                    transform: translateX(24px);
                }
                
                .settings-value {
                    color: #666;
                    font-size: 14px;
                }
                
                .settings-arrow {
                    color: #666;
                    font-size: 16px;
                }
                
                .profile-section {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px;
                }
                
                .profile-avatar {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background: var(--color-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    color: white;
                }
                
                .profile-info {
                    flex: 1;
                }
                
                .profile-name {
                    font-weight: bold;
                    font-size: 18px;
                    margin-bottom: 4px;
                }
                
                .profile-handle {
                    color: #666;
                    font-size: 14px;
                }
                
                .profile-edit {
                    background: transparent;
                    border: 1px solid var(--color-primary);
                    color: var(--color-primary);
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                
                .profile-edit:hover {
                    background: rgba(212, 165, 116, 0.1);
                }
                
                .danger-zone {
                    margin-top: 32px;
                }
                
                .danger-item {
                    border-color: #ffebee;
                }
                
                .danger-item:hover {
                    background: #ffebee;
                }
                
                .danger-button {
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s;
                }
                
                .danger-button:hover {
                    background: #d32f2f;
                }
                
                .login-prompt {
                    background: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    padding: 24px;
                    text-align: center;
                    margin-bottom: 20px;
                }
                
                .login-prompt-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .login-prompt-desc {
                    color: #666;
                    margin-bottom: 16px;
                }
                
                .login-button {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: background 0.2s;
                }
                
                .login-button:hover {
                    background: #c49564;
                }
                
                .disabled-section {
                    opacity: 0.6;
                    pointer-events: none;
                }
                
                @media (max-width: 768px) {
                    .settings-container {
                        padding: 16px;
                    }
                    
                    .settings-item {
                        padding: 12px 16px;
                    }
                    
                    .profile-section {
                        padding: 16px;
                        flex-direction: column;
                        text-align: center;
                    }
                }

                /* Dark Mode Overrides */
                .dark-mode .settings-subtitle,
                .dark-mode .settings-item-desc,
                .dark-mode .settings-value,
                .dark-mode .settings-arrow,
                .dark-mode .profile-handle {
                    color: #aaa;
                }
                .dark-mode .settings-section {
                    background: #2a2a2a;
                    border-color: #333;
                }
                .dark-mode .settings-section-header {
                    background: #1a1a1a;
                    border-bottom-color: #333;
                }
                .dark-mode .settings-item {
                    border-bottom-color: #333;
                }
                .dark-mode .settings-item:hover {
                    background: #333;
                }
                .dark-mode .toggle-switch {
                    background: #555;
                }
                .dark-mode .login-prompt {
                    background: #2a2a2a;
                    border-color: #333;
                }
                .dark-mode .login-prompt-desc {
                    color: #aaa;
                }
                .dark-mode .danger-item {
                    border-color: #5c1f1f;
                }

                .dark-mode .danger-item:hover {
                    background: #5c1f1f;
                }
            </style>
            
            <div class="settings-container">
                <div class="settings-header">
                    <h1 class="settings-title">設定</h1>
                    <p class="settings-subtitle">アカウントとアプリの設定を管理</p>
                </div>
                
                ${!isLoggedIn ? `
                    <div class="login-prompt">
                        <div class="login-prompt-title">ログインが必要です</div>
                        <div class="login-prompt-desc">アカウント設定を利用するにはログインしてください</div>
                        <button class="login-button" onclick="AuthComponent.showLoginForm()">ログイン</button>
                    </div>
                ` : ''}
                
                <div class="settings-section ${!isLoggedIn ? 'disabled-section' : ''}">
                    <div class="profile-section">
                        <div class="profile-avatar"><i class="fas fa-user"></i></div>
                        <div class="profile-info">
                            <div class="profile-name">${userName}</div>
                            <div class="profile-handle">${userHandle}</div>
                        </div>
                        <button class="profile-edit" onclick="SettingsComponent.editProfile()" ${!isLoggedIn ? 'disabled' : ''}>プロフィール編集</button>
                    </div>
                </div>
                
                <div class="settings-section ${!isLoggedIn ? 'disabled-section' : ''}">
                    <div class="settings-section-header">通知設定</div>
                    <div class="settings-item" onclick="${isLoggedIn ? 'SettingsComponent.toggleSetting(\'notifications\')' : ''}">
                        <div class="settings-item-left">
                            <div class="settings-item-title">プッシュ通知</div>
                            <div class="settings-item-desc">新しい投稿やコメントを通知</div>
                        </div>
                        <div class="settings-item-right">
                            <div class="toggle-switch ${this.state.settings.notifications ? 'active' : ''}" id="notifications-toggle"></div>
                        </div>
                    </div>
                    <div class="settings-item" onclick="${isLoggedIn ? 'SettingsComponent.toggleSetting(\'autoRefresh\')' : ''}">
                        <div class="settings-item-left">
                            <div class="settings-item-title">自動更新</div>
                            <div class="settings-item-desc">タイムラインを自動で更新</div>
                        </div>
                        <div class="settings-item-right">
                            <div class="toggle-switch ${this.state.settings.autoRefresh ? 'active' : ''}" id="autoRefresh-toggle"></div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section ${!isLoggedIn ? 'disabled-section' : ''}">
                    <div class="settings-section-header">プライバシー</div>
                    <div class="settings-item" onclick="${isLoggedIn ? 'SettingsComponent.toggleSetting(\'locationSharing\')' : ''}">
                        <div class="settings-item-left">
                            <div class="settings-item-title">位置情報共有</div>
                            <div class="settings-item-desc">現在地を投稿に含める</div>
                        </div>
                        <div class="settings-item-right">
                            <div class="toggle-switch ${this.state.settings.locationSharing ? 'active' : ''}" id="locationSharing-toggle"></div>
                        </div>
                    </div>
                    <div class="settings-item" onclick="${isLoggedIn ? 'SettingsComponent.showBlockedUsers()' : ''}">
                        <div class="settings-item-left">
                            <div class="settings-item-title">ブロックしたユーザー</div>
                            <div class="settings-item-desc">ブロック中のユーザーを管理</div>
                        </div>
                        <div class="settings-item-right">
                            <span class="settings-value">0人</span>
                            <span class="settings-arrow">›</span>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <div class="settings-section-header">表示設定</div>
                    <div class="settings-item">
                        <div class="settings-item-left">
                            <div class="settings-item-title">テーマ設定</div>
                            <div class="settings-item-desc">アプリの表示テーマを選択</div>
                        </div>
                        <div class="settings-item-right" style="gap: 12px;">
                            <label><input type="radio" name="theme" value="light" ${this.state.settings.theme === 'light' ? 'checked' : ''} onclick="SettingsComponent.setTheme('light')"> ライト</label>
                            <label><input type="radio" name="theme" value="dark" ${this.state.settings.theme === 'dark' ? 'checked' : ''} onclick="SettingsComponent.setTheme('dark')"> ダーク</label>
                            <label><input type="radio" name="theme" value="system" ${this.state.settings.theme === 'system' ? 'checked' : ''} onclick="SettingsComponent.setTheme('system')"> システム</label>
                        </div>
                    </div>
                    <div class="settings-item" onclick="SettingsComponent.showLanguageSettings()">
                        <div class="settings-item-left">
                            <div class="settings-item-title">言語</div>
                            <div class="settings-item-desc">アプリの表示言語</div>
                        </div>
                        <div class="settings-item-right">
                            <span class="settings-value">日本語</span>
                            <span class="settings-arrow">›</span>
                        </div>
                    </div>
                </div>
                
                ${isLoggedIn ? `
                    <div class="danger-zone">
                        <div class="settings-section">
                            <div class="settings-section-header">危険な操作</div>
                            <div class="settings-item danger-item" onclick="SettingsComponent.confirmLogout()">
                                <div class="settings-item-left">
                                    <div class="settings-item-title">ログアウト</div>
                                    <div class="settings-item-desc">現在のアカウントからログアウト</div>
                                </div>
                                <div class="settings-item-right">
                                    <button class="danger-button">ログアウト</button>
                                </div>
                            </div>
                            <div class="settings-item danger-item" onclick="SettingsComponent.confirmDeleteAccount()">
                                <div class="settings-item-left">
                                    <div class="settings-item-title">アカウント削除</div>
                                    <div class="settings-item-desc">アカウントとすべてのデータを削除</div>
                                </div>
                                <div class="settings-item-right">
                                    <button class="danger-button">削除</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // 設定の切り替え
    toggleSetting(settingName) {
        if (!this.isAuthenticated()) {
            return;
        }
        this.state.settings[settingName] = !this.state.settings[settingName];
        const toggleElement = document.getElementById(`${settingName}-toggle`);
        if (toggleElement) {
            toggleElement.classList.toggle('active');
        }
        this.saveSettings();
        
        // 自動更新設定が変更された場合は、タイムラインコンポーネントに通知
        if (settingName === 'autoRefresh' && window.TimelineComponent) {
            window.TimelineComponent.setupAutoRefresh();
        }
    },

    // テーマ設定
    setTheme(theme) {
        this.state.settings.theme = theme;
        this.saveSettings();
        if (window.Theme) {
            window.Theme.apply();
        }
    },

    // 設定の保存
    saveSettings() {
        localStorage.setItem('appSettings', JSON.stringify(this.state.settings));
    },

    goToUserProfile(userId) {
        router.navigate('profile', [userId]);
    },

    // プロフィール編集
    editProfile() {
        if (!this.isAuthenticated()) {
            return;
        }
        const currentUser = API.getCurrentUser();
        this.goToUserProfile(currentUser.id);
    },

    // ブロックしたユーザー表示
    showBlockedUsers() {
        if (!this.isAuthenticated()) {
            return;
        }
        alert('ブロックしたユーザーはいません');
    },

    // 言語設定
    showLanguageSettings() {
        alert('言語設定機能は現在開発中です');
    },

    // ログアウト確認
    confirmLogout() {
        if (!this.isAuthenticated()) {
            return;
        }
        if (confirm('本当にログアウトしますか？')) {
            Utils.logout();
        }
    },

    // アカウント削除確認
    confirmDeleteAccount() {
        if (!this.isAuthenticated()) {
            return;
        }
        
        // カスタム確認ダイアログを表示
        this.showDeleteAccountDialog();
    },

    // アカウント削除ダイアログ表示
    showDeleteAccountDialog() {
        const contentArea = document.getElementById('contentArea');
        
        // ダイアログのHTMLを作成
        const dialogHtml = `
            <div class="delete-account-dialog-overlay" id="deleteAccountDialog">
                <div class="delete-account-dialog">
                    <div class="dialog-header">
                        <h3>アカウント削除の確認</h3>
                        <button class="close-button" onclick="SettingsComponent.closeDeleteAccountDialog()">×</button>
                    </div>
                    <div class="dialog-content">
                        <div class="warning-icon">⚠️</div>
                        <p class="warning-text">アカウントを削除すると、以下のデータが完全に削除され、復元できなくなります。</p>
                        <ul class="warning-list">
                            <li>プロフィール情報</li>
                            <li>投稿したすべての内容</li>
                            <li>いいねと返信</li>
                            <li>フォロー関係</li>
                        </ul>
                        <p class="final-warning">この操作は元に戻せません。</p>
                        <div class="confirmation-input">
                            <label for="deleteConfirmation">「削除します」と入力して確認：</label>
                            <input type="text" id="deleteConfirmation" placeholder="削除します">
                        </div>
                    </div>
                    <div class="dialog-actions">
                        <button class="cancel-button" onclick="SettingsComponent.closeDeleteAccountDialog()">キャンセル</button>
                        <button class="delete-button" id="confirmDeleteButton" disabled onclick="SettingsComponent.executeDeleteAccount()">アカウントを削除</button>
                    </div>
                </div>
            </div>
            <style>
                .delete-account-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                
                .delete-account-dialog {
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                }
                
                .dialog-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .dialog-header h3 {
                    margin: 0;
                    color: #333;
                }
                
                .close-button {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                }
                
                .dialog-content {
                    padding: 20px;
                }
                
                .warning-icon {
                    font-size: 48px;
                    text-align: center;
                    margin-bottom: 16px;
                }
                
                .warning-text {
                    margin-bottom: 16px;
                    line-height: 1.5;
                }
                
                .warning-list {
                    margin: 16px 0;
                    padding-left: 20px;
                }
                
                .warning-list li {
                    margin-bottom: 8px;
                }
                
                .final-warning {
                    font-weight: bold;
                    color: #d32f2f;
                    margin: 16px 0;
                }
                
                .confirmation-input {
                    margin: 20px 0;
                }
                
                .confirmation-input label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                }
                
                .confirmation-input input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    font-size: 16px;
                }
                
                .dialog-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 20px;
                    border-top: 1px solid #e0e0e0;
                }
                
                .cancel-button {
                    background: #f5f5f5;
                    color: #333;
                    border: 1px solid #e0e0e0;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .delete-button {
                    background: #d32f2f;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .delete-button:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }
                
                /* ダークモード対応 */
                .dark-mode .delete-account-dialog {
                    background: #2a2a2a;
                    color: #fff;
                }
                
                .dark-mode .dialog-header {
                    border-bottom-color: #333;
                }
                
                .dark-mode .dialog-header h3 {
                    color: #fff;
                }
                
                .dark-mode .close-button {
                    color: #aaa;
                }
                
                .dark-mode .confirmation-input input {
                    background: #333;
                    border-color: #444;
                    color: #fff;
                }
                
                .dark-mode .dialog-actions {
                    border-top-color: #333;
                }
                
                .dark-mode .cancel-button {
                    background: #333;
                    color: #fff;
                    border-color: #444;
                }
            </style>
        `;
        
        // ダイアログを追加
        const dialogContainer = document.createElement('div');
        dialogContainer.innerHTML = dialogHtml;
        contentArea.appendChild(dialogContainer.firstElementChild);
        
        // 入力フィールドのイベントリスナーを設定
        const confirmationInput = document.getElementById('deleteConfirmation');
        const confirmButton = document.getElementById('confirmDeleteButton');
        
        confirmationInput.addEventListener('input', function() {
            confirmButton.disabled = this.value !== '削除します';
        });
    },

    // アカウント削除ダイアログを閉じる
    closeDeleteAccountDialog() {
        const dialog = document.getElementById('deleteAccountDialog');
        if (dialog) {
            dialog.remove();
        }
    },

    // アカウント削除実行
    async executeDeleteAccount() {
        if (!this.isAuthenticated()) {
            return;
        }
        
        try {
            // ローディング表示
            const confirmButton = document.getElementById('confirmDeleteButton');
            const originalText = confirmButton.textContent;
            confirmButton.textContent = '削除中...';
            confirmButton.disabled = true;
            
            // API呼び出し
            const result = await API.deleteAccount();
            
            if (result.success) {
                // 成功した場合
                this.closeDeleteAccountDialog();
                Utils.showNotification('アカウントが正常に削除されました', 'success');
                
                // ログアウト処理
                setTimeout(() => {
                    Utils.logout();
                }, 2000);
            } else {
                // 失敗した場合
                Utils.showNotification(`アカウント削除に失敗しました: ${result.error}`, 'error');
                confirmButton.textContent = originalText;
                confirmButton.disabled = false;
            }
        } catch (error) {
            console.error('アカウント削除エラー:', error);
            Utils.showNotification('アカウント削除中にエラーが発生しました', 'error');
            
            const confirmButton = document.getElementById('confirmDeleteButton');
            if (confirmButton) {
                confirmButton.textContent = 'アカウントを削除';
                confirmButton.disabled = false;
            }
        }
    }
};

// コンポーネントをルーターに登録
router.register('settings', SettingsComponent);

// HTMLから呼び出せるようにグローバルに公開
window.SettingsComponent = SettingsComponent;