// ガイドコンポーネント
const GuideComponent = {
    async render() {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        contentArea.innerHTML = '';
        
        const container = document.createElement('div');
        container.className = 'guide-container';
        
        // タブコンテナを作成
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'guide-tabs';
        
        // タブを作成
        const tabs = [
            { id: 'usage', name: 'ご利用ガイド', icon: 'fas fa-book' },
            { id: 'beginner', name: '初心者ガイド', icon: 'fas fa-graduation-cap' }
        ];
        
        const tabButtons = document.createElement('div');
        tabButtons.className = 'tab-buttons';
        
        tabs.forEach(tab => {
            const tabButton = document.createElement('button');
            tabButton.className = `guide-tab-button ${tab.id === 'usage' ? 'active' : ''}`;
            tabButton.dataset.tab = tab.id;
            tabButton.innerHTML = `<i class="${tab.icon}"></i> ${tab.name}`;
            tabButton.addEventListener('click', () => this.switchTab(tab.id));
            tabButtons.appendChild(tabButton);
        });
        
        tabsContainer.appendChild(tabButtons);
        container.appendChild(tabsContainer);
        
        // コンテンツエリアを作成
        const guideContentArea = document.createElement('div');
        guideContentArea.className = 'guide-content-area';
        
        // 初期表示として利用ガイドを表示
        guideContentArea.appendChild(await this.createUsageGuide());
        container.appendChild(guideContentArea);
        
        contentArea.appendChild(container);
    },

    async createUsageGuide() {
        const guideContent = document.createElement('div');
        guideContent.className = 'guide-section active';
        guideContent.id = 'usage-guide';
        
        // ヘッダー
        const header = document.createElement('div');
        header.className = 'guide-header';
        header.innerHTML = `
            <h2><i class="fas fa-book"></i> ラーメンSNS ご利用ガイド</h2>
            <p>このアプリの基本的な使い方を説明します</p>
        `;
        guideContent.appendChild(header);
        
        // セクション1: ホーム画面
        const section1 = document.createElement('div');
        section1.className = 'guide-section-block';
        section1.innerHTML = `
            <h3><i class="fas fa-home"></i> ホーム画面</h3>
            <p>ホーム画面では、他のユーザーが投稿したラーメンのレビューや写真を見ることができます。</p>
            <ul>
                <li>「おすすめ」タブ: 人気の投稿やおすすめの店舗が表示されます</li>
                <li>「フォロー中」タブ: フォローしているユーザーの投稿が表示されます</li>
                <li>投稿をクリックすると詳細を確認できます</li>
                <li>「いいね」やコメントをすることもできます</li>
            </ul>
        `;
        guideContent.appendChild(section1);
        
        // セクション2: MAP機能
        const section2 = document.createElement('div');
        section2.className = 'guide-section-block';
        section2.innerHTML = `
            <h3><i class="fas fa-map-marked-alt"></i> MAP機能</h3>
            <p>MAP機能では、近くのラーメン店を地図上で確認できます。</p>
            <ul>
                <li>現在地周辺のラーメン店がマーカーで表示されます</li>
                <li>マーカーをクリックすると店舗情報が表示されます</li>
                <li>検索機能で特定のエリアや店舗名で検索できます</li>
                <li>フィルター機能で種類や営業時間で絞り込みができます</li>
            </ul>
        `;
        guideContent.appendChild(section2);
        
        // セクション3: チェックイン機能
        const section3 = document.createElement('div');
        section3.className = 'guide-section-block';
        section3.innerHTML = `
            <h3><i class="fas fa-map-pin"></i> チェックイン機能</h3>
            <p>ラーメン店に訪れた際にチェックインすることができます。</p>
            <ul>
                <li>店舗を検索してチェックインします</li>
                <li>写真を撮影して投稿できます</li>
                <li>レビューを記入して感想を共有できます</li>
                <li>待ち時間を記録して他のユーザーに情報を提供できます</li>
            </ul>
        `;
        guideContent.appendChild(section3);
        
        // セクション4: スタンプラリー
        const section4 = document.createElement('div');
        section4.className = 'guide-section-block';
        section4.innerHTML = `
            <h3><i class="fas fa-stamp"></i> スタンプラリー</h3>
            <p>スタンプラリー機能でラーメン巡りを楽しむことができます。</p>
            <ul>
                <li>様々なテーマのスタンプラリーが開催されています</li>
                <li>対象店舗を訪れてチェックインするとスタンプが押されます</li>
                <li>全てのスタンプを集めると特典が得られる場合があります</li>
                <li>達成状況はプロフィールページで確認できます</li>
            </ul>
        `;
        guideContent.appendChild(section4);
        
        // セクション5: プロフィール設定
        const section5 = document.createElement('div');
        section5.className = 'guide-section-block';
        section5.innerHTML = `
            <h3><i class="fas fa-user-cog"></i> プロフィール設定</h3>
            <p>プロフィール設定で自分の情報を管理できます。</p>
            <ul>
                <li>ユーザー名やプロフィール画像を設定できます</li>
                <li>好きなラーメンの種類やこだわりをプロフィールに記載できます</li>
                <li>プライバシー設定で公開範囲を調整できます</li>
                <li>通知設定で受け取る通知を選択できます</li>
            </ul>
        `;
        guideContent.appendChild(section5);
        
        // ヒント
        const tips = document.createElement('div');
        tips.className = 'guide-tips';
        tips.innerHTML = `
            <h3><i class="fas fa-lightbulb"></i> 使い方のヒント</h3>
            <div class="tip-item">
                <i class="fas fa-camera"></i>
                <p>写真を投稿する際は、ラーメンが美味しそうに見える角度から撮影しましょう</p>
            </div>
            <div class="tip-item">
                <i class="fas fa-comments"></i>
                <p>他のユーザーと積極的に交流することで、新しいラーメン店が見つかるかもしれません</p>
            </div>
            <div class="tip-item">
                <i class="fas fa-star"></i>
                <p>詳しいレビューを書くと、他のユーザーの参考になります</p>
            </div>
        `;
        guideContent.appendChild(tips);
        
        return guideContent;
    },

    async createBeginnerGuide() {
        const guideContent = document.createElement('div');
        guideContent.className = 'guide-section';
        guideContent.id = 'beginner-guide';
        
        // ヘッダー
        const header = document.createElement('div');
        header.className = 'guide-header';
        header.innerHTML = `
            <h2><i class="fas fa-graduation-cap"></i> 二郎ラーメン初心者ガイド</h2>
            <p>二郎ラーメンを初めて食べる方向けのガイドです</p>
        `;
        guideContent.appendChild(header);
        
        // セクション1: 列の並び方・食券の買い方
        const section1 = document.createElement('div');
        section1.className = 'guide-section-block';
        section1.innerHTML = `
            <h3><i class="fas fa-ticket"></i> 列の並び方・食券の買い方</h3>
            <p>主な並び方は以下の通りです（お店によって異なります）</p>
            <ul>
                <li>列に並んで店内に入る時に食券を買う</li>
                <li>食券を先に購入してから列に並ぶ</li>
                <li>列に並んで店員に指示されてから食券を買う</li>
            </ul>
            <div class="guide-note">
                <i class="fas fa-lightbulb"></i>
                <span>※並び中に麺量を聞かれることがあります</span>
            </div>
            <div class="guide-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>注意　1000円札、小銭のみ使用できます</span>
            </div>
        `;
        guideContent.appendChild(section1);
        
        // セクション2: 席に着いたら
        const section2 = document.createElement('div');
        section2.className = 'guide-section-block';
        section2.innerHTML = `
            <h3><i class="fas fa-chair"></i> 席に着いたら</h3>
            <p><i class="fas fa-hand-sparkles"></i> おしぼり、<i class="fas fa-glass-water"></i> 水、<i class="fas fa-chopsticks"></i> 箸、<i class="fas fa-spoon"></i> レンゲはセルフです</p>
            <p>お店によってこのタイミングで麺の量を聞かれます</p>
            <div class="guide-tip">
                <i class="fas fa-circle-check"></i>
                <span>自分の食べ切れる量を伝えましょう</span>
            </div>
        `;
        guideContent.appendChild(section2);
        
        // セクション3: コール
        const section3 = document.createElement('div');
        section3.className = 'guide-section-block';
        section3.innerHTML = `
            <h3><i class="fas fa-volume-high"></i> コール</h3>
            <p>コールとはラーメンに入れる4つのトッピングの量を答えます。</p>
            <p>麺が茹で上がったら店員さんが「ニンニク入れますか」と聞いてくれるので自分の食べれる量を頼みましょう</p>
            <p>それぞれ、なし、少なめ、普通、マシ、マシマシがあります。</p>
            
            <div class="guide-definition-list">
                <div class="guide-definition-item">
                    <i class="fas fa-seedling"></i>
                    <div>
                        <span class="guide-definition-term">ニンニク：</span>刻みニンニク
                    </div>
                </div>
                <div class="guide-definition-item">
                    <i class="fas fa-leaf"></i>
                    <div>
                        <span class="guide-definition-term">ヤサイ：</span>もやしとキャベツが入った唯一のヤサイ
                    </div>
                </div>
                <div class="guide-definition-item">
                    <i class="fas fa-droplet"></i>
                    <div>
                        <span class="guide-definition-term">アブラ：</span>醤油で漬け込まれた背脂
                    </div>
                </div>
                <div class="guide-definition-item">
                    <i class="fas fa-fire"></i>
                    <div>
                        <span class="guide-definition-term">カラメ：</span>スープにあるカエシ(醤油)を増やす<br>
                        （なし、少なめはありません）
                    </div>
                </div>
            </div>
        `;
        guideContent.appendChild(section3);
        
        // セクション4: 食べるスピード
        const section4 = document.createElement('div');
        section4.className = 'guide-section-block';
        section4.innerHTML = `
            <h3><i class="fas fa-clock"></i> 食べるスピード</h3>
            <p>二郎には「ロット」という一度に調理・提供するラーメンの単位があります。なので食べるのが遅すぎるとこのロットが乱れてしまいます。</p>
            <p>早食いをしろ！というわけではありませんが、<span class="guide-highlight"><i class="fas fa-mobile-screen"></i> だらだらスマホを見たり、<i class="fas fa-comments"></i> おしゃべりをして食べるのが遅くなることはやめましょう</span></p>
        `;
        guideContent.appendChild(section4);
        
        return guideContent;
    },

    async switchTab(tabId) {
        // タブボタンのアクティブ状態を切り替え
        document.querySelectorAll('.guide-tab-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            }
        });
        
        // コンテンツを切り替え
        const contentArea = document.querySelector('.guide-content-area');
        if (!contentArea) return;
        
        contentArea.innerHTML = '';
        
        if (tabId === 'usage') {
            contentArea.appendChild(await this.createUsageGuide());
        } else if (tabId === 'beginner') {
            contentArea.appendChild(await this.createBeginnerGuide());
        }
    }
};

// ガイドコンポーネントを登録
router.register('guide', GuideComponent);