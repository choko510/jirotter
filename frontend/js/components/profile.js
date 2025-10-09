// プロフィールコンポーネント
const ProfileComponent = {
    state: {
        user: null,
        posts: [],
        isLoading: true,
        error: null
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
                .profile-page { padding: 20px; }
                .profile-header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
                .profile-avatar { width: 80px; height: 80px; border-radius: 50%; background: #ccc; }
                .profile-info { font-size: 16px; }
                .profile-name { font-size: 24px; font-weight: bold; }
                .profile-id { color: #666; }
                .profile-stats { display: flex; gap: 20px; margin: 10px 0; }
                .profile-tabs { display: flex; border-bottom: 1px solid #e0e0e0; margin-bottom: 20px; }
                .profile-tab { padding: 12px 20px; cursor: pointer; }
                .profile-tab.active { border-bottom: 2px solid #d4a574; font-weight: bold; }
                .profile-post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
                .profile-post-item { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
                .profile-post-item img { width: 100%; height: auto; }
                .profile-post-item p { padding: 10px; }
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
                throw new Error(profileResult.error || postsResult.error || 'データの取得に失敗しました');
            }
        } catch (error) {
            this.state.isLoading = false;
            this.state.error = error.message;
            this.updateDOM();
        }
    },

    updateDOM() {
        const container = document.getElementById('profileContainer');
        if (!container) return;

        if (this.state.isLoading) {
            container.innerHTML = `<div class="loading">プロフィールを読み込み中...</div>`;
            return;
        }

        if (this.state.error) {
            container.innerHTML = `<div class="error">${this.state.error}</div>`;
            return;
        }

        if (this.state.user) {
            const { id, username, followers_count, following_count, posts_count, is_following } = this.state.user;
            container.innerHTML = `
                <div class="profile-page">
                    <div class="profile-header">
                        <div class="profile-avatar"></div>
                        <div>
                            <div class="profile-name">${username}</div>
                            <div class="profile-id">@${id}</div>
                            <div class="profile-stats">
                                <span><b>${posts_count}</b> 投稿</span>
                                <span><b id="followersCount">${followers_count}</b> フォロワー</span>
                                <span><b>${following_count}</b> フォロー中</span>
                            </div>
                            <button id="followBtn" onclick="ProfileComponent.toggleFollow('${id}')" style="padding: 6px 12px; border-radius: 15px; cursor: pointer;">
                                ${is_following ? 'フォロー解除' : 'フォローする'}
                            </button>
                        </div>
                    </div>
                    <div class="profile-tabs">
                        <div class="profile-tab active">投稿</div>
                    </div>
                    <div class="profile-post-grid">
                        ${this.state.posts.map(post => `
                            <div class="profile-post-item">
                                ${post.image_url ? `<img src="${post.image_url}" alt="投稿画像">` : ''}
                                <p>${post.content}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    },

    async toggleFollow(userId) {
        const token = API.getCookie('authToken');
        if (!token) {
            alert('フォローするにはログインしてください');
            router.navigate('auth', ['login']);
            return;
        }

        if (!this.state.user) return;

        const originalIsFollowing = this.state.user.is_following;
        const originalFollowersCount = this.state.user.followers_count;

        // Optimistic UI update
        this.state.user.is_following = !this.state.user.is_following;
        this.state.user.followers_count += this.state.user.is_following ? 1 : -1;

        const followBtn = document.getElementById('followBtn');
        const followersCountEl = document.getElementById('followersCount');
        if(followBtn) followBtn.textContent = this.state.user.is_following ? 'フォロー解除' : 'フォローする';
        if(followersCountEl) followersCountEl.textContent = this.state.user.followers_count;


        try {
            const result = this.state.user.is_following
                ? await API.followUser(userId)
                : await API.unfollowUser(userId);

            if (!result.success) {
                // Revert UI on failure
                this.state.user.is_following = originalIsFollowing;
                this.state.user.followers_count = originalFollowersCount;
                if(followBtn) followBtn.textContent = this.state.user.is_following ? 'フォロー解除' : 'フォローする';
                if(followersCountEl) followersCountEl.textContent = this.state.user.followers_count;
                alert(`エラー: ${result.error}`);
            }
        } catch (error) {
            // Revert UI on error
            this.state.user.is_following = originalIsFollowing;
            this.state.user.followers_count = originalFollowersCount;
            if(followBtn) followBtn.textContent = this.state.user.is_following ? 'フォロー解除' : 'フォローする';
            if(followersCountEl) followersCountEl.textContent = this.state.user.followers_count;
            alert('フォロー/フォロー解除に失敗しました。');
        }
    }
};

router.register('profile', ProfileComponent);