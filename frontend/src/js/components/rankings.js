// ランキングコンポーネント
const RankingsComponent = {
    state: {
        topUsers: [],
        you: null,
        totalUsers: 0,
        lastUpdated: null,
        titleCatalog: [],
        isLoading: true,
        error: null,
    },

    async render() {
        this.state.isLoading = true;
        this.state.error = null;
        this.state.topUsers = [];
        this.state.you = null;
        this.state.titleCatalog = [];
        this.fetchRankings();

        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <style>
                .ranking-page {
                    padding: 24px;
                    max-width: 1100px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                }

                .ranking-page__header {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .ranking-page__header h1 {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 800;
                    color: #1f2937;
                }

                .ranking-page__meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: center;
                    color: #6b7280;
                    font-size: 14px;
                }

                .ranking-refresh-button {
                    margin-left: auto;
                    padding: 6px 14px;
                    border-radius: 999px;
                    border: 1px solid #d1d5db;
                    background: #ffffff;
                    color: #374151;
                    cursor: pointer;
                    transition: background 0.2s ease, color 0.2s ease, border 0.2s ease;
                    font-size: 13px;
                }

                .ranking-refresh-button:hover {
                    background: #f3f4f6;
                    border-color: #cbd5f5;
                    color: #1f2937;
                }

                .ranking-content {
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                }

                .ranking-hero {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 18px;
                }

                .ranking-hero-card {
                    position: relative;
                    border-radius: 20px;
                    padding: 22px;
                    background: linear-gradient(145deg, #ffffff 0%, #f5f7ff 100%);
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 18px 42px rgba(79, 70, 229, 0.15);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    min-height: 220px;
                }

                .ranking-hero-card.top-1 {
                    background: linear-gradient(145deg, #fef3c7 0%, #fde68a 100%);
                    border-color: #fcd34d;
                }

                .ranking-hero-card.top-2 {
                    background: linear-gradient(145deg, #e5e7eb 0%, #f3f4f6 100%);
                    border-color: #d1d5db;
                }

                .ranking-hero-card.top-3 {
                    background: linear-gradient(145deg, #f3e8ff 0%, #ede9fe 100%);
                    border-color: #ddd6fe;
                }

                .ranking-position {
                    font-size: 32px;
                    font-weight: 800;
                    color: #111827;
                }

                .ranking-user-name {
                    font-size: 20px;
                    font-weight: 700;
                    color: #111827;
                }

                .ranking-rank-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    border-radius: 999px;
                    background: rgba(17, 24, 39, 0.06);
                    color: #1f2937;
                    font-weight: 600;
                    font-size: 13px;
                }

                .ranking-points {
                    font-size: 26px;
                    font-weight: 800;
                    color: #111827;
                }

                .ranking-featured-title {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    border-radius: 14px;
                    background: rgba(17, 24, 39, 0.08);
                    font-size: 13px;
                    color: #1f2937;
                    width: fit-content;
                }

                .ranking-featured-title span {
                    font-weight: 700;
                }

                .ranking-title-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .ranking-title-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 10px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #1f2937;
                    background: rgba(17, 24, 39, 0.05);
                }

                .ranking-section {
                    background: #ffffff;
                    border-radius: 18px;
                    border: 1px solid #e5e7eb;
                    padding: 24px;
                    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
                }

                .ranking-section h2 {
                    margin-top: 0;
                    margin-bottom: 16px;
                    font-size: 20px;
                    color: #1f2937;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .ranking-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .ranking-table thead {
                    background: #f9fafb;
                    text-align: left;
                    font-size: 13px;
                    color: #6b7280;
                }

                .ranking-table th,
                .ranking-table td {
                    padding: 14px 16px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .ranking-table tbody tr {
                    transition: background 0.2s ease, transform 0.2s ease;
                    cursor: pointer;
                }

                .ranking-table tbody tr:hover {
                    background: rgba(59, 130, 246, 0.08);
                }

                .ranking-table tbody tr.is-current-user {
                    background: rgba(59, 130, 246, 0.12);
                }

                .ranking-user-cell {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .ranking-user-handle {
                    font-size: 13px;
                    color: #6b7280;
                }

                .ranking-your-card {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                    border: 1px solid #a7f3d0;
                }

                .ranking-your-card .ranking-points {
                    color: #047857;
                }

                .ranking-progress {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .ranking-progress-track {
                    width: 100%;
                    height: 8px;
                    background: rgba(17, 24, 39, 0.08);
                    border-radius: 999px;
                    overflow: hidden;
                }

                .ranking-progress-fill {
                    height: 100%;
                    border-radius: 999px;
                    transition: width 0.3s ease;
                }

                .title-gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 18px;
                }

                .title-card {
                    border-radius: 16px;
                    border: 1px solid #e5e7eb;
                    background: #ffffff;
                    padding: 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    min-height: 180px;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .title-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
                }

                .title-card--locked {
                    opacity: 0.75;
                    background: #f9fafb;
                }

                .title-card__header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 18px;
                    font-weight: 700;
                    color: #111827;
                }

                .title-card__badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    font-size: 20px;
                    background: rgba(17, 24, 39, 0.08);
                }

                .title-card__description {
                    color: #4b5563;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .title-card__progress {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .title-card__progress-bar {
                    width: 100%;
                    height: 8px;
                    border-radius: 999px;
                    background: rgba(17, 24, 39, 0.08);
                    overflow: hidden;
                }

                .title-card__progress-fill {
                    height: 100%;
                    border-radius: 999px;
                    transition: width 0.3s ease;
                }

                .title-card__requirements {
                    font-size: 13px;
                    color: #6b7280;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .title-card__footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                    color: #6b7280;
                }

                .ranking-empty {
                    padding: 24px;
                    border-radius: 12px;
                    background: #f9fafb;
                    border: 1px dashed #d1d5db;
                    text-align: center;
                    color: #6b7280;
                }

                .ranking-error {
                    padding: 24px;
                    border-radius: 12px;
                    background: #fee2e2;
                    border: 1px solid #fecaca;
                    color: #991b1b;
                    text-align: center;
                }


                @media (max-width: 768px) {
                    .ranking-page {
                        padding: 16px;
                        gap: 20px;
                    }

                    .ranking-section {
                        padding: 18px;
                    }

                    .ranking-table thead {
                        display: none;
                    }

                    .ranking-table tbody tr {
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 6px;
                        padding: 12px 0;
                    }

                    .ranking-table td {
                        border: none;
                        padding: 0;
                    }

                    .ranking-table td + td {
                        margin-top: 6px;
                    }
                }
            </style>
            <div class="ranking-page">
                <div class="ranking-page__header">
                    <h1><i class="fas fa-trophy" aria-hidden="true"></i> コミュニティランキング</h1>
                    <div class="ranking-page__meta">
                        <span id="rankingTotal"></span>
                        <span id="rankingUpdated"></span>
                        <button type="button" class="ranking-refresh-button" id="rankingRefreshBtn">
                            <i class="fas fa-sync-alt" aria-hidden="true"></i> 再読込
                        </button>
                    </div>
                </div>
                <div class="ranking-content" id="rankingContent">
                    <div class="loading">ランキングを読み込み中...</div>
                </div>
            </div>
        `;

        const refreshButton = document.getElementById('rankingRefreshBtn');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                this.state.isLoading = true;
                this.updateDOM();
                this.fetchRankings();
            });
        }
    },

    async fetchRankings(limit = 50) {
        try {
            const data = await API.request(`/api/v1/users/rankings?limit=${limit}`);
            this.state.topUsers = Array.isArray(data.top_users) ? data.top_users.filter(user => user.points > 0) : [];
            this.state.you = data.you || null;
            this.state.totalUsers = data.total_users || 0;
            this.state.lastUpdated = data.last_updated || null;
            this.state.titleCatalog = Array.isArray(data.title_catalog) ? data.title_catalog : [];
            this.state.isLoading = false;
            this.updateDOM();
        } catch (error) {
            console.error('ランキングデータの取得に失敗しました:', error);
            this.state.error = error.message || 'ランキングの取得に失敗しました。';
            this.state.isLoading = false;
            this.updateDOM();
        }
    },

    updateDOM() {
        const container = document.getElementById('rankingContent');
        if (!container) return;

        if (this.state.isLoading) {
            container.innerHTML = '<div class="loading">ランキングを読み込み中...</div>';
            return;
        }

        if (this.state.error) {
            container.innerHTML = `<div class="ranking-error">${API.escapeHtml(this.state.error)}</div>`;
            return;
        }

        container.innerHTML = '';

        const totalSpan = document.getElementById('rankingTotal');
        if (totalSpan) {
            totalSpan.textContent = `参加ユーザー: ${this.formatNumber(this.state.totalUsers)}人`;
        }

        const updatedSpan = document.getElementById('rankingUpdated');
        if (updatedSpan) {
            updatedSpan.textContent = this.state.lastUpdated
                ? `最終更新: ${this.formatDateTime(this.state.lastUpdated)}`
                : '';
        }

        container.appendChild(this.renderHeroSection());
        container.appendChild(this.renderLeaderboardSection());
        container.appendChild(this.renderYourRankingSection());
        container.appendChild(this.renderTitleCatalogSection());
    },

    renderHeroSection() {
        const section = document.createElement('section');
        section.className = 'ranking-hero';

        const topThree = this.state.topUsers.filter(user => user.points > 0).slice(0, 3);
        if (topThree.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ranking-empty';
            empty.textContent = 'まだランキングデータがありません。最初の投稿やチェックインでポイントを獲得しましょう。';
            section.appendChild(empty);
            return section;
        }

        topThree.forEach(entry => {
            section.appendChild(this.createHeroCard(entry));
        });

        return section;
    },

    createHeroCard(entry) {
        const card = document.createElement('article');
        card.className = 'ranking-hero-card';
        if (entry.position <= 3) {
            card.classList.add(`top-${entry.position}`);
        }

        const sanitizedName = API.escapeHtml(entry.username || entry.id);
        const sanitizedRank = API.escapeHtml(entry.rank || '');
        const sanitizedRankDesc = API.escapeHtml(entry.rank_description || '');
        const points = this.formatNumber(entry.points || 0);
        const rankColor = entry.rank_color || '#f59e0b';
        const progress = Math.min(100, Math.max(0, Number(entry.rank_progress_percentage) || 0));

        card.innerHTML = `
            <div class="ranking-position">#${entry.position}</div>
            <div class="ranking-user-name">${sanitizedName}</div>
            <div class="ranking-rank-chip" style="background: ${this.alphaColor(rankColor, 0.15)}; color: ${rankColor};">
                <i class="fas fa-medal" aria-hidden="true"></i>
                <span>${sanitizedRank}</span>
            </div>
            <div class="ranking-points">${points} pt</div>
            <div class="ranking-progress">
                <div class="ranking-progress-track">
                    <div class="ranking-progress-fill" style="background:${rankColor}; width:${progress}%"></div>
                </div>
                <div class="ranking-user-handle">${sanitizedRankDesc}</div>
            </div>
        `;

        if (entry.featured_title) {
            const featured = document.createElement('div');
            featured.className = 'ranking-featured-title';
            featured.innerHTML = `
                <span style="color:${entry.featured_title.theme_color || '#111827'}">${API.escapeHtml(entry.featured_title.icon || '⭐')}</span>
                <span>${API.escapeHtml(entry.featured_title.name || '')}</span>
            `;
            card.appendChild(featured);
        }

        if (Array.isArray(entry.recent_titles) && entry.recent_titles.length > 0) {
            const chips = document.createElement('div');
            chips.className = 'ranking-title-chips';
            entry.recent_titles.forEach(title => {
                if (!title) return;
                const chip = document.createElement('span');
                chip.className = 'ranking-title-chip';
                const color = title.theme_color || '#4b5563';
                chip.style.background = this.alphaColor(color, 0.18);
                chip.style.color = color;
                const icon = title.icon ? `${API.escapeHtml(title.icon)} ` : '';
                chip.innerHTML = `${icon}${API.escapeHtml(title.name || '')}`;
                chips.appendChild(chip);
            });
            card.appendChild(chips);
        }

        card.addEventListener('click', () => router.navigate('profile', [entry.id]));
        return card;
    },

    renderLeaderboardSection() {
        const section = document.createElement('section');
        section.className = 'ranking-section ranking-section--table';

        const heading = document.createElement('h2');
        heading.innerHTML = '<i class="fas fa-crown" aria-hidden="true"></i> トップガイド一覧';
        section.appendChild(heading);

        if (!this.state.topUsers.length) {
            const empty = document.createElement('div');
            empty.className = 'ranking-empty';
            empty.textContent = 'ランキングに表示するユーザーがまだいません。';
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement('table');
        table.className = 'ranking-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th style="width: 70px;">順位</th>
                    <th>ユーザー</th>
                    <th>ランク</th>
                    <th style="width: 120px;">ポイント</th>
                    <th style="width: 120px;">称号数</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        const currentUser = API.getCurrentUser();
        const currentUserId = currentUser ? currentUser.id : null;

        this.state.topUsers.filter(user => user.points > 0).slice(0, 5).forEach(entry => {
            const row = document.createElement('tr');
            if (entry.id === currentUserId) {
                row.classList.add('is-current-user');
            }

            const rankColor = entry.rank_color || '#f59e0b';
            const progress = Math.min(100, Math.max(0, Number(entry.rank_progress_percentage) || 0));
            const featuredTitleName = entry.featured_title ? API.escapeHtml(entry.featured_title.name || '') : '称号未獲得';
            const featuredIcon = entry.featured_title ? API.escapeHtml(entry.featured_title.icon || '⭐') : '☆';

            row.innerHTML = `
                <td>#${entry.position}</td>
                <td>
                    <div class="ranking-user-cell">
                        <strong>${API.escapeHtml(entry.username || entry.id)}</strong>
                        <span class="ranking-user-handle">@${API.escapeHtml(entry.id)}</span>
                    </div>
                </td>
                <td>
                    <div class="ranking-rank-chip" style="background:${this.alphaColor(rankColor, 0.15)}; color:${rankColor};">
                        ${API.escapeHtml(entry.rank)}
                    </div>
                    <div class="ranking-progress-track" style="margin-top:8px;">
                        <div class="ranking-progress-fill" style="background:${rankColor}; width:${progress}%"></div>
                    </div>
                </td>
                <td><strong>${this.formatNumber(entry.points || 0)}</strong> pt</td>
                <td>
                    <div class="ranking-user-cell">
                        <strong>${entry.total_titles || 0} 種類</strong>
                        <span class="ranking-user-handle">${featuredIcon} ${featuredTitleName}</span>
                    </div>
                </td>
            `;

            row.addEventListener('click', () => router.navigate('profile', [entry.id]));
            tbody.appendChild(row);
        });

        section.appendChild(table);
        return section;
    },

    renderYourRankingSection() {
        const section = document.createElement('section');
        section.className = 'ranking-section ranking-your-card';

        const heading = document.createElement('h2');
        heading.innerHTML = '<i class="fas fa-user-circle" aria-hidden="true"></i> あなたのランキング';
        section.appendChild(heading);

        if (!this.state.you) {
            const empty = document.createElement('div');
            empty.className = 'ranking-empty';
            empty.innerHTML = 'ログインすると自分のランキングが表示されます。<br>チェックインや投稿でポイントを貯めましょう！';
            section.appendChild(empty);
            return section;
        }

        const entry = this.state.you;
        const rankColor = entry.rank_color || '#059669';
        const sanitizedRank = API.escapeHtml(entry.rank || '');
        const sanitizedDesc = API.escapeHtml(entry.rank_description || '');
        const progress = Math.min(100, Math.max(0, Number(entry.rank_progress_percentage) || 0));
        const nextRankLabel = entry.next_rank_name
            ? `次のランク「${API.escapeHtml(entry.next_rank_name)}」まであと${entry.points_to_next_rank ?? 0}pt`
            : '最高ランクに到達しています！';

        const info = document.createElement('div');
        info.innerHTML = `
            <div class="ranking-position">現在の順位: #${entry.position}</div>
            <div class="ranking-points">${this.formatNumber(entry.points || 0)} pt</div>
            <div class="ranking-rank-chip" style="background:${this.alphaColor(rankColor, 0.2)}; color:${rankColor};">
                <i class="fas fa-medal" aria-hidden="true"></i> ${sanitizedRank}
            </div>
            <div class="ranking-progress" style="margin-top:10px;">
                <div class="ranking-progress-track">
                    <div class="ranking-progress-fill" style="background:${rankColor}; width:${progress}%"></div>
                </div>
                <div class="ranking-user-handle">${nextRankLabel}</div>
                <div class="ranking-user-handle">${sanitizedDesc}</div>
            </div>
        `;
        section.appendChild(info);

        if (entry.featured_title) {
            const featured = document.createElement('div');
            featured.className = 'ranking-featured-title';
            featured.innerHTML = `
                <span style="color:${entry.featured_title.theme_color || '#047857'}">${API.escapeHtml(entry.featured_title.icon || '⭐')}</span>
                <span>${API.escapeHtml(entry.featured_title.name || '')}</span>
            `;
            section.appendChild(featured);
        }

        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'profile-action-button';
        action.textContent = 'プロフィールで称号を確認する';
        action.addEventListener('click', () => router.navigate('profile', [entry.id]));
        section.appendChild(action);

        return section;
    },

    renderTitleCatalogSection() {
        const section = document.createElement('section');
        section.className = 'ranking-section ranking-title-section';

        const heading = document.createElement('h2');
        heading.innerHTML = '<i class="fas fa-award" aria-hidden="true"></i> 称号ギャラリー';
        section.appendChild(heading);

        const gallery = document.createElement('div');
        gallery.className = 'title-gallery';

        if (!this.state.titleCatalog.length) {
            const empty = document.createElement('div');
            empty.className = 'ranking-empty';
            empty.textContent = '称号データがまだありません。';
            section.appendChild(empty);
            return section;
        }

        this.state.titleCatalog.forEach(title => {
            const card = document.createElement('article');
            card.className = 'title-card';
            if (!title.unlocked) {
                card.classList.add('title-card--locked');
            }

            const color = title.theme_color || '#2563eb';
            const progress = title.unlocked ? 100 : Math.min(100, Math.max(0, Number(title.progress) || 0));
            const progressLabel = API.escapeHtml(title.progress_label || '進捗');
            const icon = API.escapeHtml(title.icon || '🏅');
            const name = API.escapeHtml(title.name || title.key);
            const description = API.escapeHtml(title.description || '');

            card.innerHTML = `
                <div class="title-card__header">
                    <div class="title-card__badge" style="background:${this.alphaColor(color, 0.18)}; color:${color};">${icon}</div>
                    <div>${name}</div>
                </div>
                <div class="title-card__description">${description}</div>
                <div class="title-card__progress">
                    <div class="title-card__progress-bar">
                        <div class="title-card__progress-fill" style="width:${progress}%; background:${color};"></div>
                    </div>
                    <div class="ranking-user-handle">${progressLabel}: ${progress}%</div>
                </div>
            `;

            if (Array.isArray(title.requirements) && title.requirements.length > 0) {
                const req = document.createElement('div');
                req.className = 'title-card__requirements';
                title.requirements.forEach(item => {
                    const label = API.escapeHtml(item.label || item.metric);
                    req.innerHTML += `${label}: ${this.formatNumber(item.current || 0)} / ${this.formatNumber(item.required || 0)}<br>`;
                });
                card.appendChild(req);
            }

            const footer = document.createElement('div');
            footer.className = 'title-card__footer';
            footer.innerHTML = title.unlocked
                ? `<span>獲得日: ${this.formatDate(title.earned_at)}</span><span>プレミア度: ${title.prestige || 0}</span>`
                : `<span>未獲得</span><span>プレミア度: ${title.prestige || 0}</span>`;
            card.appendChild(footer);

            gallery.appendChild(card);
        });

        section.appendChild(gallery);
        return section;
    },

    formatNumber(value) {
        if (typeof value !== 'number') {
            value = Number(value) || 0;
        }
        return value.toLocaleString('ja-JP');
    },

    formatDateTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const datePart = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        const timePart = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        return `${datePart} ${timePart}`;
    },

    formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    },

    alphaColor(hex, alpha = 0.2) {
        if (!hex) return `rgba(17, 24, 39, ${alpha})`;
        const sanitized = hex.replace('#', '');
        if (sanitized.length !== 6) return `rgba(17, 24, 39, ${alpha})`;
        const r = parseInt(sanitized.slice(0, 2), 16);
        const g = parseInt(sanitized.slice(2, 4), 16);
        const b = parseInt(sanitized.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },
};
window.RankingsComponent = RankingsComponent;
