// AIチャット共通ユーティリティ
const AiChatUtils = {
    // HTMLエスケープ処理
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // チャットメッセージを追加
    appendMessage(containerId, text, sender, isError = false, idPrefix = 'ai-msg') {
        const messagesContainer = document.getElementById(containerId);
        if (!messagesContainer) return null;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message ${isError ? 'error-message' : ''}`;

        const formattedText = this.escapeHtml(text).replace(/\n/g, '<br>');

        messageDiv.innerHTML = `
            <div class="message-content">${formattedText}</div>
            <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom(containerId);

        const msgId = `${idPrefix}-${Date.now()}`;
        messageDiv.id = msgId;
        return msgId;
    },

    // ローディングメッセージを追加
    appendLoading(containerId, idPrefix = 'ai-loading') {
        const messagesContainer = document.getElementById(containerId);
        if (!messagesContainer) return null;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message ai-message loading-message';
        const loadingId = `${idPrefix}-${Date.now()}`;
        loadingDiv.id = loadingId;
        loadingDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;

        messagesContainer.appendChild(loadingDiv);
        this.scrollToBottom(containerId);

        return loadingId;
    },

    // メッセージを削除
    removeMessage(id) {
        const element = document.getElementById(id);
        if (element) {
            element.remove();
        }
    },

    // スクロールを最下部に
    scrollToBottom(containerId) {
        const messagesContainer = document.getElementById(containerId);
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    },

    // 入力エリアのイベント設定
    setupInputEvents(inputId, sendBtnId, onSend) {
        const input = document.getElementById(inputId);
        const sendBtn = document.getElementById(sendBtnId);

        if (!input || !sendBtn) return;

        // 入力内容に応じて送信ボタンを有効化
        input.addEventListener('input', () => {
            sendBtn.disabled = !input.value.trim();
            // 自動リサイズ
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });

        // 送信ボタン
        sendBtn.addEventListener('click', onSend);

        // Enterキーで送信（Shift+Enterで改行）
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtn.disabled) {
                    onSend();
                }
            }
        });
    },

    // APIからのエラーレスポンスをハンドリング
    async handleApiError(response) {
        if (response.status === 401) {
            return '質問するにはログインが必要です。';
        } else if (response.status === 403) {
            const errorData = await response.json();
            return errorData.detail || '利用が制限されています。';
        } else if (response.status === 429) {
            return '質問の回数が多すぎます。しばらく待ってから再度お試しください。';
        } else if (response.status === 400) {
            const errorData = await response.json();
            return errorData.detail || '質問内容が不適切か、空です。';
        }
        return 'エラーが発生しました。';
    },

    // 入力をクリア
    clearInput(inputId, sendBtnId) {
        const input = document.getElementById(inputId);
        const sendBtn = document.getElementById(sendBtnId);

        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
        if (sendBtn) {
            sendBtn.disabled = true;
        }
    }
};

// グローバルに公開
window.AiChatUtils = AiChatUtils;
