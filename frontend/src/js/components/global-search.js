// グローバル検索コンポーネント
// 店舗・ポスト・ユーザーを横断的に検索する
const GlobalSearch = {
    state: {
        query: '',
        results: {
            shops: [],
            posts: [],
            users: [],
            total_shops: 0,
            total_posts: 0,
            total_users: 0
        },
        suggestions: [],
        popularShops: [],
        isSearching: false,
        isLoadingSuggestions: false,
        isModalOpen: false,
        activeTab: 'all', // 'all', 'shops', 'posts', 'users'
        searchHistory: [],
        showSuggestions: true,
        trendKeywords: ['#マシマシ', '#ニンニク', '#小ラーメン', '#新店情報']
    },

    // 検索モーダルを開く
    openModal() {
        this.state.isModalOpen = true;
        this.state.query = '';
        this.state.results = {
            shops: [],
            posts: [],
            users: [],
            total_shops: 0,
            total_posts: 0,
            total_users: 0
        };
        this.state.suggestions = [];
        this.state.activeTab = 'all';
        this.loadSearchHistory();
        this.loadSuggestions(); // サジェストを読み込み
        this.renderModal();

        // 検索入力にフォーカス
        setTimeout(() => {
            const searchInput = document.getElementById('globalSearchInput');
            if (searchInput) searchInput.focus();
        }, 100);
    },

    // サジェストを読み込み
    async loadSuggestions(query = '') {
        this.state.isLoadingSuggestions = true;

        try {
            const params = new URLSearchParams({ q: query, limit: 8 });
            const response = await API.request(`/api/v1/search/suggest?${params.toString()}`, {
                includeAuth: false
            });

            this.state.suggestions = response.suggestions || [];
            this.state.popularShops = response.popular_shops || [];
        } catch (error) {
            console.error('サジェスト読み込みエラー:', error);
            this.state.suggestions = [];
            this.state.popularShops = [];
        } finally {
            this.state.isLoadingSuggestions = false;
            // クエリが短い場合のみ更新（検索結果がある場合は上書きしない）
            if (this.state.query.length < 2) {
                this.updateContent();
            }
        }
    },

    // 検索モーダルを閉じる
    closeModal() {
        this.state.isModalOpen = false;
        const modal = document.querySelector('.global-search-overlay');
        if (modal) modal.remove();
    },

    // 検索履歴を読み込み
    loadSearchHistory() {
        try {
            const history = localStorage.getItem('globalSearchHistory');
            this.state.searchHistory = history ? JSON.parse(history) : [];
        } catch (e) {
            this.state.searchHistory = [];
        }
    },

    // 検索履歴を保存
    saveSearchHistory(query) {
        if (!query || query.length < 2) return;

        // 重複を削除して先頭に追加
        this.state.searchHistory = [
            query,
            ...this.state.searchHistory.filter(q => q !== query)
        ].slice(0, 10); // 最大10件

        try {
            localStorage.setItem('globalSearchHistory', JSON.stringify(this.state.searchHistory));
        } catch (e) {
            console.error('検索履歴の保存に失敗しました:', e);
        }
    },

    // 検索履歴を削除
    clearSearchHistory() {
        this.state.searchHistory = [];
        localStorage.removeItem('globalSearchHistory');
        this.updateContent();
    },

    // 個別の履歴を削除
    removeFromHistory(query) {
        this.state.searchHistory = this.state.searchHistory.filter(q => q !== query);
        try {
            localStorage.setItem('globalSearchHistory', JSON.stringify(this.state.searchHistory));
        } catch (e) {
            console.error('検索履歴の保存に失敗しました:', e);
        }
        this.updateContent();
    },

    // モーダルをレンダリング
    renderModal() {
        // 既存のモーダルを削除
        const existing = document.querySelector('.global-search-overlay');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'global-search-overlay';
        modal.innerHTML = `
            <div class="global-search-modal">
                <div class="global-search-header">
                    <div class="global-search-input-row">
                        <div class="global-search-input-container">
                            <i class="fas fa-search"></i>
                            <input
                                type="text"
                                id="globalSearchInput"
                                placeholder="店舗、ポスト、ユーザーを検索..."
                                value="${API.escapeHtml(this.state.query)}"
                                autocomplete="off"
                            >
                            <button class="global-search-clear ${this.state.query ? 'visible' : ''}" onclick="GlobalSearch.clearInput()" title="入力をクリア">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </div>
                        <button class="global-search-cancel" onclick="GlobalSearch.closeModal()">
                            キャンセル
                        </button>
                    </div>
                    <div class="global-search-tabs">
                        <button class="global-search-tab ${this.state.activeTab === 'all' ? 'active' : ''}" data-tab="all">
                            <i class="fas fa-layer-group"></i> すべて
                        </button>
                        <button class="global-search-tab ${this.state.activeTab === 'shops' ? 'active' : ''}" data-tab="shops">
                            <i class="fas fa-store"></i> 店舗
                        </button>
                        <button class="global-search-tab ${this.state.activeTab === 'posts' ? 'active' : ''}" data-tab="posts">
                            <i class="fas fa-comment-alt"></i> ポスト
                        </button>
                        <button class="global-search-tab ${this.state.activeTab === 'users' ? 'active' : ''}" data-tab="users">
                            <i class="fas fa-user"></i> ユーザー
                        </button>
                    </div>
                </div>
                <div class="global-search-content" id="globalSearchContent">
                    ${this.renderContent()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupEventListeners();
    },

    // 入力をクリア
    clearInput() {
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) {
            searchInput.value = '';
            this.state.query = '';
            this.state.results = {
                shops: [],
                posts: [],
                users: [],
                total_shops: 0,
                total_posts: 0,
                total_users: 0
            };
            this.state.suggestions = [];
            this.loadSuggestions();
            searchInput.focus();
            this.updateClearButtonVisibility();
        }
    },

    // クリアボタンの表示状態を更新
    updateClearButtonVisibility() {
        const clearBtn = document.querySelector('.global-search-clear');
        if (clearBtn) {
            if (this.state.query) {
                clearBtn.classList.add('visible');
            } else {
                clearBtn.classList.remove('visible');
            }
        }
    },

    // イベントリスナーを設定
    setupEventListeners() {
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.state.query = e.target.value;
                this.updateClearButtonVisibility();
                if (this.state.query.length >= 2) {
                    this.search();
                } else if (this.state.query.length > 0) {
                    // 1文字でもサジェストを表示
                    this.loadSuggestions(this.state.query);
                } else {
                    this.state.results = {
                        shops: [],
                        posts: [],
                        users: [],
                        total_shops: 0,
                        total_posts: 0,
                        total_users: 0
                    };
                    this.state.suggestions = [];
                    this.loadSuggestions(); // 人気のサジェストを再読み込み
                }
            }, 200));

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeModal();
                } else if (e.key === 'Enter' && this.state.query.length >= 2) {
                    this.search();
                }
            });
        }

        // タブ切り替え
        document.querySelectorAll('.global-search-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.state.activeTab = e.target.closest('.global-search-tab').dataset.tab;
                document.querySelectorAll('.global-search-tab').forEach(t => t.classList.remove('active'));
                e.target.closest('.global-search-tab').classList.add('active');
                this.updateContent();
            });
        });

        // オーバーレイクリックで閉じる
        const overlay = document.querySelector('.global-search-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal();
                }
            });
        }
    },

    // デバウンス
    debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    },

    // 検索実行
    async search() {
        if (this.state.query.length < 2) return;

        this.state.isSearching = true;
        this.updateContent();

        try {
            const params = new URLSearchParams({
                q: this.state.query,
                limit: 15
            });

            const response = await API.request(`/api/v1/search?${params.toString()}`, {
                includeAuth: false
            });

            this.state.results = {
                shops: response.shops || [],
                posts: response.posts || [],
                users: response.users || [],
                total_shops: response.total_shops || 0,
                total_posts: response.total_posts || 0,
                total_users: response.total_users || 0
            };

            // 検索履歴を保存
            this.saveSearchHistory(this.state.query);

        } catch (error) {
            console.error('検索エラー:', error);
            this.state.results = {
                shops: [],
                posts: [],
                users: [],
                total_shops: 0,
                total_posts: 0,
                total_users: 0
            };
        } finally {
            this.state.isSearching = false;
            this.updateContent();
        }
    },

    // コンテンツを更新
    updateContent() {
        const contentEl = document.getElementById('globalSearchContent');
        if (contentEl) {
            contentEl.innerHTML = this.renderContent();
        }
    },

    // コンテンツをレンダリング
    renderContent() {
        // 検索中
        if (this.state.isSearching) {
            return `
                <div class="global-search-loading">
                    <div class="global-search-spinner"></div>
                    <p>検索中...</p>
                </div>
            `;
        }

        // クエリがない場合は履歴を表示
        if (this.state.query.length < 2) {
            return this.renderSearchHistory();
        }

        const { shops, posts, users } = this.state.results;
        const hasResults = shops.length > 0 || posts.length > 0 || users.length > 0;

        if (!hasResults) {
            return `
                <div class="global-search-no-results">
                    <i class="fas fa-search"></i>
                    <p>「${API.escapeHtml(this.state.query)}」に一致する結果が見つかりませんでした</p>
                </div>
            `;
        }

        let html = '';

        if (this.state.activeTab === 'all' || this.state.activeTab === 'shops') {
            if (shops.length > 0) {
                html += this.renderShopsSection(shops);
            }
        }

        if (this.state.activeTab === 'all' || this.state.activeTab === 'posts') {
            if (posts.length > 0) {
                html += this.renderPostsSection(posts);
            }
        }

        if (this.state.activeTab === 'all' || this.state.activeTab === 'users') {
            if (users.length > 0) {
                html += this.renderUsersSection(users);
            }
        }

        return html || `
            <div class="global-search-no-results">
                <i class="fas fa-filter"></i>
                <p>選択したカテゴリに結果がありません</p>
            </div>
        `;
    },

    // 検索履歴とサジェストをレンダリング
    renderSearchHistory() {
        let html = '';

        // サジェスト表示（入力があり、かつ検索結果がまだない場合）
        if (this.state.query.length > 0 && this.state.suggestions.length > 0) {
            html += this.renderSuggestions();
        }

        // 検索履歴を最優先で表示（履歴がある場合）
        if (this.state.query.length === 0 && this.state.searchHistory.length > 0) {
            html += `
                <div class="global-search-history">
                    <div class="global-search-history-header">
                        <h4><i class="fas fa-history"></i> 最近の検索</h4>
                        <button class="global-search-clear-history" onclick="GlobalSearch.clearSearchHistory()">
                            クリア
                        </button>
                    </div>
                    <div class="global-search-history-list">
                        ${this.state.searchHistory.map(query => `
                            <button class="global-search-history-item" onclick="GlobalSearch.searchFromHistory('${API.escapeHtml(query)}')">
                                <i class="fas fa-clock"></i>
                                <span>${API.escapeHtml(query)}</span>
                                <button class="global-search-history-remove" onclick="event.stopPropagation(); GlobalSearch.removeFromHistory('${API.escapeHtml(query)}')" title="履歴から削除">
                                    <i class="fas fa-times"></i>
                                </button>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // 人気の店舗（履歴の下に表示）
        if (this.state.query.length === 0 && this.state.popularShops.length > 0) {
            html += `
                <div class="global-search-suggestions">
                    <div class="global-search-suggestions-title">
                        <i class="fas fa-fire"></i> 人気の店舗
                    </div>
                    <div class="global-search-suggestion-list">
                        ${this.state.popularShops.map(shop => `
                            <button class="global-search-suggestion" onclick="GlobalSearch.goToShop(${shop.id})">
                                <i class="fas fa-store"></i>
                                ${API.escapeHtml(shop.text)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // トレンドキーワード（履歴がない場合または履歴の後に表示）
        if (this.state.query.length === 0) {
            html += `
                <div class="global-search-trends">
                    <div class="global-search-suggestions-title">
                        <i class="fas fa-chart-line"></i> トレンドキーワード
                    </div>
                    <div class="global-search-suggestion-list">
                        <button class="global-search-suggestion trend" onclick="GlobalSearch.searchFromHistory('#ニンニク')">
                            <i class="fas fa-hashtag"></i> ニンニク
                        </button>
                        <button class="global-search-suggestion trend" onclick="GlobalSearch.searchFromHistory('#マシマシ')">
                            <i class="fas fa-hashtag"></i> マシマシ
                        </button>
                        <button class="global-search-suggestion trend" onclick="GlobalSearch.searchFromHistory('#新店情報')">
                            <i class="fas fa-hashtag"></i> 新店情報
                        </button>
                        <button class="global-search-suggestion trend" onclick="GlobalSearch.searchFromHistory('限定メニュー')">
                            <i class="fas fa-star"></i> 限定メニュー
                        </button>
                    </div>
                </div>
            `;
        }

        // 何もない場合（初回ユーザー向けヘルプ）- 履歴もトレンドも表示されない場合のフォールバック
        if (!html) {
            html = `
                <div class="global-search-empty">
                    <i class="fas fa-search"></i>
                    <p>店舗名、ポスト内容、ユーザー名で検索できます</p>
                    <div class="global-search-tips">
                        <button class="search-tip-button" onclick="GlobalSearch.searchFromHistory('ラーメン二郎')">
                            <i class="fas fa-store"></i>
                            <span>「ラーメン二郎」で店舗を検索</span>
                        </button>
                        <button class="search-tip-button" onclick="GlobalSearch.searchFromHistory('マシマシ')">
                            <i class="fas fa-comment-alt"></i>
                            <span>「マシマシ」でポストを検索</span>
                        </button>
                    </div>
                </div>
            `;
        }

        return html;
    },

    // サジェストをレンダリング
    renderSuggestions() {
        if (this.state.suggestions.length === 0) return '';

        return `
            <div class="global-search-suggestions">
                <div class="global-search-suggestions-title">
                    <i class="fas fa-lightbulb"></i> 候補
                </div>
                <div class="global-search-suggestion-list">
                    ${this.state.suggestions.map(item => {
            const icon = item.type === 'shop' ? 'fa-store' : 'fa-user';
            const onclick = item.type === 'shop'
                ? `GlobalSearch.goToShop(${item.id})`
                : `GlobalSearch.goToUser('${API.escapeHtml(item.user_id)}')`;
            return `
                            <button class="global-search-suggestion" onclick="${onclick}">
                                <i class="fas ${icon}"></i>
                                ${API.escapeHtml(item.text)}
                            </button>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    },

    // 履歴から検索
    searchFromHistory(query) {
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) {
            searchInput.value = query;
            this.state.query = query;
            this.updateClearButton();
            this.search();
        }
    },

    // 店舗セクションをレンダリング
    renderShopsSection(shops) {
        return `
            <div class="global-search-section">
                <h4 class="global-search-section-title">
                    <i class="fas fa-store"></i> 店舗
                    <span class="global-search-count">${this.state.results.total_shops}件</span>
                </h4>
                <div class="global-search-items">
                    ${shops.map(shop => `
                        <div class="global-search-item global-search-shop" onclick="GlobalSearch.goToShop(${shop.id})">
                            <div class="global-search-item-icon shop-icon">
                                <i class="fas fa-store"></i>
                            </div>
                            <div class="global-search-item-content">
                                <div class="global-search-item-title">${API.escapeHtml(shop.name)}</div>
                                <div class="global-search-item-sub">${API.escapeHtml(shop.address)}</div>
                            </div>
                            <i class="fas fa-chevron-right global-search-item-arrow"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // ポストセクションをレンダリング
    renderPostsSection(posts) {
        return `
            <div class="global-search-section">
                <h4 class="global-search-section-title">
                    <i class="fas fa-comment-alt"></i> ポスト
                    <span class="global-search-count">${this.state.results.total_posts}件</span>
                </h4>
                <div class="global-search-items">
                    ${posts.map(post => `
                        <div class="global-search-item global-search-post" onclick="GlobalSearch.goToPost(${post.id})">
                            <div class="global-search-item-avatar">
                                ${post.author_profile_image_url
                ? `<img src="${API.escapeHtml(post.author_profile_image_url)}" alt="">`
                : `<i class="fas fa-user"></i>`
            }
                            </div>
                            <div class="global-search-item-content">
                                <div class="global-search-item-header">
                                    <span class="global-search-item-author">${API.escapeHtml(post.author_username || post.author_id)}</span>
                                    ${post.shop_name ? `<span class="global-search-item-shop">@ ${API.escapeHtml(post.shop_name)}</span>` : ''}
                                </div>
                                <div class="global-search-item-text">${API.escapeHtml(post.content)}</div>
                                <div class="global-search-item-time">${API.formatTime(post.created_at)}</div>
                            </div>
                            ${post.thumbnail_url ? `
                                <div class="global-search-item-thumb">
                                    <img src="${API.escapeHtml(post.thumbnail_url)}" alt="">
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // ユーザーセクションをレンダリング
    renderUsersSection(users) {
        return `
            <div class="global-search-section">
                <h4 class="global-search-section-title">
                    <i class="fas fa-user"></i> ユーザー
                    <span class="global-search-count">${this.state.results.total_users}件</span>
                </h4>
                <div class="global-search-items">
                    ${users.map(user => `
                        <div class="global-search-item global-search-user" onclick="GlobalSearch.goToUser('${API.escapeHtml(user.id)}')">
                            <div class="global-search-item-avatar">
                                ${user.profile_image_url
                ? `<img src="${API.escapeHtml(user.profile_image_url)}" alt="">`
                : `<i class="fas fa-user"></i>`
            }
                            </div>
                            <div class="global-search-item-content">
                                <div class="global-search-item-title">${API.escapeHtml(user.username || user.id)}</div>
                                <div class="global-search-item-sub">
                                    <span class="global-search-user-rank">${API.escapeHtml(user.rank)}</span>
                                    ${user.bio ? `<span class="global-search-user-bio">${API.escapeHtml(user.bio)}</span>` : ''}
                                </div>
                            </div>
                            <i class="fas fa-chevron-right global-search-item-arrow"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // 店舗ページへ移動
    goToShop(shopId) {
        this.closeModal();
        router.navigate('shop', [shopId]);
    },

    // ポストへ移動（タイムラインをスクロール、または単独表示）
    goToPost(postId) {
        this.closeModal();
        // タイムラインでポストを表示する実装（簡易的にタイムラインへ）
        router.navigate('timeline');
        // TODO: 特定のポストにスクロールする機能を追加可能
    },

    // ユーザーページへ移動
    goToUser(userId) {
        this.closeModal();
        router.navigate('profile', [userId]);
    },

    // 入力をクリア
    clearInput() {
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) {
            searchInput.value = '';
            this.state.query = '';
            this.updateClearButton();
            this.state.results = {
                shops: [],
                posts: [],
                users: [],
                total_shops: 0,
                total_posts: 0,
                total_users: 0
            };
            this.state.suggestions = [];
            this.loadSuggestions();
            searchInput.focus();
        }
    },

    // クリアボタンの表示/非表示を更新
    updateClearButton() {
        const clearBtn = document.querySelector('.global-search-clear');
        if (clearBtn) {
            if (this.state.query) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
        }
    },

    // 特定の履歴を削除
    removeFromHistory(query) {
        this.state.searchHistory = this.state.searchHistory.filter(q => q !== query);
        try {
            localStorage.setItem('globalSearchHistory', JSON.stringify(this.state.searchHistory));
        } catch (e) {
            console.error('検索履歴の保存に失敗しました:', e);
        }
        this.updateContent();
    }
};
window.GlobalSearch = GlobalSearch;

// キーボードショートカット（Ctrl+K または Cmd+K で検索モーダルを開く）
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        GlobalSearch.openModal();
    }
});
