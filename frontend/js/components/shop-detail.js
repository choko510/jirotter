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
        
        contentArea.innerHTML = `
            <style>
                /* Post-related styles copied from timeline.js */
                .post-card { padding: 16px; border-bottom: 1px solid #e0e0e0; transition: background 0.2s; }
                .post-card:hover { background: #f9f9f9; }
                .post-header { display: flex; gap: 12px; margin-bottom: 12px; cursor: pointer; }
                .post-avatar { width: 48px; height: 48px; border-radius: 50%; background: #d4a574; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; }
                .post-user-info { flex: 1; }
                .post-username { font-weight: bold; }
                .post-meta { color: #666; font-size: 14px; }
                .post-engagement { display: flex; justify-content: space-around; margin-top: 12px; padding-top: 12px; }
                .engagement-btn { display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: #666; cursor: pointer; }
                .engagement-btn .liked { color: #e0245e; }
                .post-content { line-height: 1.4; }
                .post-content.collapsed { max-height: 4.2em; overflow: hidden; }
                .show-more-btn { background: none; border: none; color: #d4a574; cursor: pointer; font-size: 14px; padding: 4px 0; }
                .show-more-btn:hover { text-decoration: underline; }
                .post-image img { width: 100%; border-radius: 16px; margin-top: 12px; }

                /* Dark Mode Overrides for posts */
                .dark-mode .post-card {
                    border-bottom-color: #333;
                }
                .dark-mode .post-card:hover {
                    background: #2a2a2a;
                }
                .dark-mode .post-meta,
                .dark-mode .engagement-btn {
                    color: #aaa;
                }
            </style>
            <div class="shop-detail-container">
                <div class="shop-header">
                    <button class="back-button" onclick="router.navigate('search')">
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
                            <span>${this.escapeHtml(this.shopData.business_hours)}</span>
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
                </div>
                
                <div class="shop-posts-section">
                    <h2>この店での投稿</h2>
                    <div id="shopPosts" class="posts-container">
                        <div class="loading">投稿を読み込み中...</div>
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