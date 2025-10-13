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
        
        // CSSの動的読み込み
        Utils.loadCSS('shop-detail');

        contentArea.innerHTML = `
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
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);
                
                const marker = L.marker([this.shopData.latitude, this.shopData.longitude]).addTo(map);
                marker.bindPopup(`<b>${this.escapeHtml(this.shopData.name)}</b><br>${this.escapeHtml(this.shopData.address)}`).openPopup();
            } catch (error) {
                console.error('地図の初期化に失敗しました:', error);
            }
        }, 100);
    },
    
    // 店舗関連の投稿を読み込み
    async loadShopPosts() {
        try {
            // 店舗名を含む投稿を検索
            const result = await API.getShopPosts(this.shopData.name);
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

// グローバルに公開
window.ShopDetailComponent = ShopDetailComponent;