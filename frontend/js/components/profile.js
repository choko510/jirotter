// プロフィールコンポーネント
const ProfileComponent = {
    state: {
        user: null,
        posts: [],
        isLoading: true,
        error: null,
        selectedIconFile: null
    },

    async render(params = []) {
        const userId = params[0];
        if (!userId) {
            document.getElementById('contentArea').innerHTML = `<div class="error">ユーザーが指定されていません。</div>`;
            return;
        }

        this.state.isLoading = true;
        this.state.error = null;
        this.fetchProfileData(userId);

        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <style>
                .profile-page {
                    padding: 24px;
                    max-width: 960px;
                    margin: 0 auto;
                }

                .profile-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 24px;
                    margin-bottom: 28px;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 18px;
                    padding: 24px;
                    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
                }

                .profile-avatar {
                    width: 96px;
                    height: 96px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 3px solid #ffffff;
                    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
                    background: #f3f4f6;
                    flex-shrink: 0;
                }

                .profile-info {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    flex: 1;
                }

                .profile-rank-card {
                    border-radius: 18px;
                    border: 1px solid #e5e7eb;
                    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
                    padding: 18px 20px;
                    box-shadow: 0 18px 32px rgba(15, 23, 42, 0.1);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .rank-card-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .rank-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 14px;
                    border-radius: 999px;
                    color: #ffffff;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    font-size: 12px;
                    text-transform: uppercase;
                    box-shadow: 0 12px 22px rgba(15, 23, 42, 0.16);
                }

                .rank-points {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1f2933;
                }

                .rank-description {
                    margin: 0;
                    color: #4b5563;
                    font-size: 14px;
                    line-height: 1.6;
                }

                .rank-progress-bar {
                    position: relative;
                    width: 100%;
                    height: 10px;
                    background: #e5e7eb;
                    border-radius: 999px;
                    overflow: hidden;
                }

                .rank-progress-bar-fill {
                    height: 100%;
                    border-radius: 999px;
                    transition: width 0.3s ease;
                }

                .rank-progress-label {
                    font-size: 12px;
                    color: #6b7280;
                    letter-spacing: 0.04em;
                }

                .rank-score-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    border-radius: 999px;
                    background: rgba(55, 65, 81, 0.08);
                    color: #374151;
                    font-size: 12px;
                    width: max-content;
                }

                .rank-score-chip strong {
                    font-size: 16px;
                    color: #111827;
                }

                .rank-status {
                    font-size: 13px;
                    line-height: 1.6;
                    padding: 10px 12px;
                    border-radius: 12px;
                    border: 1px solid transparent;
                }

                .rank-status.rank-status--active {
                    background: rgba(34, 197, 94, 0.08);
                    border-color: rgba(34, 197, 94, 0.2);
                    color: #047857;
                }

                .rank-status.rank-status--warning {
                    background: rgba(251, 191, 36, 0.1);
                    border-color: rgba(251, 191, 36, 0.3);
                    color: #92400e;
                }

                .rank-status.rank-status--restricted {
                    background: rgba(248, 113, 113, 0.1);
                    border-color: rgba(248, 113, 113, 0.3);
                    color: #b91c1c;
                }

                .rank-status.rank-status--banned {
                    background: rgba(239, 68, 68, 0.15);
                    border-color: rgba(239, 68, 68, 0.4);
                    color: #7f1d1d;
                }

                .profile-featured-title {
                    margin-top: 12px;
                    border-radius: 16px;
                    border: 1px solid #e5e7eb;
                    padding: 16px;
                    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .profile-featured-title__icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 26px;
                    background: rgba(17, 24, 39, 0.08);
                }

                .profile-featured-title__body {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .profile-featured-title__name {
                    font-size: 16px;
                    font-weight: 700;
                    color: #111827;
                }

                .profile-featured-title__description {
                    font-size: 13px;
                    color: #6b7280;
                }

                .profile-featured-title__link {
                    border-radius: 999px;
                    border: 1px solid #d1d5db;
                    background: #ffffff;
                    color: #374151;
                    padding: 8px 16px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.2s ease, color 0.2s ease;
                }

                .profile-featured-title__link:hover {
                    background: #f3f4f6;
                }

                @media (max-width: 640px) {
                    .profile-page {
                        padding: 20px 16px;
                    }

                    .profile-header {
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        padding: 20px;
                    }

                    .profile-info {
                        align-items: center;
                        text-align: center;
                    }

                    .profile-name {
                        font-size: 22px;
                    }

                    .profile-featured-title {
                        flex-direction: column;
                        align-items: stretch;
                        text-align: left;
                        gap: 12px;
                        padding: 14px;
                    }

                    .profile-featured-title__icon {
                        margin: 0 auto;
                    }

                    .profile-featured-title__link {
                        width: 100%;
                        text-align: center;
                    }

                    .profile-action-button {
                        width: 100%;
                        justify-content: center;
                    }

                    .profile-stats {
                        width: 100%;
                        justify-content: center;
                    }

                    .profile-stat {
                        flex: 1 1 calc(50% - 12px);
                        min-width: 140px;
                    }

                    .profile-tabs {
                        overflow-x: auto;
                        gap: 12px;
                    }

                    .profile-tab {
                        flex: 0 0 auto;
                        padding: 10px 0;
                    }

                    .profile-post-grid {
                        grid-template-columns: 1fr;
                    }

                    .profile-title-gallery {
                        grid-template-columns: 1fr;
                    }

                    .profile-edit-modal {
                        padding: 20px 16px;
                    }
                }

                .profile-title-gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 18px;
                }

                .profile-title-card {
                    border-radius: 16px;
                    border: 1px solid #e5e7eb;
                    background: #ffffff;
                    padding: 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    position: relative;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .profile-title-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
                }

                .profile-title-card--locked {
                    opacity: 0.8;
                    background: #f9fafb;
                }

                .profile-title-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .profile-title-badge {
                    width: 44px;
                    height: 44px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    background: rgba(17, 24, 39, 0.08);
                }

                .profile-title-name {
                    font-size: 16px;
                    font-weight: 700;
                    color: #111827;
                }

                .profile-title-description {
                    font-size: 13px;
                    color: #4b5563;
                    line-height: 1.6;
                }

                .profile-title-progress {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .profile-title-progress-bar {
                    width: 100%;
                    height: 8px;
                    border-radius: 999px;
                    background: rgba(17, 24, 39, 0.08);
                    overflow: hidden;
                }

                .profile-title-progress-fill {
                    height: 100%;
                    border-radius: 999px;
                    transition: width 0.3s ease;
                }

                .profile-title-requirements {
                    font-size: 12px;
                    color: #6b7280;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .profile-title-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                    color: #6b7280;
                }

                .profile-title-empty {
                    padding: 24px;
                    border-radius: 14px;
                    border: 1px dashed #d1d5db;
                    background: #f9fafb;
                    text-align: center;
                    color: #6b7280;
                }

                .profile-name {
                    font-size: 26px;
                    font-weight: 700;
                    color: #1f2933;
                }

                .profile-id {
                    color: #6b7280;
                    font-size: 15px;
                }

                .profile-bio {
                    font-size: 15px;
                    color: #4b5563;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    word-break: break-word;
                }

                .profile-action-button {
                    margin-top: 6px;
                    align-self: flex-start;
                    padding: 10px 22px;
                    border-radius: 999px;
                    border: none;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
                    color: #ffffff;
                    cursor: pointer;
                    box-shadow: 0 12px 24px rgba(217, 119, 6, 0.25);
                    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                }

                .profile-action-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 18px 30px rgba(217, 119, 6, 0.32);
                }

                .profile-action-button:focus-visible {
                    outline: 3px solid rgba(251, 191, 36, 0.6);
                    outline-offset: 2px;
                }

                .profile-action-button.is-following {
                    background: #ffffff;
                    color: #d97706;
                    border: 2px solid rgba(217, 119, 6, 0.6);
                    box-shadow: none;
                }

                .profile-action-button.is-edit {
                    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
                    box-shadow: 0 12px 28px rgba(17, 24, 39, 0.28);
                }

                .profile-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 14px;
                    margin-top: 10px;
                }

                .profile-stat {
                    min-width: 120px;
                    padding: 14px 18px;
                    border-radius: 16px;
                    border: 1px solid #e5e7eb;
                    background: #f9fafb;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .profile-stat--clickable {
                    cursor: pointer;
                }

                .profile-stat--clickable:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 18px 30px rgba(15, 23, 42, 0.18);
                }

                .profile-stat--clickable:focus-visible {
                    outline: 3px solid rgba(217, 119, 6, 0.3);
                    outline-offset: 3px;
                }

                .profile-stat-value {
                    font-size: 22px;
                    font-weight: 700;
                    color: #1f2933;
                }

                .profile-stat-label {
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #6b7280;
                }

                .profile-tabs {
                    display: flex;
                    gap: 18px;
                    margin-bottom: 24px;
                    padding: 0 4px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .profile-tab {
                    padding: 12px 4px;
                    font-weight: 600;
                    color: #6b7280;
                    border-bottom: 3px solid transparent;
                    transition: color 0.2s ease, border 0.2s ease;
                    position: relative;
                    cursor: pointer;
                }

                .profile-tab:hover {
                    color: #374151;
                }

                .profile-tab.active {
                    color: #d97706;
                    border-bottom-color: #d97706;
                }

                #profileContent {
                    min-height: 240px;
                }

                .profile-post-grid {
                    display: grid;
                    gap: 20px;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                }

                .profile-post-item {
                    background: #ffffff;
                    border-radius: 18px;
                    border: 1px solid #e5e7eb;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .profile-post-item:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 24px 40px rgba(15, 23, 42, 0.18);
                }

                .profile-post-media {
                    background: #f3f4f6;
                    position: relative;
                    overflow: hidden;
                }

                .profile-post-media picture,
                .profile-post-media img {
                    display: block;
                    width: 100%;
                    height: auto;
                }

                .profile-post-image {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .profile-post-content {
                    padding: 18px 20px 22px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .profile-post-text {
                    margin: 0;
                    font-size: 15px;
                    line-height: 1.7;
                    color: #1f2933;
                    word-break: break-word;
                }

                .profile-post-meta {
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #9ca3af;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .profile-post-empty {
                    padding: 48px 32px;
                    text-align: center;
                    color: #6b7280;
                    border: 2px dashed #e5e7eb;
                    border-radius: 18px;
                    background: #f9fafb;
                    font-size: 15px;
                    line-height: 1.7;
                }

                .user-list {
                    display: grid;
                    gap: 18px;
                    margin-top: 10px;
                }

                .user-list-item {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                    padding: 16px 20px;
                    border-radius: 16px;
                    border: 1px solid #e5e7eb;
                    background: #ffffff;
                    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .user-list-item:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 20px 36px rgba(15, 23, 42, 0.16);
                }

                .user-list-avatar {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 2px solid rgba(255, 255, 255, 0.9);
                    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
                    background: #f3f4f6;
                    flex-shrink: 0;
                }

                .user-list-avatar img {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .user-list-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .user-list-name {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1f2933;
                }

                .user-list-id {
                    font-size: 13px;
                    color: #6b7280;
                }

                .user-list-empty {
                    padding: 40px 32px;
                    text-align: center;
                    color: #6b7280;
                    border: 2px dashed #e5e7eb;
                    border-radius: 18px;
                    background: #f9fafb;
                    font-size: 15px;
                    line-height: 1.7;
                }

                .loading {
                    text-align: center;
                    padding: 40px 20px;
                    color: #6b7280;
                }

                .error {
                    padding: 16px 18px;
                    border-radius: 12px;
                    background: rgba(248, 113, 113, 0.12);
                    color: #b91c1c;
                    border: 1px solid rgba(239, 68, 68, 0.4);
                }

                /* Dark Mode Overrides */
                .dark-mode .profile-header {
                    background: #111827;
                    border-color: #1f2937;
                    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
                }

                .dark-mode .profile-name {
                    color: #f9fafb;
                }

                .dark-mode .profile-rank-card {
                    background: linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%);
                    border-color: #1f2937;
                    box-shadow: 0 22px 40px rgba(0, 0, 0, 0.55);
                }

                .dark-mode .rank-points {
                    color: #f9fafb;
                }

                .dark-mode .rank-description {
                    color: #d1d5db;
                }

                .dark-mode .rank-progress-bar {
                    background: #374151;
                }

                .dark-mode .rank-progress-label {
                    color: #9ca3af;
                }

                .dark-mode .rank-score-chip {
                    background: rgba(249, 250, 251, 0.1);
                    color: #e5e7eb;
                }

                .dark-mode .rank-score-chip strong {
                    color: #fef3c7;
                }

                .dark-mode .profile-featured-title {
                    background: linear-gradient(135deg, rgba(31, 41, 55, 0.9) 0%, rgba(17, 24, 39, 0.9) 100%);
                    border-color: #374151;
                }

                .dark-mode .profile-featured-title__icon {
                    background: rgba(255, 255, 255, 0.12);
                }

                .dark-mode .profile-featured-title__name {
                    color: #f3f4f6;
                }

                .dark-mode .profile-featured-title__description {
                    color: #d1d5db;
                }

                .dark-mode .profile-featured-title__link {
                    background: #1f2937;
                    border-color: #374151;
                    color: #f9fafb;
                }

                .dark-mode .profile-featured-title__link:hover {
                    background: #111827;
                }

                .dark-mode .profile-id {
                    color: #9ca3af;
                }

                .dark-mode .profile-bio {
                    color: #d1d5db;
                }

                .dark-mode .profile-action-button.is-following {
                    background: rgba(17, 24, 39, 0.6);
                    color: #fbbf24;
                    border-color: rgba(251, 191, 36, 0.6);
                }

                .dark-mode .profile-action-button.is-edit {
                    background: linear-gradient(135deg, #f9fafb 0%, #d1d5db 100%);
                    color: #111827;
                }

                .dark-mode .profile-stats {
                    color: #e5e7eb;
                }

                .dark-mode .profile-stat {
                    background: #1f2937;
                    border-color: #111827;
                    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.38);
                }

                .dark-mode .profile-stat-value {
                    color: #f9fafb;
                }

                .dark-mode .profile-stat-label {
                    color: #9ca3af;
                }

                .dark-mode .profile-tabs {
                    border-bottom-color: #1f2937;
                }

                .dark-mode .profile-tab {
                    color: #9ca3af;
                }

                .dark-mode .profile-tab.active {
                    color: #fbbf24;
                    border-bottom-color: #fbbf24;
                }

                .dark-mode .profile-post-item {
                    background: #111827;
                    border-color: #1f2937;
                    box-shadow: 0 24px 44px rgba(0, 0, 0, 0.55);
                }

                .dark-mode .profile-post-text {
                    color: #f9fafb;
                }

                .dark-mode .profile-post-meta {
                    color: #9ca3af;
                }

                .dark-mode .profile-post-empty {
                    background: rgba(17, 24, 39, 0.75);
                    border-color: #1f2937;
                    color: #d1d5db;
                }

                .dark-mode .profile-title-card {
                    background: #111827;
                    border-color: #1f2937;
                }

                .dark-mode .profile-title-card--locked {
                    background: rgba(17, 24, 39, 0.85);
                    opacity: 0.9;
                }

                .dark-mode .profile-title-description {
                    color: #d1d5db;
                }

                .dark-mode .profile-title-requirements {
                    color: #9ca3af;
                }

                .dark-mode .profile-title-footer {
                    color: #9ca3af;
                }

                .dark-mode .profile-title-empty {
                    background: rgba(17, 24, 39, 0.75);
                    border-color: #1f2937;
                    color: #d1d5db;
                }

                .dark-mode .user-list-item {
                    background: #111827;
                    border-color: #1f2937;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.55);
                }

                .dark-mode .user-list-name {
                    color: #f9fafb;
                }

                .dark-mode .user-list-id {
                    color: #9ca3af;
                }

                .dark-mode .user-list-empty {
                    background: rgba(17, 24, 39, 0.75);
                    border-color: #1f2937;
                    color: #d1d5db;
                }

                .dark-mode .loading {
                    color: #9ca3af;
                }

                .profile-edit-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.55);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    backdrop-filter: blur(2px);
                }

                .profile-edit-modal {
                    background: #ffffff;
                    padding: 24px;
                    border-radius: 18px;
                    width: 90%;
                    max-width: 520px;
                    box-shadow: 0 28px 60px rgba(15, 23, 42, 0.28);
                }

                .dark-mode .profile-edit-modal {
                    background: #111827;
                    box-shadow: 0 32px 70px rgba(0, 0, 0, 0.65);
                }

                .profile-edit-modal h2 {
                    margin-top: 0;
                    margin-bottom: 18px;
                }

                .profile-edit-modal .form-group {
                    margin-bottom: 18px;
                }

                .profile-edit-modal label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 600;
                }

                .profile-edit-modal input,
                .profile-edit-modal textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 10px;
                    font-size: 15px;
                }

                .dark-mode .profile-edit-modal input,
                .dark-mode .profile-edit-modal textarea {
                    background: #1f2937;
                    border-color: #4b5563;
                    color: #f9fafb;
                }

                .profile-edit-modal .modal-actions {
                    text-align: right;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
            </style>
            <div id="profileContainer">
                <div class="loading">プロフィールを読み込み中...</div>
            </div>
        `;
    },

    async fetchProfileData(userId) {
        try {
            const profileResult = await API.getUserProfile(userId);
            const postsResult = await API.getUserPosts(userId);

            if (profileResult.success && postsResult.success) {
                this.state.user = profileResult.user;
                this.state.posts = postsResult.posts;
                this.state.isLoading = false;
                this.updateDOM();
            } else {
                // ユーザーが存在しない場合のエラーハンドリング
                if (profileResult.error && (
                    profileResult.error.includes('ユーザーが見つかりません') ||
                    profileResult.error.includes('User not found') ||
                    profileResult.error.includes('404')
                )) {
                    this.renderUserNotFound(userId);
                    return;
                }
                throw new Error(profileResult.error || postsResult.error || 'データの取得に失敗しました');
            }
        } catch (error) {
            this.state.isLoading = false;
            this.state.error = error.message;
            this.updateDOM();
        }
    },

    // ユーザーが見つからない場合の表示
    renderUserNotFound(userId) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="error">
                <h2>ユーザーが見つかりません</h2>
                <p>ユーザーID "${userId}" のユーザーは存在しません。</p>
                <button onclick="router.navigate('timeline')" style="margin-top: 16px; padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">ホームに戻る</button>
            </div>
        `;
    },

    updateDOM() {
        const container = document.getElementById('profileContainer');
        if (!container) return;

        // Clear previous content
        container.innerHTML = '';

        if (this.state.isLoading) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading';
            loadingDiv.textContent = 'プロフィールを読み込み中...';
            container.appendChild(loadingDiv);
            return;
        }

        if (this.state.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = this.state.error;
            container.appendChild(errorDiv);
            return;
        }

        if (this.state.user) {
            const {
                id,
                username,
                followers_count,
                following_count,
                posts_count,
                is_following,
                rank,
                points,
                rank_color,
                rank_description,
                next_rank_name,
                points_to_next_rank,
                rank_progress_percentage,
                status_message,
                internal_score,
                account_status
            } = this.state.user;

            const userCookie = API.getCookie('user');
            let currentUser = null;
            if (userCookie) {
                try {
                    currentUser = JSON.parse(decodeURIComponent(userCookie));
                } catch (e) {
                    console.error("Failed to parse user cookie", e);
                }
            }
            const isOwnProfile = currentUser && currentUser.id === id;

            const profilePage = document.createElement('div');
            profilePage.className = 'profile-page';

            // Header
            const header = document.createElement('div');
            header.className = 'profile-header';

            const avatar = document.createElement('img');
            avatar.className = 'profile-avatar';
            avatar.src = this.state.user.profile_image_url || 'assets/baseicon.png';
            avatar.alt = `${username}のアバター`;
            header.appendChild(avatar);

            const infoDiv = document.createElement('div');

            const displayName = username && username.trim() !== '' ? username : id;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'profile-name';
            nameDiv.textContent = displayName;
            infoDiv.appendChild(nameDiv);

            const idDiv = document.createElement('div');
            idDiv.className = 'profile-id';
            idDiv.textContent = `@${id}`;
            infoDiv.appendChild(idDiv);

            const bioDiv = document.createElement('div');
            bioDiv.className = 'profile-bio';
            bioDiv.textContent = this.state.user.bio || '';
            infoDiv.appendChild(bioDiv);

            const badgeColor = rank_color || '#f59e0b';
            const progress = Math.min(100, Math.max(0, Number(rank_progress_percentage) || 0));
            const progressDisplay = Math.round(progress);
            const sanitizedRankName = API.escapeHtml(rank || 'ランク未設定');
            const sanitizedRankDescription = API.escapeHtml(rank_description || 'ラーメン体験を共有してポイントを貯めましょう！');
            const sanitizedStatusMessage = API.escapeHtml(status_message || '');
            const normalizedStatus = (account_status || 'active').toLowerCase();
            const statusClass = `rank-status rank-status--${normalizedStatus}`;
            const sanitizedNextRankName = API.escapeHtml(next_rank_name || '');
            const nextRankLabel = next_rank_name
                ? `次のランク「${sanitizedNextRankName}」まであと${points_to_next_rank ?? 0}pt`
                : '最高ランクに到達しています！';

            const rankCard = document.createElement('div');
            rankCard.className = 'profile-rank-card';
            rankCard.innerHTML = `
                <div class="rank-card-header">
                    <span class="rank-badge" style="background:${badgeColor};">${sanitizedRankName}</span>
                    <span class="rank-points">${points ?? 0} pt</span>
                </div>
                <p class="rank-description">${sanitizedRankDescription}</p>
                <div class="rank-progress-bar">
                    <div class="rank-progress-bar-fill" style="width:${progress}%; background:${badgeColor};"></div>
                </div>
                <div class="rank-progress-label">進捗 ${progressDisplay}% ・ ${nextRankLabel}</div>
                <div class="rank-score-chip">
                    <span>コミュニティスコア</span>
                    <strong>${internal_score ?? 0}</strong>
                </div>
                <div class="${statusClass}">${sanitizedStatusMessage}</div>
            `;
            infoDiv.appendChild(rankCard);

            const featuredTitleWrapper = document.createElement('div');
            featuredTitleWrapper.className = 'profile-featured-title';

            const featuredTitle = this.state.user.featured_title;
            const featuredColor = featuredTitle?.theme_color || '#f97316';

            const featuredIcon = document.createElement('div');
            featuredIcon.className = 'profile-featured-title__icon';
            featuredIcon.style.background = this.getColorWithAlpha(featuredColor, 0.18);
            featuredIcon.style.color = featuredColor;
            featuredIcon.textContent = featuredTitle?.icon || '☆';
            featuredTitleWrapper.appendChild(featuredIcon);

            const featuredBody = document.createElement('div');
            featuredBody.className = 'profile-featured-title__body';

            const featuredName = document.createElement('div');
            featuredName.className = 'profile-featured-title__name';
            featuredName.textContent = featuredTitle?.name || 'まだ称号がありません';
            featuredBody.appendChild(featuredName);

            const featuredDescription = document.createElement('div');
            featuredDescription.className = 'profile-featured-title__description';
            featuredDescription.textContent = featuredTitle?.description || '称号を獲得するとここにハイライト表示されます。';
            featuredBody.appendChild(featuredDescription);

            if (featuredTitle?.earned_at) {
                const earned = document.createElement('div');
                earned.className = 'profile-featured-title__description';
                earned.textContent = `獲得日: ${this.formatDate(featuredTitle.earned_at)}`;
                featuredBody.appendChild(earned);
            }

            featuredTitleWrapper.appendChild(featuredBody);

            const rankingButton = document.createElement('button');
            rankingButton.type = 'button';
            rankingButton.className = 'profile-featured-title__link';
            rankingButton.textContent = 'ランキングを確認';
            rankingButton.addEventListener('click', () => router.navigate('rankings'));
            featuredTitleWrapper.appendChild(rankingButton);

            infoDiv.appendChild(featuredTitleWrapper);

            const statsDiv = document.createElement('div');
            statsDiv.className = 'profile-stats';

            const createStat = (value, label, { onClick = null, tab = null, id: elementId = null } = {}) => {
                const stat = document.createElement('div');
                stat.className = 'profile-stat';

                const valueEl = document.createElement('span');
                valueEl.className = 'profile-stat-value';
                if (elementId) valueEl.id = elementId;
                valueEl.textContent = value;
                stat.appendChild(valueEl);

                const labelEl = document.createElement('span');
                labelEl.className = 'profile-stat-label';
                labelEl.textContent = label;
                stat.appendChild(labelEl);

                const handler = onClick || (tab ? () => this.activateTab(tab) : null);
                if (handler) {
                    stat.classList.add('profile-stat--clickable');
                    stat.setAttribute('role', 'button');
                    stat.setAttribute('tabindex', '0');
                    stat.addEventListener('click', handler);
                    stat.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handler();
                        }
                    });
                }

                return stat;
            };

            statsDiv.appendChild(createStat(posts_count, '投稿', { tab: 'posts', id: 'postsCount' }));
            statsDiv.appendChild(createStat(followers_count, 'フォロワー', {
                id: 'followersCount',
                onClick: isOwnProfile ? () => this.activateTab('followers') : null
            }));
            statsDiv.appendChild(createStat(following_count, 'フォロー中', {
                id: 'followingCount',
                onClick: isOwnProfile ? () => this.activateTab('following') : null
            }));
            infoDiv.appendChild(statsDiv);

            const actionButton = document.createElement('button');
            actionButton.className = 'profile-action-button';
            if (isOwnProfile) {
                actionButton.textContent = 'プロフィールを編集';
                actionButton.classList.add('is-edit');
                actionButton.addEventListener('click', () => this.showEditModal());
            } else {
                actionButton.id = 'followBtn';
                actionButton.textContent = is_following ? 'フォロー解除' : 'フォローする';
                actionButton.classList.toggle('is-following', Boolean(is_following));
                actionButton.setAttribute('aria-pressed', Boolean(is_following));
                actionButton.addEventListener('click', () => this.toggleFollow(id));

                // プロフィール通報ボタン（他人のプロフィールのみ表示）
                const reportBtn = document.createElement('button');
                reportBtn.className = 'profile-action-button';
                reportBtn.style.marginLeft = '12px';
                reportBtn.style.background = '#ef4444';
                reportBtn.style.boxShadow = '0 12px 24px rgba(239,68,68,0.35)';
                reportBtn.textContent = 'このプロフィールを通報';
                reportBtn.addEventListener('click', () => this.openUserReportDialog(this.state.user));
                infoDiv.appendChild(reportBtn);
            }
            infoDiv.appendChild(actionButton);
            header.appendChild(infoDiv);
            profilePage.appendChild(header);

            // Tabs
            const tabs = document.createElement('div');
            tabs.className = 'profile-tabs';
            const createTab = (label, dataTab, isActive = false) => {
                const tab = document.createElement('div');
                tab.className = `profile-tab${isActive ? ' active' : ''}`;
                tab.dataset.tab = dataTab;
                tab.textContent = label;
                return tab;
            };

            tabs.appendChild(createTab('投稿', 'posts', true));
            tabs.appendChild(createTab('フォロワー', 'followers'));
            tabs.appendChild(createTab('フォロー中', 'following'));
            tabs.appendChild(createTab('称号', 'titles'));
            profilePage.appendChild(tabs);

            const profileContent = document.createElement('div');
            profileContent.id = 'profileContent';
            profilePage.appendChild(profileContent);

            container.appendChild(profilePage);

            this.addTabListeners();
            this.activateTab('posts');
            this.updateStatCounts();
            this.updateFollowButton();
        }
    },

    addTabListeners() {
        const tabs = document.querySelectorAll('.profile-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => this.activateTab(tab.getAttribute('data-tab')));
        });
    },

    activateTab(tabName) {
        const tabs = document.querySelectorAll('.profile-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });
        this.renderTabContent(tabName);
    },

    updateStatCounts() {
        if (!this.state.user) return;

        const postsValue = typeof this.state.user.posts_count === 'number'
            ? this.state.user.posts_count
            : (Array.isArray(this.state.posts) ? this.state.posts.length : 0);

        const postsCountEl = document.getElementById('postsCount');
        if (postsCountEl) postsCountEl.textContent = postsValue;

        const followersCountEl = document.getElementById('followersCount');
        if (followersCountEl) followersCountEl.textContent = this.state.user.followers_count ?? 0;

        const followingCountEl = document.getElementById('followingCount');
        if (followingCountEl) followingCountEl.textContent = this.state.user.following_count ?? 0;
    },

    updateFollowButton() {
        const followBtn = document.getElementById('followBtn');
        if (!followBtn || !this.state.user) return;
        followBtn.textContent = this.state.user.is_following ? 'フォロー解除' : 'フォローする';
        followBtn.classList.toggle('is-following', Boolean(this.state.user.is_following));
        followBtn.setAttribute('aria-pressed', Boolean(this.state.user.is_following));
    },

    renderTabContent(tabName) {
        const content = document.getElementById('profileContent');
        content.innerHTML = ''; // Clear previous content

        if (tabName === 'posts') {
            if (!this.state.posts || this.state.posts.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'profile-post-empty';
                empty.innerHTML = 'まだ投稿がありません。<br>最初の投稿をシェアしてみましょう！';
                content.appendChild(empty);
            } else {
                const grid = document.createElement('div');
                grid.className = 'profile-post-grid';
                this.state.posts.forEach(post => {
                    const item = document.createElement('article');
                    item.className = 'profile-post-item';

                    if (post.image_url || post.thumbnail_url) {
                        const mediaWrapper = document.createElement('div');
                        mediaWrapper.className = 'profile-post-media';

                        const picture = document.createElement('picture');

                        if (post.original_image_url) {
                            const source = document.createElement('source');
                            source.srcset = post.original_image_url;
                            source.media = '(min-width: 768px)';
                            picture.appendChild(source);
                        }

                        const img = document.createElement('img');
                        img.src = post.thumbnail_url || post.image_url;
                        img.alt = '投稿画像';
                        img.loading = 'lazy';
                        img.className = 'profile-post-image';

                        if (post.original_image_url) {
                            img.dataset.src = post.original_image_url;
                        }

                        picture.appendChild(img);
                        mediaWrapper.appendChild(picture);
                        item.appendChild(mediaWrapper);
                    }

                    const contentWrapper = document.createElement('div');
                    contentWrapper.className = 'profile-post-content';

                    const text = document.createElement('p');
                    text.className = 'profile-post-text';
                    text.innerHTML = API.escapeHtmlWithLineBreaks(post.content || '');
                    contentWrapper.appendChild(text);

                    const metaItems = [];
                    if (post.created_at) {
                        metaItems.push(API.formatTime(post.created_at));
                    }
                    if (post.shop_name) {
                        metaItems.push(post.shop_name);
                    }
                    if (typeof post.likes_count === 'number') {
                        metaItems.push(`${post.likes_count}件のいいね`);
                    }
                    if (typeof post.replies_count === 'number') {
                        metaItems.push(`${post.replies_count}件のコメント`);
                    }

                    if (metaItems.length > 0) {
                        const meta = document.createElement('div');
                        meta.className = 'profile-post-meta';
                        meta.textContent = metaItems.join(' ・ ');
                        contentWrapper.appendChild(meta);
                    }

                    item.appendChild(contentWrapper);
                    grid.appendChild(item);
                });
                content.appendChild(grid);
            }

            // 遅延読み込みを設定
            setTimeout(() => {
                this.setupLazyLoading();
            }, 100);
        } else if (tabName === 'titles') {
            this.renderTitlesGallery();
        } else if (tabName === 'followers') {
            this.showFollowers();
        } else if (tabName === 'following') {
            this.showFollowing();
        }
    },

    renderTitlesGallery() {
        const content = document.getElementById('profileContent');
        if (!content) return;

        const titles = Array.isArray(this.state.user?.titles) ? this.state.user.titles : [];

        if (titles.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'profile-title-empty';
            empty.innerHTML = '称号データがありません。<br>チェックインや投稿で実績を集めましょう。';
            content.appendChild(empty);
            return;
        }

        const gallery = document.createElement('div');
        gallery.className = 'profile-title-gallery';

        titles.forEach(title => {
            const card = document.createElement('article');
            card.className = 'profile-title-card';
            if (!title.unlocked) {
                card.classList.add('profile-title-card--locked');
            }

            const color = title.theme_color || '#2563eb';
            const progressValue = title.unlocked ? 100 : Math.min(100, Math.max(0, Number(title.progress) || 0));

            const header = document.createElement('div');
            header.className = 'profile-title-header';

            const badge = document.createElement('div');
            badge.className = 'profile-title-badge';
            badge.style.background = this.getColorWithAlpha(color, 0.18);
            badge.style.color = color;
            badge.textContent = title.icon || '🏅';
            header.appendChild(badge);

            const name = document.createElement('div');
            name.className = 'profile-title-name';
            name.textContent = title.name || title.key;
            header.appendChild(name);

            card.appendChild(header);

            const description = document.createElement('div');
            description.className = 'profile-title-description';
            description.textContent = title.description || '';
            card.appendChild(description);

            const progress = document.createElement('div');
            progress.className = 'profile-title-progress';

            const progressBar = document.createElement('div');
            progressBar.className = 'profile-title-progress-bar';
            const progressFill = document.createElement('div');
            progressFill.className = 'profile-title-progress-fill';
            progressFill.style.background = color;
            progressFill.style.width = `${progressValue}%`;
            progressBar.appendChild(progressFill);
            progress.appendChild(progressBar);

            const progressLabel = document.createElement('div');
            progressLabel.className = 'profile-title-description';
            progressLabel.textContent = `${title.progress_label || '進捗'}: ${progressValue}%`;
            progress.appendChild(progressLabel);

            card.appendChild(progress);

            if (Array.isArray(title.requirements) && title.requirements.length > 0) {
                const requirements = document.createElement('div');
                requirements.className = 'profile-title-requirements';
                title.requirements.forEach(req => {
                    const row = document.createElement('span');
                    const label = req.label || req.metric;
                    row.textContent = `${label}: ${this.formatNumber(req.current || 0)} / ${this.formatNumber(req.required || 0)}`;
                    requirements.appendChild(row);
                });
                card.appendChild(requirements);
            }

            const footer = document.createElement('div');
            footer.className = 'profile-title-footer';
            const left = document.createElement('span');
            left.textContent = title.unlocked ? `獲得日: ${this.formatDate(title.earned_at)}` : '未獲得';
            const right = document.createElement('span');
            right.textContent = `プレミア度: ${title.prestige || 0}`;
            footer.appendChild(left);
            footer.appendChild(right);
            card.appendChild(footer);

            gallery.appendChild(card);
        });

        content.appendChild(gallery);
    },

    formatNumber(value) {
        if (typeof value !== 'number') {
            value = Number(value) || 0;
        }
        return value.toLocaleString('ja-JP');
    },

    formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    },

    getColorWithAlpha(color, alpha = 0.18) {
        if (!color) return `rgba(17, 24, 39, ${alpha})`;
        const sanitized = color.replace('#', '');
        if (sanitized.length !== 6) return `rgba(17, 24, 39, ${alpha})`;
        const r = parseInt(sanitized.slice(0, 2), 16);
        const g = parseInt(sanitized.slice(2, 4), 16);
        const b = parseInt(sanitized.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    async showFollowers() {
        const content = document.getElementById('profileContent');
        content.innerHTML = `<div class="loading">フォロワーを読み込み中...</div>`;

        try {
            const result = await API.getFollowers(this.state.user.id);
            content.innerHTML = ''; // Clear loading

            if (result.success) {
                if (result.users.length === 0) {
                    const noUsersDiv = document.createElement('div');
                    noUsersDiv.className = 'user-list-empty';
                    noUsersDiv.textContent = 'フォロワーはいません。';
                    content.appendChild(noUsersDiv);
                    return;
                }

                const userList = document.createElement('div');
                userList.className = 'user-list';
                result.users.forEach(user => {
                    const item = document.createElement('div');
                    item.className = 'user-list-item';

                    const avatar = document.createElement('div');
                    avatar.className = 'user-list-avatar';
                    const avatarImg = document.createElement('img');
                    avatarImg.src = user.profile_image_url || 'assets/baseicon.png';
                    avatarImg.alt = `${user.username}のアイコン`;
                    avatar.appendChild(avatarImg);
                    item.appendChild(avatar);

                    const userInfo = document.createElement('div');
                    userInfo.className = 'user-list-info';
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'user-list-name';
                    nameDiv.textContent = user.username;
                    userInfo.appendChild(nameDiv);

                    const idDiv = document.createElement('div');
                    idDiv.className = 'user-list-id';
                    idDiv.textContent = `@${user.id}`;
                    userInfo.appendChild(idDiv);

                    item.appendChild(userInfo);
                    userList.appendChild(item);
                });
                content.appendChild(userList);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            content.innerHTML = `<div class="error">フォロワーの読み込みに失敗しました: ${error.message}</div>`;
        }
    },

    async showFollowing() {
        const content = document.getElementById('profileContent');
        content.innerHTML = `<div class="loading">フォロー中を読み込み中...</div>`;

        try {
            const result = await API.getFollowing(this.state.user.id);
            content.innerHTML = ''; // Clear loading

            if (result.success) {
                if (result.users.length === 0) {
                    const noUsersDiv = document.createElement('div');
                    noUsersDiv.className = 'user-list-empty';
                    noUsersDiv.textContent = 'フォロー中はいません。';
                    content.appendChild(noUsersDiv);
                    return;
                }

                const userList = document.createElement('div');
                userList.className = 'user-list';
                result.users.forEach(user => {
                    const item = document.createElement('div');
                    item.className = 'user-list-item';

                    const avatar = document.createElement('div');
                    avatar.className = 'user-list-avatar';
                    const avatarImg = document.createElement('img');
                    avatarImg.src = user.profile_image_url || 'assets/baseicon.png';
                    avatarImg.alt = `${user.username}のアイコン`;
                    avatar.appendChild(avatarImg);
                    item.appendChild(avatar);

                    const userInfo = document.createElement('div');
                    userInfo.className = 'user-list-info';
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'user-list-name';
                    nameDiv.textContent = user.username;
                    userInfo.appendChild(nameDiv);

                    const idDiv = document.createElement('div');
                    idDiv.className = 'user-list-id';
                    idDiv.textContent = `@${user.id}`;
                    userInfo.appendChild(idDiv);

                    item.appendChild(userInfo);
                    userList.appendChild(item);
                });
                content.appendChild(userList);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            content.innerHTML = `<div class="error">フォロー中の読み込みに失敗しました: ${error.message}</div>`;
        }
    },

    async renderUserList(title, apiMethod) {
        const content = document.getElementById('profileContent');
        content.innerHTML = `<div class="loading">${title}を読み込み中...</div>`;

        try {
            // APIメソッドを直接呼び出すのではなく、APIオブジェクトのメソッドとして呼び出す
            let result;
            if (apiMethod === API.getFollowers) {
                result = await API.getFollowers(this.state.user.id);
            } else if (apiMethod === API.getFollowing) {
                result = await API.getFollowing(this.state.user.id);
            } else {
                throw new Error('不明なAPIメソッド');
            }
            
            content.innerHTML = ''; // Clear loading

            if (result.success) {
                if (result.users.length === 0) {
                    const noUsersDiv = document.createElement('div');
                    noUsersDiv.className = 'user-list-empty';
                    noUsersDiv.textContent = `${title}はいません。`;
                    content.appendChild(noUsersDiv);
                    return;
                }

                const userList = document.createElement('div');
                userList.className = 'user-list';
                result.users.forEach(user => {
                    const item = document.createElement('div');
                    item.className = 'user-list-item';

                    const avatar = document.createElement('div');
                    avatar.className = 'user-list-avatar';
                    const avatarImg = document.createElement('img');
                    avatarImg.src = user.profile_image_url || 'assets/baseicon.png';
                    avatarImg.alt = `${user.username}のアイコン`;
                    avatar.appendChild(avatarImg);
                    item.appendChild(avatar);

                    const userInfo = document.createElement('div');
                    userInfo.className = 'user-list-info';
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'user-list-name';
                    nameDiv.textContent = user.username;
                    userInfo.appendChild(nameDiv);

                    const idDiv = document.createElement('div');
                    idDiv.className = 'user-list-id';
                    idDiv.textContent = `@${user.id}`;
                    userInfo.appendChild(idDiv);

                    item.appendChild(userInfo);
                    userList.appendChild(item);
                });
                content.appendChild(userList);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            content.innerHTML = `<div class="error">${title}の読み込みに失敗しました: ${error.message}</div>`;
        }
    },

    openUserReportDialog(targetUser) {
        if (!targetUser) return;

        const token = API.getCookie('authToken');
        if (!token) {
            Utils.showNotification('通報するにはログインしてください', 'info');
            router.navigate('auth', ['login']);
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'profile-edit-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'profile-edit-modal';

        const title = document.createElement('h2');
        title.textContent = 'プロフィールを通報する';
        modal.appendChild(title);

        const description = document.createElement('p');
        description.textContent = '以下のユーザーを運営に通報します。内容を確認し、通報理由を入力してください。';
        modal.appendChild(description);

        const summary = document.createElement('div');
        summary.style.fontSize = '13px';
        summary.style.marginBottom = '12px';
        summary.style.padding = '10px 12px';
        summary.style.borderRadius = '10px';
        summary.style.background = '#f9fafb';
        summary.style.border = '1px solid #e5e7eb';
        summary.innerHTML = `
            ユーザー名: ${API.escapeHtml(targetUser.username || '')}<br>
            ユーザーID: ${API.escapeHtml(String(targetUser.id))}<br>
            アイコンURL: ${API.escapeHtml(targetUser.profile_image_url || '未設定')}
        `;
        modal.appendChild(summary);

        const reasonLabel = document.createElement('label');
        reasonLabel.textContent = '通報理由（必須）';
        reasonLabel.style.display = 'block';
        reasonLabel.style.marginBottom = '4px';
        modal.appendChild(reasonLabel);

        // サーバー側の ReportCreate バリデーションに合わせた選択肢
        const reasonSelect = document.createElement('select');
        reasonSelect.style.width = '100%';
        reasonSelect.style.marginBottom = '10px';
        reasonSelect.style.padding = '8px 10px';
        reasonSelect.style.borderRadius = '8px';
        reasonSelect.style.border = '1px solid #d1d5db';

        const reasonOptions = [
            'スパム・広告',
            '過度な宣伝',
            '繰り返し投稿',
            '暴力的・グロテスクな内容',
            '性的な内容',
            '不快な表現',
            '人種・民族差別',
            '性差別',
            '障害者差別',
            'その他の差別',
            '個人攻撃',
            '脅迫',
            'いじめ',
            'ストーカー行為',
            'デマ・偽情報',
            '医療・健康に関する誤情報',
            '政治に関する誤情報',
            '無断転載',
            '画像の無断使用',
            'その他の著作権侵害',
            'プライバシー侵害',
            '自殺・自傷を助長する内容',
            'その他'
        ];

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = '選択してください';
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        reasonSelect.appendChild(placeholderOption);

        reasonOptions.forEach(text => {
            const opt = document.createElement('option');
            opt.value = text;
            opt.textContent = text;
            reasonSelect.appendChild(opt);
        });

        modal.appendChild(reasonSelect);

        const detailLabel = document.createElement('label');
        detailLabel.textContent = '詳細な説明（任意）';
        detailLabel.style.display = 'block';
        detailLabel.style.marginBottom = '4px';
        modal.appendChild(detailLabel);

        const detailInput = document.createElement('textarea');
        detailInput.rows = 4;
        detailInput.placeholder = '問題となる行為が発生した経緯や該当する投稿などを具体的に記載してください。';
        detailInput.style.width = '100%';
        detailInput.style.padding = '8px 10px';
        detailInput.style.borderRadius = '8px';
        detailInput.style.border = '1px solid #d1d5db';
        modal.appendChild(detailInput);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.style.padding = '8px 14px';
        cancelBtn.style.borderRadius = '999px';
        cancelBtn.style.border = 'none';
        cancelBtn.style.background = '#6b7280';
        cancelBtn.style.color = '#fff';
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        actions.appendChild(cancelBtn);

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.textContent = '通報を送信';
        submitBtn.style.padding = '8px 16px';
        submitBtn.style.borderRadius = '999px';
        submitBtn.style.border = 'none';
        submitBtn.style.background = '#ef4444';
        submitBtn.style.color = '#fff';
        submitBtn.style.fontWeight = '600';
        submitBtn.addEventListener('click', async () => {
            const reason = (reasonSelect.value || '').trim();
            const description = detailInput.value.trim();

            if (!reason) {
                Utils.showNotification('通報理由を入力してください', 'warning');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '送信中...';

            try {
                const apiBase = (typeof API !== 'undefined' && API.baseUrl) ? API.baseUrl : '/api/v1';
                const res = await fetch(`${apiBase}/users/${encodeURIComponent(targetUser.id)}/report`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        reason,
                        description
                    })
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    const msg = data.detail || data.message || '通報の送信に失敗しました';
                    throw new Error(msg);
                }

                Utils.showNotification('通報を受け付けました。ご協力ありがとうございます。', 'success');
                document.body.removeChild(overlay);
            } catch (err) {
                console.error('Failed to report user', err);
                Utils.showNotification(`通報に失敗しました: ${err.message || err}`, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '通報を送信';
            }
        });
        actions.appendChild(submitBtn);

        modal.appendChild(actions);
        overlay.appendChild(modal);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        document.body.appendChild(overlay);
    },

    async toggleFollow(userId) {
        const token = API.getCookie('authToken');
        if (!token) {
            Utils.showNotification('フォローするにはログインしてください', 'info');
            router.navigate('auth', ['login']);
            return;
        }

        if (!this.state.user) return;

        const originalIsFollowing = Boolean(this.state.user.is_following);
        const originalFollowersCount = typeof this.state.user.followers_count === 'number'
            ? this.state.user.followers_count
            : 0;

        // Optimistic UI update
        this.state.user.is_following = !originalIsFollowing;
        this.state.user.followers_count = Math.max(0, originalFollowersCount + (this.state.user.is_following ? 1 : -1));

        this.updateFollowButton();
        this.updateStatCounts();

        try {
            const result = this.state.user.is_following
                ? await API.followUser(userId)
                : await API.unfollowUser(userId);

            if (!result.success) {
                throw new Error(result.error || 'フォローの更新に失敗しました');
            }

            const currentUser = typeof API.getCurrentUser === 'function' ? API.getCurrentUser() : null;
            if (currentUser && currentUser.id !== this.state.user.id) {
                const delta = this.state.user.is_following ? 1 : -1;
                currentUser.following_count = Math.max(0, (currentUser.following_count || 0) + delta);
                API.setCookie('user', JSON.stringify(currentUser));
            }

            const activeTab = document.querySelector('.profile-tab.active');
            const activeTabName = activeTab ? activeTab.getAttribute('data-tab') : null;
            if (activeTabName === 'followers') {
                this.showFollowers();
            } else if (activeTabName === 'following') {
                this.showFollowing();
            }
        } catch (error) {
            console.error('Failed to toggle follow state', error);
            this.state.user.is_following = originalIsFollowing;
            this.state.user.followers_count = originalFollowersCount;
            this.updateFollowButton();
            this.updateStatCounts();
            Utils.showNotification(`エラー: ${error.message || 'フォロー/フォロー解除に失敗しました。'}`, 'error');
        }
    },

    showEditModal() {
        if (!this.state.user) return;

        this.state.selectedIconFile = null;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'profile-edit-modal-overlay';

        const closeModal = () => document.body.removeChild(modalOverlay);

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });

        const modal = document.createElement('div');
        modal.className = 'profile-edit-modal';

        const h2 = document.createElement('h2');
        h2.textContent = 'プロフィールを編集';
        modal.appendChild(h2);

        const createFormGroup = (id, labelText, type = 'input', value = '') => {
            const group = document.createElement('div');
            group.className = 'form-group';
            const label = document.createElement('label');
            label.htmlFor = id;
            label.textContent = labelText;

            const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
            if (type === 'input') {
                input.type = 'text';
            } else {
                input.rows = 4;
            }
            input.id = id;
            input.value = value;

            group.appendChild(label);
            group.appendChild(input);
            return group;
        };

        modal.appendChild(createFormGroup('username', 'ニックネーム（任意・重複可／表示名）', 'input', this.state.user.username || ''));
        modal.appendChild(createFormGroup('bio', '自己紹介', 'textarea', this.state.user.bio || ''));
        modal.appendChild(createFormGroup('profileImageUrl', 'アイコンURL', 'input', this.state.user.profile_image_url || ''));

        const fileGroup = document.createElement('div');
        fileGroup.className = 'form-group';

        const fileLabel = document.createElement('label');
        fileLabel.htmlFor = 'profileImageFile';
        fileLabel.textContent = 'アイコン画像をアップロード';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'profileImageFile';
        fileInput.accept = 'image/*';

        const helperText = document.createElement('small');
        helperText.textContent = '5MB以下のJPEG/PNG/GIF/WebPを推奨します。';
        helperText.style.display = 'block';
        helperText.style.marginTop = '4px';
        helperText.style.color = '#666';

        const previewWrapper = document.createElement('div');
        previewWrapper.id = 'profileImagePreview';
        previewWrapper.style.cssText = 'margin-top: 12px; display: flex; justify-content: center;';
        const previewImg = document.createElement('img');
        previewImg.id = 'profileImagePreviewImg';
        previewImg.src = this.state.user.profile_image_url || 'assets/baseicon.png';
        previewImg.alt = `${this.state.user.username || ''}のプレビュー`;
        previewImg.style.cssText = 'width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 1px solid #e0e0e0;';
        previewWrapper.appendChild(previewImg);

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const validation = this.validateIconFile(file);
                if (!validation.isValid) {
                    Utils.showNotification(validation.error, 'error');
                    event.target.value = '';
                    previewImg.src = this.state.user.profile_image_url || 'assets/baseicon.png';
                    this.state.selectedIconFile = null;
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                };
                reader.readAsDataURL(file);
                this.state.selectedIconFile = file;
            } else {
                previewImg.src = this.state.user.profile_image_url || 'assets/baseicon.png';
                this.state.selectedIconFile = null;
            }
        });

        fileGroup.appendChild(fileLabel);
        fileGroup.appendChild(fileInput);
        fileGroup.appendChild(helperText);
        fileGroup.appendChild(previewWrapper);
        modal.appendChild(fileGroup);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.addEventListener('click', closeModal);

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.addEventListener('click', () => this.handleUpdateProfile(closeModal));

        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        modal.appendChild(actions);

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);
    },

    async handleUpdateProfile(closeModal) {
        const usernameInput = document.getElementById('username');
        const username = usernameInput ? usernameInput.value : null;
        const bio = document.getElementById('bio').value;
        const profileImageUrlInput = document.getElementById('profileImageUrl');
        const fileInput = document.getElementById('profileImageFile');

        let profileImageUrl = profileImageUrlInput ? profileImageUrlInput.value.trim() : '';

        if (fileInput && fileInput.files && fileInput.files[0]) {
            const uploadResult = await API.uploadProfileIcon(fileInput.files[0]);
            if (!uploadResult.success) {
                Utils.showNotification(uploadResult.error || 'アイコンのアップロードに失敗しました。', 'error');
                return;
            }
            profileImageUrl = uploadResult.url;
        } else if (this.state.selectedIconFile) {
            const uploadResult = await API.uploadProfileIcon(this.state.selectedIconFile);
            if (!uploadResult.success) {
                Utils.showNotification(uploadResult.error || 'アイコンのアップロードに失敗しました。', 'error');
                return;
            }
            profileImageUrl = uploadResult.url;
        }

        const updateData = {
            username,
            bio,
            profile_image_url: profileImageUrl
        };

        const result = await API.updateUserProfile(updateData);

        if (result.success) {
            this.state.user = { ...this.state.user, ...result.user };
            API.setCookie('user', JSON.stringify(this.state.user));
            this.state.selectedIconFile = null;
            this.updateDOM();
            closeModal();
        } else {
            console.error('Update failed:', result.error);
            Utils.showNotification('プロフィールの更新に失敗しました。入力内容を確認してください。', 'error');
        }
    },

    validateIconFile(file) {
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp'
        ];

        const maxSizeInBytes = 5 * 1024 * 1024;

        if (!allowedMimeTypes.includes(file.type)) {
            return {
                isValid: false,
                error: '対応している画像形式はJPEG、PNG、GIF、WebPのみです'
            };
        }

        if (file.size > maxSizeInBytes) {
            return {
                isValid: false,
                error: '画像サイズは5MB以下にしてください'
            };
        }

        const dangerousExtensions = ['.php', '.js', '.exe', '.bat', '.cmd', '.sh', '.py', '.pl', '.rb'];
        const fileName = file.name.toLowerCase();
        for (const ext of dangerousExtensions) {
            if (fileName.endsWith(ext)) {
                return {
                    isValid: false,
                    error: 'このファイル形式は許可されていません'
                };
            }
        }

        return { isValid: true, error: null };
    },

    // 遅延読み込みの設定
    setupLazyLoading() {
        const images = document.querySelectorAll('.profile-post-item img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        // ネットワーク状況に応じて画像の読み込みを制御
                        if (this.isSlowNetwork()) {
                            // 低速ネットワークの場合はサムネイルのまま
                            img.dataset.loaded = 'true';
                            observer.unobserve(img);
                            return;
                        }
                        
                        // 通常画質画像に切り替え
                        const highQualitySrc = img.dataset.src;
                        if (highQualitySrc && img.src !== highQualitySrc) {
                            const tempImg = new Image();
                            tempImg.onload = () => {
                                img.src = highQualitySrc;
                                img.removeAttribute('data-src');
                                img.dataset.loaded = 'true';
                            };
                            tempImg.src = highQualitySrc;
                        } else if (!highQualitySrc) {
                            // 高画質画像がない場合でもロード済みとしてマーク
                            img.dataset.loaded = 'true';
                        }
                        
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px' // ビューポートの50px手前から読み込み開始
            });
            
            images.forEach(img => imageObserver.observe(img));
        } else {
            // IntersectionObserverがサポートされていない場合のフォールバック
            images.forEach(img => {
                if (this.isSlowNetwork()) {
                    img.dataset.loaded = 'true';
                    return; // 低速ネットワークの場合はサムネイルのまま
                }
                
                const highQualitySrc = img.dataset.src;
                if (highQualitySrc) {
                    img.src = highQualitySrc;
                    img.removeAttribute('data-src');
                    img.dataset.loaded = 'true';
                } else {
                    // 高画質画像がない場合でもロード済みとしてマーク
                    img.dataset.loaded = 'true';
                }
            });
        }
    },

    // ネットワーク速度の判定
    isSlowNetwork() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            // 接続タイプで判定
            if (connection.type === 'cellular') {
                // モバイルネットワークの場合
                if (connection.effectiveType === 'slow-2g' ||
                    connection.effectiveType === '2g' ||
                    connection.effectiveType === '3g') {
                    return true;
                }
            }
            
            // ダウンロード速度で判定
            if (connection.downlink && connection.downlink < 1.5) {
                return true; // 1.5Mbps未満は低速と判定
            }
        }
        
        return false;
    }
};