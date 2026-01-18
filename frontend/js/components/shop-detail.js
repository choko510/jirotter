// ラーメン店詳細ページコンポーネント
const ShopDetailComponent = {
    // 店舗詳細データ
    shopData: null,
    reviewStats: null,
    isHoliday: false,

    // 祝日・年末年始判定
    async checkIfHoliday() {
        const today = new Date();
        const month = today.getMonth() + 1;
        const date = today.getDate();

        // 年末年始 (12/30 - 1/4)
        if ((month === 12 && date >= 30) || (month === 1 && date <= 4)) {
            return true;
        }

        try {
            const cacheKey = 'holiday_data';
            const cacheTimeKey = 'holiday_data_timestamp';
            const cached = localStorage.getItem(cacheKey);
            const timestamp = localStorage.getItem(cacheTimeKey);

            let holidays = {};
            const now = Date.now();

            // Cache valid for 1 day
            if (cached && timestamp && (now - parseInt(timestamp) < 24 * 60 * 60 * 1000)) {
                holidays = JSON.parse(cached);
            } else {
                const response = await fetch('https://holidays-jp.github.io/api/v1/date.json');
                if (!response.ok) return false;
                holidays = await response.json();
                localStorage.setItem(cacheKey, JSON.stringify(holidays));
                localStorage.setItem(cacheTimeKey, now.toString());
            }

            // YYYY-MM-DD format
            const year = today.getFullYear();
            const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

            return !!holidays[formattedDate];
        } catch (e) {
            console.error('Failed to fetch holiday data', e);
            return false;
        }
    },

    // レンダリング
    async render(params) {
        const shopId = params[0];
        if (!shopId) {
            this.renderError('店舗IDが指定されていません');
            return;
        }

        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = '<div class="loading">読み込み中...</div>';

        try {
            // 店舗詳細データと祝日情報を並行して取得
            const [shopResult, isHoliday] = await Promise.all([
                API.getShopDetail(shopId),
                this.checkIfHoliday()
            ]);

            this.isHoliday = isHoliday;

            if (shopResult.success) {
                this.shopData = shopResult.shop;
                this.renderShopDetail();
            } else {
                this.renderError(shopResult.error || '店舗情報の取得に失敗しました');
            }
        } catch (error) {
            console.error('店舗詳細の取得に失敗しました:', error);
            this.renderError('店舗情報の取得に失敗しました');
        }
    },

    // 店舗詳細ページのレンダリング
    renderShopDetail() {
        const contentArea = document.getElementById('contentArea');

        if (!this.shopData) {
            this.renderError('店舗情報がありません');
            return;
        }

        contentArea.innerHTML = `
            <style>
                /* Post-related styles copied from timeline.js */
                .post-card { padding: 16px; border-bottom: 1px solid #e0e0e0; transition: background 0.2s; }
                .post-card:hover { background: #f9f9f9; }
                .post-header { display: flex; gap: 12px; margin-bottom: 12px; cursor: pointer; }
                .post-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--color-primary); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; }
                .post-user-info { flex: 1; }
                .post-username { font-weight: bold; }
                .post-meta { color: #666; font-size: 14px; }
                .post-engagement { display: flex; justify-content: space-around; margin-top: 12px; padding-top: 12px; }
                .engagement-btn { display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: #666; cursor: pointer; }
                .engagement-btn .liked { color: #e0245e; }
                .post-content { line-height: 1.4; }
                .post-content.collapsed { max-height: 4.2em; overflow: hidden; }
                .show-more-btn { background: none; border: none; color: var(--color-primary); cursor: pointer; font-size: 14px; padding: 4px 0; }
                .show-more-btn:hover { text-decoration: underline; }
                .post-image img { width: 100%; border-radius: 16px; margin-top: 12px; }

            </style>
            <div class="shop-detail-container">
                <div class="shop-header">
                    <button class="back-button" onclick="router.goBack()">
                        <i class="fas fa-arrow-left"></i> 戻る
                    </button>
                    <h1 class="shop-name">${this.escapeHtml(this.shopData.name)}</h1>
                </div>
                
                <div class="shop-info-card">
                    <div class="shop-map-container">
                        <div id="shopMap" class="shop-map"></div>
                    </div>
                    
                    <div class="shop-details">
                        <div class="shop-info-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${this.escapeHtml(this.shopData.address)}</span>
                        </div>
                        
                        ${this.shopData.business_hours ? `
                        <div class="shop-info-item">
                            <i class="fas fa-clock"></i>
                            <div>
                                <span>${this.escapeHtml(this.shopData.business_hours)}</span>
                                ${this.isHoliday ? `
                                <div class="holiday-warning">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    ※祝日・年末年始のため、営業時間が変更の可能性があります
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        ` : ''}
                        
                        ${this.shopData.closed_day ? `
                        <div class="shop-info-item">
                            <i class="fas fa-calendar-times"></i>
                            <span>定休日: ${this.escapeHtml(this.shopData.closed_day)}</span>
                        </div>
                        ` : ''}
                        
                        ${this.shopData.seats ? `
                        <div class="shop-info-item">
                            <i class="fas fa-chair"></i>
                            <span>座席: ${this.escapeHtml(this.shopData.seats)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="shop-actions">
                    <button class="action-button primary" onclick="ShopDetailComponent.navigateToMap()">
                        <i class="fas fa-map"></i> MAPで見る
                    </button>
                    <button class="action-button checkin-btn" data-shop-id="${this.shopData.id}" data-checkin-type="manual">
                        <i class="fas fa-map-marker-alt"></i> チェックイン
                    </button>
                    ${this.shopData.latitude && this.shopData.longitude ? `
                    <button class="action-button" onclick="ShopDetailComponent.openInGoogleMaps()">
                        <i class="fas fa-external-link-alt"></i> Googleマップで開く
                    </button>
                    <button class="action-button" onclick="ShopDetailComponent.showDirections()">
                        <i class="fas fa-directions"></i> 経路を表示
                    </button>
                    ` : ''}
                    <button class="action-button" onclick="ShopDetailComponent.shareShop()">
                        <i class="fas fa-share-alt"></i> シェア
                    </button>
                    <button class="action-button ai-ask-btn" onclick="ShopDetailComponent.toggleAiChat()">
                        <i class="fas fa-robot"></i> AIに質問
                    </button>
                </div>
                
                <div class="shop-posts-section">
                    <h2>この店での投稿</h2>
                    <div id="shopPosts" class="posts-container">
                        <div class="loading">投稿を読み込み中...</div>
                    </div>
                </div>

                <div class="shop-reviews-section">
                    <div class="shop-reviews-header">
                        <h2>みんなのレビュー</h2>
                        <div id="shopReviewStats" class="review-stats"></div>
                    </div>
                    <div id="shopReviewList" class="shop-review-list">
                        <div class="loading">レビューを読み込み中...</div>
                    </div>
                    <div id="shopReviewFormContainer" class="shop-review-form"></div>
                </div>
            </div>
            
            <!-- AI Chat Modal -->
            <div id="shopAiChatModal" class="shop-ai-chat-modal" style="display: none;">
                <div class="shop-ai-chat-container">
                    <div class="shop-ai-chat-header">
                        <div class="shop-ai-chat-title">
                            <i class="fas fa-robot"></i> AIに質問
                        </div>
                        <button id="closeShopAiChat" class="close-chat-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="shop-ai-chat-body">
                        <div class="shop-ai-chat-welcome">
                            <p>「${this.escapeHtml(this.shopData.name)}」について質問できます。<br>
                            営業時間や混雑状況、おすすめの頼み方など、お気軽にどうぞ！</p>
                        </div>
                        <div id="shopAiChatMessages" class="shop-ai-chat-messages"></div>
                    </div>
                    <div class="shop-ai-chat-input-area">
                        <textarea id="shopAiChatInput" placeholder="質問を入力してください..." rows="1"></textarea>
                        <button id="sendShopAiChat" class="send-chat-btn" disabled>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 地図を初期化
        this.initializeMap();

        // 店舗関連の投稿を読み込み
        this.loadShopPosts();

        // レビューUIを初期化
        this.renderReviewForm();
        this.loadShopReviews();

        // AIチャットのイベントリスナーを設定
        this.initAiChat();
    },

    // 地図の初期化
    initializeMap() {
        if (!this.shopData || !this.shopData.latitude || !this.shopData.longitude) return;

        setTimeout(() => {
            try {
                const mapElement = document.getElementById('shopMap');
                if (!mapElement) return;

                const map = L.map('shopMap').setView([this.shopData.latitude, this.shopData.longitude], 15);

                // MapLibre GLを使用してmap.jsと同じスタイルに
                L.maplibreGL({
                    style: 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json',
                    maxZoom: 18
                }).addTo(map);

                // 店舗のブランドを判定
                const brand = this.determineBrand(this.shopData.name);
                const brandConfig = this.getBrandConfig(brand);

                // ブランドに応じたマーカーアイコンを作成
                const shopIcon = L.divIcon({
                    html: `
                        <div style="
                            position: relative;
                            width: 30px;
                            height: 30px;
                        ">
                            <div style="
                                position: absolute;
                                top: 0;
                                left: 0;
                                width: 30px;
                                height: 30px;
                                background: ${brandConfig.color};
                                border-radius: 50% 50% 50% 0;
                                border: 2px solid white;
                                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                                transform: rotate(-45deg);
                            "></div>
                            <div style="
                                position: absolute;
                                top: 50%;
                                left: 50%;
                                transform: translate(-50%, -50%);
                                color: ${brandConfig.textColor};
                                font-weight: bold;
                                font-size: 12px;
                            ">${brandConfig.markerText || 'ラ'}</div>
                        </div>
                    `,
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                    popupAnchor: [0, -30],
                    className: 'shop-marker'
                });

                const marker = L.marker([this.shopData.latitude, this.shopData.longitude], { icon: shopIcon }).addTo(map);
                marker.bindPopup(`
                    <div style="max-width: 200px;">
                        <h3 style="margin: 0 0 8px 0;">${this.escapeHtml(this.shopData.name)}</h3>
                        <p style="margin: 0 0 8px 0; font-size: 12px;">${this.escapeHtml(this.shopData.address)}</p>
                        <p style="margin: 0 0 8px 0; font-size: 12px;">ブランド: ${brandConfig.name}</p>
                    </div>
                `).openPopup();
            } catch (error) {
                console.error('地図の初期化に失敗しました:', error);
            }
        }, 100);
    },

    // 店名からブランドを判定する関数（MapUtilsから参照）
    determineBrand(shopName) {
        return MapUtils.determineBrand(shopName);
    },

    // ブランド設定を取得する関数（MapUtilsから参照）
    getBrandConfig(brand) {
        return MapUtils.getBrandConfig(brand);
    },

    async loadShopReviews() {
        if (!this.shopData) return;

        const reviewList = document.getElementById('shopReviewList');
        if (reviewList) {
            reviewList.innerHTML = '<div class="loading">レビューを読み込み中...</div>';
        }

        try {
            const result = await API.getShopReviews(this.shopData.id, { limit: 20 });
            if (!result.success) {
                throw new Error(result.error || 'レビューの取得に失敗しました');
            }

            this.reviewStats = result;
            this.renderReviewStats(result);
            this.renderReviewList(result.reviews);
            this.renderReviewForm({ userReviewId: result.user_review_id });
        } catch (error) {
            console.error('店舗レビューの読み込みに失敗しました:', error);
            if (reviewList) {
                reviewList.innerHTML = `
                    <div class="error">
                        <p>${this.escapeHtml(error.message || 'レビューの取得に失敗しました')}</p>
                    </div>
                `;
            }
            const stats = document.getElementById('shopReviewStats');
            if (stats) {
                stats.innerHTML = '';
            }
        }
    },

    renderReviewStats(data) {
        const statsContainer = document.getElementById('shopReviewStats');
        if (!statsContainer) return;

        if (!data || !data.total) {
            statsContainer.innerHTML = '<p class="no-reviews-hint">この店舗のレビューはまだありません</p>';
            return;
        }

        const averageLabel = typeof data.average_rating === 'number'
            ? data.average_rating.toFixed(1)
            : '–';

        const breakdownHtml = [5, 4, 3, 2, 1].map((rating) => {
            const count = (data.rating_distribution && data.rating_distribution[String(rating)]) || 0;
            const percentage = data.total ? Math.round((count / data.total) * 100) : 0;
            return `
                <div class="rating-row">
                    <span class="rating-label">${rating}</span>
                    <div class="rating-bar">
                        <div class="rating-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="rating-count">${count}</span>
                </div>
            `;
        }).join('');

        statsContainer.innerHTML = `
            <div class="average-rating" aria-label="平均評価 ${averageLabel}">
                <div class="average-rating-value">${averageLabel}</div>
                <div class="average-rating-label">平均評価 (${data.total}件)</div>
            </div>
            <div class="rating-breakdown">${breakdownHtml}</div>
        `;
    },

    renderReviewList(reviews = []) {
        const reviewList = document.getElementById('shopReviewList');
        if (!reviewList) return;

        if (!reviews.length) {
            reviewList.innerHTML = `
                <div class="no-reviews">
                    <i class="fas fa-pen"></i>
                    <p>最初のレビューを書いてこの店を応援しましょう</p>
                </div>
            `;
            return;
        }

        reviewList.innerHTML = reviews.map((review) => this.createReviewCard(review)).join('');
    },

    createReviewCard(review) {
        const avatarUrl = review.author_profile_image_url || 'assets/baseicon.png';
        const username = review.author_username || review.user_id;
        return `
            <article class="review-card">
                <header class="review-card-header">
                    <div class="review-author">
                        <div class="review-avatar">
                            <img src="${API.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(username)}のアイコン">
                        </div>
                        <div>
                            <div class="review-author-name">${this.escapeHtml(username)}</div>
                            <div class="review-date">${this.formatReviewDate(review.created_at)}</div>
                        </div>
                    </div>
                    <div class="review-rating" aria-label="評価 ${review.rating} / 5">
                        ${this.renderStars(review.rating)}
                    </div>
                </header>
                <p class="review-comment">${this.escapeHtml(review.comment)}</p>
            </article>
        `;
    },

    renderStars(rating = 0) {
        const stars = [];
        for (let i = 1; i <= 5; i += 1) {
            const filled = i <= rating;
            stars.push(`<i class="${filled ? 'fas' : 'far'} fa-star"></i>`);
        }
        return stars.join('');
    },

    formatReviewDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('ja-JP', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }).format(date);
        } catch (error) {
            return dateString;
        }
    },

    renderReviewForm(info = {}) {
        const container = document.getElementById('shopReviewFormContainer');
        if (!container) return;

        const currentUser = API.getCurrentUser();
        if (!currentUser) {
            container.innerHTML = `
                <div class="review-form-card review-form-guest">
                    <p>ログインして店舗レビューを投稿しましょう。</p>
                    <button type="button" class="action-button primary" onclick="router.navigate('auth', ['login'])">
                        ログイン / 新規登録
                    </button>
                </div>
            `;
            return;
        }

        if (info.userReviewId) {
            container.innerHTML = `
                <div class="review-form-card review-form-disabled">
                    <p>この店舗には既にレビューを投稿済みです。</p>
                    <p class="review-form-hint">レビューは1店舗につき1件のみ投稿できます。</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <form id="shopReviewForm" class="review-form-card">
                <h3>レビューを投稿</h3>
                <div class="form-row">
                    <label class="review-input-label" for="shopReviewRating">評価</label>
                    <select id="shopReviewRating" required>
                        <option value="5">★★★★★ とにかく最高</option>
                        <option value="4">★★★★☆ かなり満足</option>
                        <option value="3">★★★☆☆ 普通</option>
                        <option value="2">★★☆☆☆ 改善の余地あり</option>
                        <option value="1">★☆☆☆☆ 期待外れ</option>
                    </select>
                </div>
                <div class="form-row">
                    <label class="review-input-label" for="shopReviewComment">レビュー本文</label>
                    <textarea id="shopReviewComment" rows="4" maxlength="1000" placeholder="味・雰囲気・おすすめの食べ方などを共有してください" required></textarea>
                </div>
                <div class="review-form-feedback" id="shopReviewFormFeedback" aria-live="polite"></div>
                <button type="submit" class="action-button primary">レビューを投稿</button>
            </form>
        `;

        const form = document.getElementById('shopReviewForm');
        if (form) {
            form.addEventListener('submit', (event) => this.handleReviewSubmit(event));
        }
    },

    async handleReviewSubmit(event) {
        event.preventDefault();
        if (!this.shopData) return;

        const form = event.target;
        const ratingEl = document.getElementById('shopReviewRating');
        const commentEl = document.getElementById('shopReviewComment');
        const feedbackEl = document.getElementById('shopReviewFormFeedback');
        const submitButton = form.querySelector('button[type="submit"]');

        const rating = Number(ratingEl.value);
        const comment = commentEl.value.trim();

        if (!comment) {
            if (feedbackEl) {
                feedbackEl.textContent = 'レビュー本文を入力してください。';
                feedbackEl.classList.add('error-text');
            }
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = '投稿中...';
        }
        if (feedbackEl) {
            feedbackEl.textContent = '';
            feedbackEl.classList.remove('error-text', 'success-text');
        }

        try {
            const result = await API.createShopReview(this.shopData.id, { rating, comment });
            if (!result.success) {
                throw new Error(result.error || 'レビューの投稿に失敗しました');
            }

            if (feedbackEl) {
                feedbackEl.textContent = 'レビューを投稿しました。反映まで数秒かかる場合があります。';
                feedbackEl.classList.add('success-text');
            }
            form.reset();
            await this.loadShopReviews();
        } catch (error) {
            console.error('レビュー投稿に失敗しました:', error);
            if (feedbackEl) {
                feedbackEl.textContent = error.message || 'レビューの投稿に失敗しました';
                feedbackEl.classList.add('error-text');
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'レビューを投稿';
            }
        }
    },

    // 店舗関連の投稿を読み込み
    async loadShopPosts() {
        try {
            // 店舗IDで投稿を検索
            const result = await API.getPostsByShopId(this.shopData.id);
            const postsContainer = document.getElementById('shopPosts');

            if (result.success && result.posts.length > 0) {
                postsContainer.innerHTML = result.posts.map(post => TimelineComponent.createPostHTML(post)).join('');

                // イベントリスナーを再設定
                TimelineComponent.attachPostEventListeners();
            } else {
                postsContainer.innerHTML = `
                    <div class="no-posts">
                        <i class="fas fa-utensils"></i>
                        <p>この店での投稿はまだありません</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('店舗投稿の読み込みに失敗しました:', error);
            const postsContainer = document.getElementById('shopPosts');
            postsContainer.innerHTML = `
                <div class="error">
                    <p>投稿の読み込みに失敗しました</p>
                </div>
            `;
        }
    },

    // MAPページに移動
    navigateToMap() {
        if (this.shopData && this.shopData.latitude && this.shopData.longitude) {
            // MAPページに移動し、この店を中心に表示
            router.navigate('map', [this.shopData.latitude, this.shopData.longitude, this.shopData.id]);
        }
    },

    // Googleマップで店舗を開く
    openInGoogleMaps() {
        if (!this.shopData || !this.shopData.latitude || !this.shopData.longitude) return;

        const url = `https://www.google.com/maps?q=${this.shopData.latitude},${this.shopData.longitude}`;
        window.open(url, '_blank');
    },

    // Googleマップで経路を表示
    showDirections() {
        if (!this.shopData || !this.shopData.latitude || !this.shopData.longitude) return;

        // 現在地を取得して経路を表示
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${this.shopData.latitude},${this.shopData.longitude}`;
                    window.open(url, '_blank');
                },
                (error) => {
                    console.error('現在地の取得に失敗しました:', error);
                    // 現在地が取得できない場合は目的地のみでGoogleマップを開く
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${this.shopData.latitude},${this.shopData.longitude}`;
                    window.open(url, '_blank');
                }
            );
        } else {
            // ブラウザが位置情報をサポートしていない場合
            const url = `https://www.google.com/maps/dir/?api=1&destination=${this.shopData.latitude},${this.shopData.longitude}`;
            window.open(url, '_blank');
        }
    },

    // 店舗情報をシェア
    shareShop() {
        if (!this.shopData) return;

        const shareText = `${this.shopData.name}\n${this.shopData.address}\n#ラーメンSNS`;
        const shareUrl = `${window.location.origin}/#shop/${this.shopData.id}`;

        if (navigator.share) {
            navigator.share({
                title: this.shopData.name,
                text: shareText,
                url: shareUrl
            }).catch(err => console.log('シェアがキャンセルされました', err));
        } else {
            // クリップボードにコピー
            navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
                alert('店舗情報をクリップボードにコピーしました');
            }).catch(err => {
                console.error('クリップボードへのコピーに失敗しました:', err);
                alert('コピーに失敗しました');
            });
        }
    },

    // エラーページのレンダリング
    renderError(message) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="error">
                <div>
                    <h2>エラー</h2>
                    <p>${message}</p>
                    <button onclick="router.goBack()" style="margin-top: 16px; padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">戻る</button>
                </div>
            </div>
        `;
    },

    // HTMLエスケープ処理
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // AIチャットの初期化
    initAiChat() {
        const closeBtn = document.getElementById('closeShopAiChat');

        if (!closeBtn) return;

        // 閉じるボタン
        closeBtn.addEventListener('click', () => this.toggleAiChat());

        // 共通ユーティリティを使って入力イベントを設定
        AiChatUtils.setupInputEvents(
            'shopAiChatInput',
            'sendShopAiChat',
            () => this.sendAiQuestion()
        );
    },

    // AIチャットモーダルの表示/非表示を切り替え
    toggleAiChat() {
        const modal = document.getElementById('shopAiChatModal');
        const input = document.getElementById('shopAiChatInput');

        if (!modal) return;

        // ログインチェック
        const currentUser = API.getCurrentUser();
        if (!currentUser) {
            alert('AIに質問するにはログインが必要です');
            router.navigate('auth', ['login']);
            return;
        }

        const isVisible = modal.style.display === 'flex';
        modal.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible && input) {
            setTimeout(() => input.focus(), 100);
        }
    },

    // AIに質問を送信
    async sendAiQuestion() {
        const input = document.getElementById('shopAiChatInput');

        if (!input || !this.shopData) return;

        const question = input.value.trim();
        if (!question) return;

        const containerId = 'shopAiChatMessages';

        // ユーザーの質問を表示（共通ユーティリティを使用）
        AiChatUtils.appendMessage(containerId, question, 'user', false, 'shop-ai-msg');

        // 入力をクリア
        AiChatUtils.clearInput('shopAiChatInput', 'sendShopAiChat');

        // ローディング表示
        const loadingId = AiChatUtils.appendLoading(containerId, 'shop-ai-loading');

        try {
            const response = await fetch(`/api/v1/ramen/${this.shopData.id}/ask`, {
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
                AiChatUtils.appendMessage(containerId, errorMessage, 'ai', true, 'shop-ai-msg');
                return;
            }

            const data = await response.json();
            AiChatUtils.appendMessage(containerId, data.answer, 'ai', false, 'shop-ai-msg');

        } catch (error) {
            console.error('AI質問エラー:', error);
            AiChatUtils.removeMessage(loadingId);
            AiChatUtils.appendMessage(
                containerId,
                '申し訳ありません。通信エラーが発生しました。もう一度お試しください。',
                'ai',
                true,
                'shop-ai-msg'
            );
        }
    }
};

// CSSスタイルを追加
const shopDetailStyles = document.createElement('style');
shopDetailStyles.textContent = `
    .checkin-btn {
        background: var(--color-primary);
        color: white;
        border: none;
        transition: all 0.2s;
    }
    
    .checkin-btn:hover {
        background: #c19663;
    }
    
    .ai-ask-btn {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        border: none;
    }
    
    .ai-ask-btn:hover {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    }

    .holiday-warning {
        margin-top: 4px;
        color: #d32f2f;
        font-size: 0.9em;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 6px;
        background: #ffebee;
        padding: 4px 8px;
        border-radius: 4px;
    }
    
    /* Shop AI Chat Modal */
    .shop-ai-chat-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }
    
    .shop-ai-chat-container {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 480px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
    }
    
    .shop-ai-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
    }
    
    .shop-ai-chat-title {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .shop-ai-chat-title i {
        font-size: 20px;
    }
    
    .close-chat-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    }
    
    .close-chat-btn:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    .shop-ai-chat-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        min-height: 200px;
        max-height: 50vh;
    }
    
    .shop-ai-chat-welcome {
        background: linear-gradient(135deg, #f0f4ff 0%, #e8e0ff 100%);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        text-align: center;
    }
    
    .shop-ai-chat-welcome p {
        margin: 0;
        color: #4c1d95;
        font-size: 14px;
        line-height: 1.5;
    }
    
    .shop-ai-chat-messages {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .chat-message {
        max-width: 85%;
        padding: 12px 16px;
        border-radius: 16px;
        animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .user-message {
        align-self: flex-end;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        border-bottom-right-radius: 4px;
    }
    
    .ai-message {
        align-self: flex-start;
        background: #f3f4f6;
        color: #1f2937;
        border-bottom-left-radius: 4px;
    }
    
    .error-message {
        background: #fee2e2;
        color: #991b1b;
    }
    
    .message-content {
        line-height: 1.5;
        word-break: break-word;
    }
    
    .message-time {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 4px;
        text-align: right;
    }
    
    .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 4px 0;
    }
    
    .typing-indicator span {
        width: 8px;
        height: 8px;
        background: #9ca3af;
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out;
    }
    
    .typing-indicator span:nth-child(1) { animation-delay: 0s; }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-8px); }
    }
    
    .shop-ai-chat-input-area {
        display: flex;
        gap: 8px;
        padding: 16px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
    }
    
    .shop-ai-chat-input-area textarea {
        flex: 1;
        border: 1px solid #d1d5db;
        border-radius: 12px;
        padding: 12px;
        resize: none;
        font-size: 14px;
        font-family: inherit;
        line-height: 1.4;
        min-height: 44px;
        max-height: 100px;
        transition: border-color 0.2s;
    }
    
    .shop-ai-chat-input-area textarea:focus {
        outline: none;
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    
    .send-chat-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
    }
    
    .send-chat-btn:disabled {
        background: #d1d5db;
        cursor: not-allowed;
    }
    
    .send-chat-btn:not(:disabled):hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }
`;
document.head.appendChild(shopDetailStyles);

// グローバルに公開
window.ShopDetailComponent = ShopDetailComponent;