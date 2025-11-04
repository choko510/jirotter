const ExternalLinkComponent = {
    render(params = []) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) {
            return;
        }

        const [encodedUrl = ''] = params;
        let decodedUrl = '';

        try {
            decodedUrl = decodeURIComponent(encodedUrl);
        } catch (error) {
            console.error('外部リンクのデコードに失敗しました:', error);
        }

        const isValidUrl = /^https?:\/\//i.test(decodedUrl);
        const safeUrlText = API.escapeHtml(decodedUrl);

        contentArea.innerHTML = `
            <div class="external-link-page" style="max-width: 640px; margin: 40px auto; padding: 32px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);">
                <div style="text-align: center; margin-bottom: 24px;">
                    <i class="fas fa-external-link-alt" style="font-size: 36px; color: #d4a574;"></i>
                    <h2 style="margin-top: 12px; font-size: 24px;">外部サイトに移動します</h2>
                </div>
                <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                    これから表示されるページは、ラーメンSNSの外部サイトです。<br>
                    安全性を十分に確認のうえ、アクセスしてください。
                </p>
                <div style="padding: 16px; border-radius: 12px; background: #f9f5ef; color: #3e2e20; margin-bottom: 24px; word-break: break-all;">
                    ${isValidUrl ? safeUrlText : 'リンクの形式が正しくありません。'}
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
                    <button id="externalLinkBack" style="flex: 1 1 160px; padding: 12px 16px; border-radius: 999px; border: 1px solid #d4a574; background: transparent; color: #d4a574; font-weight: bold; cursor: pointer;">
                        戻る
                    </button>
                    <button id="externalLinkProceed" ${isValidUrl ? '' : 'disabled'} style="flex: 1 1 200px; padding: 12px 16px; border-radius: 999px; border: none; background: ${isValidUrl ? '#d4a574' : '#d0c2ae'}; color: ${isValidUrl ? '#1a1a1a' : '#666'}; font-weight: bold; cursor: ${isValidUrl ? 'pointer' : 'not-allowed'};">
                        外部サイトへ移動
                    </button>
                </div>
            </div>
        `;

        const backButton = document.getElementById('externalLinkBack');
        if (backButton) {
            backButton.addEventListener('click', () => {
                router.goBack();
            });
        }

        const proceedButton = document.getElementById('externalLinkProceed');
        if (proceedButton && isValidUrl) {
            proceedButton.addEventListener('click', () => {
                window.open(decodedUrl, '_blank', 'noopener');
            });
        }
    }
};
