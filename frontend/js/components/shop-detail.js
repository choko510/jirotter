// ラーメン店詳細ページコンポーネント
const ShopDetailComponent = {
    // 店舗詳細データ
    shopData: null,
    
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
            // 店舗詳細データを取得
            const result = await API.getShopDetail(shopId);
            if (result.success) {
                this.shopData = result.shop;
                this.renderShopDetail();
            } else {
                this.renderError(result.error || '店舗情報の取得に失敗しました');
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
        
        const brandKey = this.determineBrand(this.shopData.name);
        const brandConfig = this.getBrandConfig(brandKey);
        const brandBadge = `
            <span class="shop-brand-badge" style="background:${brandConfig.color}; color:${brandConfig.textColor};">
                <i class="fas fa-tag"></i>${this.escapeHtml(brandConfig.name)}
            </span>
        `;

        const metaItems = [];
        if (this.shopData.business_hours) {
            metaItems.push({
                icon: 'fas fa-clock',
                label: '営業時間',
                value: this.escapeHtml(this.shopData.business_hours)
            });
        }
        if (this.shopData.closed_day) {
            metaItems.push({
                icon: 'fas fa-calendar-check',
                label: '定休日',
                value: this.escapeHtml(this.shopData.closed_day)
            });
        }
        if (this.shopData.seats) {
            metaItems.push({
                icon: 'fas fa-chair',
                label: '座席数',
                value: this.escapeHtml(this.shopData.seats)
            });
        }

        const metaHtml = metaItems.length > 0
            ? metaItems.map(item => `
                        <div class="shop-meta-card">
                            <div class="shop-meta-icon"><i class="${item.icon}"></i></div>
                            <div class="shop-meta-label">${item.label}</div>
                            <div class="shop-meta-value">${item.value}</div>
                        </div>
                    `).join('')
            : `<div class="shop-meta-empty"><i class="fas fa-info-circle"></i>店舗の詳細情報は順次更新予定です。</div>`;

        const locationButtons = (this.shopData.latitude && this.shopData.longitude) ? `
                    <button class="action-button secondary" onclick="ShopDetailComponent.openInGoogleMaps()">
                        <i class="fas fa-external-link-alt"></i>Googleマップで開く
                    </button>
                    <button class="action-button secondary" onclick="ShopDetailComponent.showDirections()">
                        <i class="fas fa-directions"></i>経路を表示
                    </button>
        ` : '';

        const sanitizedAddress = this.escapeHtml(this.shopData.address || '住所情報が登録されていません');

        contentArea.innerHTML = `
            <style>
                .shop-detail-page {
                    min-height: calc(100vh - 70px);
                    padding: 32px 18px 64px;
                    background: radial-gradient(120% 160% at 50% -20%, #fff8ed 0%, #f4e7d7 45%, #efe1cf 100%);
                    display: flex;
                    justify-content: center;
                }

                .dark-mode .shop-detail-page {
                    background: radial-gradient(120% 160% at 50% -20%, #1a130c 0%, #140f0a 45%, #0d0906 100%);
                }

                .shop-detail-wrapper {
                    width: 100%;
                    max-width: 1080px;
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .shop-hero {
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(212, 165, 116, 0.3);
                    border-radius: 32px;
                    padding: 32px;
                    box-shadow: 0 32px 56px rgba(212, 165, 116, 0.2);
                    backdrop-filter: blur(18px);
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .dark-mode .shop-hero {
                    background: rgba(24, 24, 24, 0.92);
                    border-color: rgba(212, 165, 116, 0.35);
                    box-shadow: 0 32px 60px rgba(0, 0, 0, 0.55);
                    color: #f6d9a3;
                }

                .back-button {
                    align-self: flex-start;
                    padding: 10px 20px;
                    border-radius: 999px;
                    border: 1px solid rgba(212, 165, 116, 0.35);
                    background: rgba(212, 165, 116, 0.12);
                    color: #7b552d;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                }

                .back-button:hover {
                    transform: translateY(-1px);
                    background: rgba(212, 165, 116, 0.2);
                    box-shadow: 0 16px 24px rgba(212, 165, 116, 0.25);
                }

                .dark-mode .back-button {
                    background: rgba(212, 165, 116, 0.18);
                    color: #1f1200;
                    border-color: rgba(212, 165, 116, 0.4);
                }

                .shop-hero-header {
                    display: flex;
                    align-items: baseline;
                    gap: 16px;
                    flex-wrap: wrap;
                }

                .shop-name {
                    font-size: 34px;
                    margin: 0;
                    color: #2f1b00;
                    font-weight: 800;
                }

                .dark-mode .shop-name {
                    color: #f6d9a3;
                }

                .shop-brand-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 16px;
                    border-radius: 999px;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
                }

                .shop-brand-badge i {
                    font-size: 14px;
                }

                .shop-address {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 15px;
                    color: #6b5948;
                    margin: 0;
                }

                .dark-mode .shop-address {
                    color: #d7cfc2;
                }

                .shop-meta-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 16px;
                }

                .shop-meta-card {
                    background: rgba(212, 165, 116, 0.12);
                    border: 1px solid rgba(212, 165, 116, 0.3);
                    border-radius: 20px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .shop-meta-icon {
                    font-size: 18px;
                    color: #d88c32;
                }

                .shop-meta-label {
                    font-size: 13px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #8a735d;
                    font-weight: 700;
                }

                .shop-meta-value {
                    font-size: 16px;
                    color: #3b2614;
                    font-weight: 600;
                }

                .shop-meta-empty {
                    grid-column: 1 / -1;
                    background: rgba(255, 255, 255, 0.85);
                    border: 1px dashed rgba(212, 165, 116, 0.4);
                    border-radius: 20px;
                    padding: 18px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #7d6a58;
                    font-weight: 600;
                }

                .shop-overview-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
                    gap: 24px;
                    align-items: stretch;
                }

                .shop-map-card {
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(212, 165, 116, 0.28);
                    border-radius: 32px;
                    padding: 24px;
                    box-shadow: 0 26px 48px rgba(212, 165, 116, 0.18);
                    backdrop-filter: blur(16px);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .dark-mode .shop-map-card {
                    background: rgba(24, 24, 24, 0.92);
                    border-color: rgba(212, 165, 116, 0.32);
                    box-shadow: 0 28px 58px rgba(0, 0, 0, 0.55);
                }

                .shop-map {
                    width: 100%;
                    height: 340px;
                    border-radius: 24px;
                    overflow: hidden;
                }

                .shop-map-note {
                    font-size: 13px;
                    color: #7d6a58;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .dark-mode .shop-map-note {
                    color: #d7cfc2;
                }

                .shop-action-card {
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid rgba(212, 165, 116, 0.28);
                    border-radius: 32px;
                    padding: 24px;
                    box-shadow: 0 24px 44px rgba(212, 165, 116, 0.18);
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .dark-mode .shop-action-card {
                    background: rgba(24, 24, 24, 0.9);
                    border-color: rgba(212, 165, 116, 0.32);
                    box-shadow: 0 28px 54px rgba(0, 0, 0, 0.55);
                }

                .shop-action-title {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 700;
                    color: #3b2614;
                }

                .dark-mode .shop-action-title {
                    color: #f6d9a3;
                }

                .shop-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .action-button {
                    width: 100%;
                    padding: 14px 18px;
                    border-radius: 18px;
                    border: 1px solid rgba(212, 165, 116, 0.35);
                    background: rgba(212, 165, 116, 0.12);
                    color: #7b552d;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                }

                .action-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 16px 28px rgba(212, 165, 116, 0.25);
                }

                .action-button.primary {
                    background: linear-gradient(135deg, #f6c46b 0%, #e09a3a 100%);
                    color: #2f1b00;
                    border: none;
                    box-shadow: 0 18px 32px rgba(224, 154, 58, 0.35);
                }

                .action-button.checkin-btn {
                    background: linear-gradient(135deg, #7dd87d 0%, #45b445 100%);
                    color: #0f2d0f;
                    border: none;
                    box-shadow: 0 18px 32px rgba(69, 180, 69, 0.28);
                }

                .action-button.secondary {
                    background: rgba(212, 165, 116, 0.16);
                    color: #7b552d;
                }

                .action-button.ghost {
                    background: transparent;
                    border-style: dashed;
                    color: #7b552d;
                }

                .dark-mode .action-button {
                    border-color: rgba(212, 165, 116, 0.32);
                    color: #f6d9a3;
                    background: rgba(212, 165, 116, 0.14);
                }

                .dark-mode .action-button.primary {
                    color: #1f1200;
                }

                .dark-mode .action-button.ghost {
                    background: rgba(212, 165, 116, 0.12);
                    color: #f6d9a3;
                }

                .shop-action-tip {
                    font-size: 13px;
                    color: #7d6a58;
                }

                .dark-mode .shop-action-tip {
                    color: #d7cfc2;
                }

                .shop-posts-section {
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid rgba(212, 165, 116, 0.28);
                    border-radius: 32px;
                    padding: 28px;
                    box-shadow: 0 28px 52px rgba(212, 165, 116, 0.2);
                    backdrop-filter: blur(16px);
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .dark-mode .shop-posts-section {
                    background: rgba(24, 24, 24, 0.92);
                    border-color: rgba(212, 165, 116, 0.32);
                    box-shadow: 0 32px 58px rgba(0, 0, 0, 0.55);
                }

                .shop-posts-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .shop-posts-header h2 {
                    margin: 0;
                    font-size: 24px;
                    color: #3b2614;
                }

                .dark-mode .shop-posts-header h2 {
                    color: #f6d9a3;
                }

                #shopPosts {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .post-card {
                    background: rgba(255, 255, 255, 0.95);
                    border: 1px solid rgba(212, 165, 116, 0.25);
                    border-radius: 22px;
                    padding: 20px;
                    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.08);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    cursor: pointer;
                }

                .post-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 24px 42px rgba(0, 0, 0, 0.12);
                }

                .post-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                    margin-bottom: 12px;
                }

                .post-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 16px;
                    overflow: hidden;
                    background: linear-gradient(135deg, #f6c46b 0%, #e09a3a 100%);
                    box-shadow: 0 12px 20px rgba(224, 154, 58, 0.25);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .post-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .post-username {
                    font-weight: 700;
                    color: #3b2614;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .post-meta {
                    font-size: 13px;
                    color: #7d6a58;
                }

                .post-text {
                    color: #3d2d1e;
                    font-size: 15px;
                    line-height: 1.7;
                }

                .show-more-btn {
                    background: none;
                    border: none;
                    color: #d4882a;
                    cursor: pointer;
                    font-weight: 600;
                    padding: 6px 0;
                }

                .shop-reference {
                    margin-top: 14px;
                    padding: 14px 16px;
                    background: rgba(212, 165, 116, 0.12);
                    border-radius: 16px;
                    border: 1px solid rgba(212, 165, 116, 0.25);
                    color: #8a6233;
                    font-weight: 600;
                }

                .post-engagement {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    margin-top: 18px;
                    padding-top: 14px;
                    border-top: 1px solid rgba(212, 165, 116, 0.25);
                }

                .engagement-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: rgba(55, 37, 23, 0.05);
                    border: 1px solid transparent;
                    border-radius: 14px;
                    color: #72553a;
                    cursor: pointer;
                    padding: 10px 12px;
                    transition: background 0.2s ease, transform 0.2s ease;
                }

                .engagement-btn:hover {
                    background: rgba(55, 37, 23, 0.08);
                    transform: translateY(-1px);
                }

                .loading,
                .no-posts,
                .error {
                    text-align: center;
                    padding: 32px 16px;
                    color: #7d6a58;
                }

                .no-posts i {
                    font-size: 24px;
                    margin-bottom: 12px;
                    color: #d88c32;
                }

                .dark-mode .shop-meta-card {
                    background: rgba(212, 165, 116, 0.16);
                    border-color: rgba(212, 165, 116, 0.35);
                }

                .dark-mode .shop-meta-label {
                    color: #d7cfc2;
                }

                .dark-mode .shop-meta-value {
                    color: #f6d9a3;
                }

                .dark-mode .shop-meta-empty {
                    background: rgba(24, 24, 24, 0.9);
                    border-color: rgba(212, 165, 116, 0.35);
                    color: #d7cfc2;
                }

                .dark-mode .shop-map {
                    border-radius: 24px;
                }

                .dark-mode .action-button.secondary,
                .dark-mode .action-button.ghost {
                    color: #f6d9a3;
                }

                .dark-mode .shop-posts-section {
                    color: #f6d9a3;
                }

                .dark-mode .post-card {
                    background: rgba(28, 28, 28, 0.95);
                    border-color: rgba(212, 165, 116, 0.32);
                    box-shadow: 0 24px 52px rgba(0, 0, 0, 0.55);
                }

                .dark-mode .post-username {
                    color: #f6d9a3;
                }

                .dark-mode .post-meta,
                .dark-mode .post-text,
                .dark-mode .shop-reference,
                .dark-mode .engagement-btn,
                .dark-mode .loading,
                .dark-mode .no-posts,
                .dark-mode .error {
                    color: #d7cfc2;
                }

                .dark-mode .shop-reference {
                    background: rgba(212, 165, 116, 0.16);
                    border-color: rgba(212, 165, 116, 0.35);
                }

                .dark-mode .post-engagement {
                    border-top-color: rgba(212, 165, 116, 0.28);
                }

                @media (max-width: 960px) {
                    .shop-overview-grid {
                        grid-template-columns: 1fr;
                    }

                    .shop-map {
                        height: 300px;
                    }
                }

                @media (max-width: 640px) {
                    .shop-detail-page {
                        padding: 24px 12px 48px;
                    }

                    .shop-hero,
                    .shop-map-card,
                    .shop-action-card,
                    .shop-posts-section {
                        padding: 22px;
                        border-radius: 24px;
                    }

                    .shop-name {
                        font-size: 28px;
                    }
                }
            </style>

            <div class="shop-detail-page">
                <div class="shop-detail-wrapper">
                    <div class="shop-hero">
                        <button class="back-button" onclick="router.navigate('search')">
                            <i class="fas fa-arrow-left"></i><span>戻る</span>
                        </button>
                        <div class="shop-hero-header">
                            <h1 class="shop-name">${this.escapeHtml(this.shopData.name)}</h1>
                            ${brandBadge}
                        </div>
                        <p class="shop-address"><i class="fas fa-map-marker-alt"></i>${sanitizedAddress}</p>
                        <div class="shop-meta-grid">
                            ${metaHtml}
                        </div>
                    </div>

                    <div class="shop-overview-grid">
                        <div class="shop-map-card">
                            <div id="shopMap" class="shop-map"></div>
                            <p class="shop-map-note"><i class="fas fa-location-arrow"></i>ピンをドラッグして周辺の店舗もチェックできます。</p>
                        </div>
                        <div class="shop-action-card">
                            <h2 class="shop-action-title">アクション</h2>
                            <div class="shop-actions">
                                <button class="action-button primary" onclick="ShopDetailComponent.navigateToMap()">
                                    <i class="fas fa-map"></i>MAPで見る
                                </button>
                                <button class="action-button checkin-btn" data-shop-id="${this.shopData.id}" data-checkin-type="manual">
                                    <i class="fas fa-map-marker-alt"></i>チェックイン
                                </button>
                                ${locationButtons}
                                <button class="action-button ghost" onclick="ShopDetailComponent.shareShop()">
                                    <i class="fas fa-share-alt"></i>シェア
                                </button>
                            </div>
                            <p class="shop-action-tip"><i class="fas fa-lightbulb"></i>チェックインするとスタンプラリーにも反映されます。</p>
                        </div>
                    </div>

                    <div class="shop-posts-section">
                        <div class="shop-posts-header">
                            <h2>この店での投稿</h2>
                        </div>
                        <div id="shopPosts" class="posts-container">
                            <div class="loading">投稿を読み込み中...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        
        // 地図を初期化
        this.initializeMap();
        
        // 店舗関連の投稿を読み込み
        this.loadShopPosts();
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
                    style: 'https://tiles.openfreemap.org/styles/liberty',
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
    
    // 店名からブランドを判定する関数
    determineBrand(shopName) {
        const BRAND_CONFIG = {
            butayama: { name: '豚山', color: '#fcd700ff', textColor: 'black', markerText: '豚', keywords: ['豚山'] },
            ramenso: { name: 'ラーメン荘', color: '#3498db', textColor: 'white', markerText: '荘', keywords: ['ラーメン荘'] },
            rakeiko: { name: 'ら・けいこ', color: '#2ecc71', textColor: 'white', keywords: ['ら・けいこ'] },
            ahare: { name: '麺屋あっ晴れ', color: '#e74c3c', textColor: 'white', keywords: ['あっ晴れ'] },
            tachikawa: { name: '立川マシマシ', color: '#9b59b6', textColor: 'white', keywords: ['立川マシマシ'] },
            tsukemensha: { name: 'つけめん舎', color: '#1abc9c', textColor: 'white', keywords: ['つけめん舎'] },
            jiro: { name: '直系二郎', color: '#d4a574', textColor: 'white', markerText: '直', keywords: ['ラーメン二郎'] },
            other: { name: 'その他', color: '#95a5a6', textColor: 'white', keywords: [] }
        };
        
        for (const [brandKey, config] of Object.entries(BRAND_CONFIG)) {
            if (brandKey === 'other') continue;
            
            for (const keyword of config.keywords) {
                if (shopName.includes(keyword)) {
                    return brandKey;
                }
            }
        }
        return 'other';
    },
    
    // ブランド設定を取得する関数
    getBrandConfig(brand) {
        const BRAND_CONFIG = {
            butayama: { name: '豚山', color: '#fcd700ff', textColor: 'black', markerText: '豚', keywords: ['豚山'] },
            ramenso: { name: 'ラーメン荘', color: '#3498db', textColor: 'white', markerText: '荘', keywords: ['ラーメン荘'] },
            rakeiko: { name: 'ら・けいこ', color: '#2ecc71', textColor: 'white', keywords: ['ら・けいこ'] },
            ahare: { name: '麺屋あっ晴れ', color: '#e74c3c', textColor: 'white', keywords: ['あっ晴れ'] },
            tachikawa: { name: '立川マシマシ', color: '#9b59b6', textColor: 'white', keywords: ['立川マシマシ'] },
            tsukemensha: { name: 'つけめん舎', color: '#1abc9c', textColor: 'white', keywords: ['つけめん舎'] },
            jiro: { name: '直系二郎', color: '#d4a574', textColor: 'white', markerText: '直', keywords: ['ラーメン二郎'] },
            other: { name: 'その他', color: '#95a5a6', textColor: 'white', keywords: [] }
        };
        
        return BRAND_CONFIG[brand] || BRAND_CONFIG.other;
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
                    <button onclick="router.navigate('search')" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">検索ページに戻る</button>
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
    }
};

// CSSスタイルを追加
const shopDetailStyles = document.createElement('style');
shopDetailStyles.textContent = `
    .checkin-btn {
        background: #d4a574;
        color: white;
        border: none;
        transition: all 0.2s;
    }
    
    .checkin-btn:hover {
        background: #c19663;
    }
    
    .dark-mode .checkin-btn {
        background: #d4a574;
        color: white;
    }
    
    .dark-mode .checkin-btn:hover {
        background: #c19663;
    }
`;
document.head.appendChild(shopDetailStyles);

// グローバルに公開
window.ShopDetailComponent = ShopDetailComponent;