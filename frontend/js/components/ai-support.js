// AIサポートチャットコンポーネント
const AiSupportComponent = {
    init() {
        // ボタンとモーダルをDOMに追加
        this.renderContainer();

        // イベントリスナーの登録
        this.attachEventListeners();
    },

    renderContainer() {
        const container = document.createElement('div');
        container.id = 'ai-support-container';
        container.innerHTML = `
            <div id="ai-chat-modal" class="ai-chat-modal" style="display: none;">
                <div class="ai-chat-header">
                    <div class="ai-chat-title">
                        <i class="fas fa-robot"></i> AI Q&A
                    </div>
                    <button id="close-ai-chat" class="close-chat-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="ai-chat-body">
                    <div class="ai-chat-welcome">
                        <p>二郎ラーメンに関する質問にAIがお答えします。<br>
                        ルールやマナー、専門用語など、お気軽にどうぞ！</p>
                    </div>
                    <div id="ai-chat-messages" class="ai-chat-messages">
                        <!-- メッセージがここに追加されます -->
                    </div>
                </div>
                <div class="ai-chat-input-area">
                    <textarea id="ai-chat-input" placeholder="質問を入力してください..." rows="1"></textarea>
                    <button id="send-ai-chat" class="send-chat-btn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
            <button id="ai-support-btn" class="ai-support-btn">
                <i class="fas fa-comment-dots"></i>
            </button>
        `;
        document.body.appendChild(container);
    },

    attachEventListeners() {
        const supportBtn = document.getElementById('ai-support-btn');
        const chatModal = document.getElementById('ai-chat-modal');
        const closeBtn = document.getElementById('close-ai-chat');
        const sendBtn = document.getElementById('send-ai-chat');
        const input = document.getElementById('ai-chat-input');
        const messagesContainer = document.getElementById('ai-chat-messages');

        // チャットを開閉する
        const toggleChat = () => {
            const isVisible = chatModal.style.display === 'flex';
            chatModal.style.display = isVisible ? 'none' : 'flex';
            if (!isVisible) {
                setTimeout(() => input.focus(), 100);
            }
        };

        supportBtn.addEventListener('click', toggleChat);
        closeBtn.addEventListener('click', toggleChat);

        // 入力内容に応じて送信ボタンを有効化
        input.addEventListener('input', () => {
            sendBtn.disabled = !input.value.trim();

            // 自動リサイズ
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });

        // メッセージ送信処理
        const sendMessage = async () => {
            const question = input.value.trim();
            if (!question) return;

            // ユーザーの質問を表示
            this.appendMessage(question, 'user');

            // 入力をクリア
            input.value = '';
            input.style.height = 'auto';
            sendBtn.disabled = true;

            // ローディング表示
            const loadingId = this.appendLoading();

            try {
                const response = await fetch('/api/v1/guide/ask', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ question }),
                });

                // ローディング削除
                this.removeMessage(loadingId);

                if (!response.ok) {
                    let errorMessage = 'エラーが発生しました。';

                    // ステータスコードに応じたエラーメッセージ
                    if (response.status === 401) {
                        errorMessage = '質問するにはログインが必要です。';
                        // ログインページへの誘導などの処理を追加可能
                    } else if (response.status === 403) {
                         const errorData = await response.json();
                         errorMessage = errorData.detail || '利用が制限されています。';
                    } else if (response.status === 429) {
                        errorMessage = '質問の回数が多すぎます。しばらく待ってから再度お試しください。';
                    } else if (response.status === 400) {
                        const errorData = await response.json();
                        errorMessage = errorData.detail || '質問内容が不適切か、空です。';
                    }

                    this.appendMessage(errorMessage, 'ai', true);
                    return;
                }

                const data = await response.json();
                this.appendMessage(data.answer, 'ai');

            } catch (error) {
                console.error('Error:', error);
                this.removeMessage(loadingId);
                this.appendMessage('申し訳ありません。通信エラーが発生しました。もう一度お試しください。', 'ai', true);
            }
        };

        sendBtn.addEventListener('click', sendMessage);

        // Enterキーで送信（Shift+Enterで改行）
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtn.disabled) {
                    sendMessage();
                }
            }
        });
    },

    appendMessage(text, sender, isError = false) {
        const messagesContainer = document.getElementById('ai-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message ${isError ? 'error-message' : ''}`;

        // テキスト内のURLをリンクに変換（簡易的）
        // 改行を<br>に変換
        const formattedText = this.escapeHtml(text).replace(/\n/g, '<br>');

        messageDiv.innerHTML = `
            <div class="message-content">
                ${formattedText}
            </div>
            <div class="message-time">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        return messageDiv.id = 'msg-' + Date.now();
    },

    appendLoading() {
        const messagesContainer = document.getElementById('ai-chat-messages');
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message ai-message loading-message';
        loadingDiv.id = 'loading-' + Date.now();
        loadingDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(loadingDiv);
        this.scrollToBottom();
        return loadingDiv.id;
    },

    removeMessage(id) {
        const element = document.getElementById(id);
        if (element) {
            element.remove();
        }
    },

    scrollToBottom() {
        const messagesContainer = document.getElementById('ai-chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

// コンポーネントをグローバルに公開
window.AiSupportComponent = AiSupportComponent;
