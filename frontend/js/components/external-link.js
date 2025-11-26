const ExternalLinkComponent = {
    async render(params = []) {
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

        // ローディング表示
        contentArea.innerHTML = `
            <div class="external-link-page" style="max-width: 640px; margin: 40px auto; padding: 32px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);">
                <div style="text-align: center; margin-bottom: 24px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 36px; color: var(--color-primary);"></i>
                    <h2 style="margin-top: 12px; font-size: 24px;">リンクを確認中...</h2>
                </div>
                <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                    リンクの安全性を確認しています。しばらくお待ちください。
                </p>
                <div style="padding: 16px; border-radius: 12px; background: #f9f5ef; color: #3e2e20; margin-bottom: 24px; word-break: break-all;">
                    ${isValidUrl ? safeUrlText : 'リンクの形式が正しくありません。'}
                </div>
            </div>
        `;

        if (!isValidUrl) {
            this._renderInvalidUrl(contentArea, safeUrlText);
            return;
        }

        // URL安全性チェック
        try {
            const safetyResult = await this._checkUrlSafety(decodedUrl);
            this._renderResult(contentArea, decodedUrl, safeUrlText, safetyResult);
        } catch (error) {
            console.error('URL安全性チェック中にエラーが発生しました:', error);
            this._renderError(contentArea, decodedUrl, safeUrlText);
        }
    },

    async _checkUrlSafety(url) {
        try {
            const response = await API.post('/api/url-safety-check', { url });
            return response;
        } catch (error) {
            console.error('URL安全性チェックAPI呼び出しエラー:', error);
            // APIエラー時は安全とみなして続行
            return { safe: true, reason: 'api_error' };
        }
    },

    _renderResult(contentArea, decodedUrl, safeUrlText, safetyResult) {
        const isSafe = safetyResult.safe;
        const warningColor = '#e74c3c';
        const safeColor = '#27ae60';

        contentArea.innerHTML = `
            <div class="external-link-page" style="max-width: 640px; margin: 40px auto; padding: 32px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);">
                <div style="text-align: center; margin-bottom: 24px;">
                    <i class="fas ${isSafe ? 'fa-check-circle' : 'fa-exclamation-triangle'}"
                       style="font-size: 36px; color: ${isSafe ? safeColor : warningColor};"></i>
                    <h2 style="margin-top: 12px; font-size: 24px; color: ${isSafe ? safeColor : warningColor};">
                        ${isSafe ? '外部サイトに移動します' : '警告: 安全性が確認できません'}
                    </h2>
                </div>
                <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                    ${isSafe ?
                'これから表示されるページは、ラーメンSNSの外部サイトです。<br>安全性を十分に確認のうえ、アクセスしてください。' :
                'このリンクは安全ではない可能性があります。アクセスする場合は十分に注意してください。'
            }
                </p>
                <div style="padding: 16px; border-radius: 12px; background: ${isSafe ? '#f9f5ef' : '#fde8e8'}; color: #3e2e20; margin-bottom: 24px; word-break: break-all; border: 1px solid ${isSafe ? '#d0c2ae' : '#f8d7da'};">
                    ${safeUrlText}
                    ${!isSafe ? `<div style="margin-top: 8px; color: ${warningColor}; font-size: 14px;">⚠️ ${this._getSafetyReasonText(safetyResult.reason)}</div>` : ''}
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
                    <button id="externalLinkBack" style="flex: 1 1 160px; padding: 12px 16px; border-radius: 999px; border: 1px solid var(--color-primary); background: transparent; color: var(--color-primary); font-weight: bold; cursor: pointer;">
                        戻る
                    </button>
                    <button id="externalLinkProceed" style="flex: 1 1 200px; padding: 12px 16px; border-radius: 999px; border: none; background: ${isSafe ? 'var(--color-primary)' : warningColor}; color: white; font-weight: bold; cursor: pointer;">
                        ${isSafe ? '外部サイトへ移動' : '警告を無視して移動'}
                    </button>
                </div>
            </div>
        `;

        this._setupEventListeners(contentArea, decodedUrl);
    },

    _renderInvalidUrl(contentArea, safeUrlText) {
        contentArea.innerHTML = `
            <div class="external-link-page" style="max-width: 640px; margin: 40px auto; padding: 32px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);">
                <div style="text-align: center; margin-bottom: 24px;">
                    <i class="fas fa-exclamation-circle" style="font-size: 36px; color: #e74c3c;"></i>
                    <h2 style="margin-top: 12px; font-size: 24px; color: #e74c3c;">無効なリンク</h2>
                </div>
                <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                    リンクの形式が正しくありません。正しいURLを指定してください。
                </p>
                <div style="padding: 16px; border-radius: 12px; background: #fde8e8; color: #3e2e20; margin-bottom: 24px; word-break: break-all; border: 1px solid #f8d7da;">
                    ${safeUrlText}
                </div>
                <div style="display: flex; justify-content: center;">
                    <button id="externalLinkBack" style="padding: 12px 24px; border-radius: 999px; border: 1px solid var(--color-primary); background: transparent; color: var(--color-primary); font-weight: bold; cursor: pointer;">
                        戻る
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
    },

    _renderError(contentArea, decodedUrl, safeUrlText) {
        // エラー時は安全とみなして表示
        this._renderResult(contentArea, decodedUrl, safeUrlText, { safe: true, reason: 'error' });
    },

    _getSafetyReasonText(reason) {
        const reasonTexts = {
            'matched': 'ブロックリストに登録された危険なサイトです',
            'invalid_url': '無効なURL形式です',
            'clean': '安全なサイトです',
            'api_error': '確認中にエラーが発生しました'
        };
        return reasonTexts[reason] || '安全性が確認できません';
    },

    _setupEventListeners(contentArea, decodedUrl) {
        const backButton = document.getElementById('externalLinkBack');
        if (backButton) {
            backButton.addEventListener('click', () => {
                router.goBack();
            });
        }

        const proceedButton = document.getElementById('externalLinkProceed');
        if (proceedButton) {
            proceedButton.addEventListener('click', () => {
                window.open(decodedUrl, '_blank', 'noopener');
            });
        }
    }
};
