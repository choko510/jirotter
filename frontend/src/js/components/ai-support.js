// AIサポートチャットコンポーネント（共通ユーティリティを使用）
const AiSupportComponent = {
    // 定数定義
    CONTAINER_ID: 'ai-chat-messages',
    INPUT_ID: 'ai-chat-input',
    SEND_BTN_ID: 'send-ai-chat',
    API_ENDPOINT: '/api/v1/guide/ask',

    init() {
        // ログイン状態を確認
        const authToken = API.getCookie('authToken');
        const currentUser = API.getCurrentUser();

        // 現在のルートを確認
        const currentRoute = router.currentRoute;

        // ログインしているかつご利用ガイドが表示されている場合のみコンテナを表示
        if (authToken && currentUser && currentRoute === 'guide') {
            // ボタンとモーダルをDOMに追加
            this.renderContainer();
            // イベントリスナーの登録
            this.attachEventListeners();
        }
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
                    <div id="${this.CONTAINER_ID}" class="ai-chat-messages">
                        <!-- メッセージがここに追加されます -->
                    </div>
                </div>
                <div class="ai-chat-input-area">
                    <textarea id="${this.INPUT_ID}" placeholder="質問を入力してください..." rows="1"></textarea>
                    <button id="${this.SEND_BTN_ID}" class="send-chat-btn" disabled>
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
        const input = document.getElementById(this.INPUT_ID);

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

        // 共通ユーティリティを使って入力イベントを設定
        AiChatUtils.setupInputEvents(
            this.INPUT_ID,
            this.SEND_BTN_ID,
            () => this.sendMessage()
        );
    },

    async sendMessage() {
        const input = document.getElementById(this.INPUT_ID);
        const question = input.value.trim();
        if (!question) return;

        // ユーザーの質問を表示（共通ユーティリティを使用）
        AiChatUtils.appendMessage(this.CONTAINER_ID, question, 'user', false, 'guide-msg');

        // 入力をクリア
        AiChatUtils.clearInput(this.INPUT_ID, this.SEND_BTN_ID);

        // ローディング表示
        const loadingId = AiChatUtils.appendLoading(this.CONTAINER_ID, 'guide-loading');

        try {
            const response = await fetch(this.API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': API.getCookie('csrftoken')
                },
                body: JSON.stringify({ question }),
            });

            // ローディング削除
            AiChatUtils.removeMessage(loadingId);

            if (!response.ok) {
                const errorMessage = await AiChatUtils.handleApiError(response);
                AiChatUtils.appendMessage(this.CONTAINER_ID, errorMessage, 'ai', true, 'guide-msg');
                return;
            }

            const data = await response.json();
            AiChatUtils.appendMessage(this.CONTAINER_ID, data.answer, 'ai', false, 'guide-msg');

        } catch (error) {
            console.error('Error:', error);
            AiChatUtils.removeMessage(loadingId);
            AiChatUtils.appendMessage(
                this.CONTAINER_ID,
                '申し訳ありません。通信エラーが発生しました。もう一度お試しください。',
                'ai',
                true,
                'guide-msg'
            );
        }
    }
};
window.AiSupportComponent = AiSupportComponent;

// コンポーネントをグローバルに公開
window.AiSupportComponent = AiSupportComponent;
