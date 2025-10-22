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

                /* Dark Mode Overrides */
                .dark-mode .profile-id { color: #aaa; }
                .dark-mode .profile-tabs { border-bottom-color: #333; }
                .dark-mode .profile-post-item { border-color: #333; }
                .dark-mode .profile-tab.active { color: #d4a574; }

                /* Profile Edit Modal Styles */
                .profile-edit-modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); display: flex;
                    justify-content: center; align-items: center; z-index: 1000;
                }
                .profile-edit-modal {
                    background: #fff; padding: 20px; border-radius: 8px;
                    width: 90%; max-width: 500px;
                }
                .dark-mode .profile-edit-modal { background: #2d2d2d; }
                .profile-edit-modal h2 { margin-top: 0; }
                .profile-edit-modal .form-group { margin-bottom: 15px; }
                .profile-edit-modal label { display: block; margin-bottom: 5px; }
                .profile-edit-modal input, .profile-edit-modal textarea {
                    width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;
                }
                .dark-mode .profile-edit-modal input, .dark-mode .profile-edit-modal textarea {
                    background: #333; border-color: #555; color: #fff;
                }
                .profile-edit-modal .modal-actions { text-align: right; }
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

            let actionButtonHtml = '';
            if (isOwnProfile) {
                actionButtonHtml = `<button onclick="ProfileComponent.showEditModal()" style="padding: 6px 12px; border-radius: 15px; cursor: pointer;">プロフィールを編集</button>`;
            } else {
                actionButtonHtml = `
                    <button id="followBtn" onclick="ProfileComponent.toggleFollow('${id}')" style="padding: 6px 12px; border-radius: 15px; cursor: pointer;">
                        ${is_following ? 'フォロー解除' : 'フォローする'}
                    </button>
                `;
            }

            let statsHtml = `
                <span><b>${posts_count}</b> 投稿</span>
                <span><b id="followersCount">${followers_count}</b> フォロワー</span>
                <span><b>${following_count}</b> フォロー中</span>
            `;

            if (isOwnProfile) {
                statsHtml = `
                    <span><b>${posts_count}</b> 投稿</span>
                    <span style="cursor: pointer;" onclick="ProfileComponent.showFollowers()"><b id="followersCount">${followers_count}</b> フォロワー</span>
                    <span style="cursor: pointer;" onclick="ProfileComponent.showFollowing()"><b>${following_count}</b> フォロー中</span>
                `;
            }

            const avatarSrc = this.state.user.profile_image_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';

            container.innerHTML = `
                <div class="profile-page">
                    <div class="profile-header">
                        <img src="${avatarSrc}" alt="${username}のアバター" class="profile-avatar">
                        <div>
                            <div class="profile-name">${username}</div>
                            <div class="profile-id">@${id}</div>
                            <div class="profile-bio">${this.state.user.bio || ''}</div>
                            <div class="profile-stats">
                                ${statsHtml}
                            </div>
                            ${actionButtonHtml}
                        </div>
                    </div>
                    <div class="profile-tabs">
                        <div class="profile-tab active" data-tab="posts">投稿</div>
                        <div class="profile-tab" data-tab="followers">フォロワー</div>
                        <div class="profile-tab" data-tab="following">フォロー中</div>
                    </div>
                    <div id="profileContent">
                        <div class="profile-post-grid">
                            ${this.state.posts.map(post => `
                                <div class="profile-post-item">
                                    ${post.image_url ? `<img src="${post.image_url}" alt="投稿画像">` : ''}
                                    <p>${post.content}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            this.addTabListeners();
        }
    },

    addTabListeners() {
        const tabs = document.querySelectorAll('.profile-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.getAttribute('data-tab');
                this.renderTabContent(tabName);
            });
        });
    },

    renderTabContent(tabName) {
        const content = document.getElementById('profileContent');
        if (tabName === 'posts') {
            content.innerHTML = `<div class="profile-post-grid">
                ${this.state.posts.map(post => `
                    <div class="profile-post-item">
                        ${post.image_url ? `<img src="${post.image_url}" alt="投稿画像">` : ''}
                        <p>${post.content}</p>
                    </div>
                `).join('')}
            </div>`;
        } else if (tabName === 'followers') {
            this.showFollowers();
        } else if (tabName === 'following') {
            this.showFollowing();
        }
    },

    async showFollowers() {
        const content = document.getElementById('profileContent');
        content.innerHTML = `<div class="loading">フォロワーを読み込み中...</div>`;
        try {
            const result = await API.getFollowers(this.state.user.id);
            if (result.success) {
                if (result.users.length === 0) {
                    content.innerHTML = '<div>フォロワーはいません。</div>';
                    return;
                }
                content.innerHTML = `
                    <div class="user-list">
                        ${result.users.map(user => `
                            <div class="user-list-item">
                                <div class="user-list-avatar"></div>
                                <div>
                                    <div class="user-list-name">${user.username}</div>
                                    <div class="user-list-id">@${user.id}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>`;
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
            if (result.success) {
                if (result.users.length === 0) {
                    content.innerHTML = '<div>誰もフォローしていません。</div>';
                    return;
                }
                content.innerHTML = `
                    <div class="user-list">
                        ${result.users.map(user => `
                            <div class="user-list-item">
                                <div class="user-list-avatar"></div>
                                <div>
                                    <div class="user-list-name">${user.username}</div>
                                    <div class="user-list-id">@${user.id}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>`;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            content.innerHTML = `<div class="error">フォロー中の読み込みに失敗しました: ${error.message}</div>`;
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
    },

    showEditModal() {
        if (!this.state.user) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'profile-edit-modal-overlay';
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
            }
        };

        const modalContent = `
            <div class="profile-edit-modal">
                <h2>プロフィールを編集</h2>
                <div class="form-group">
                    <label for="username">ニックネーム</label>
                    <input type="text" id="username" value="${this.state.user.username || ''}">
                </div>
                <div class="form-group">
                    <label for="bio">自己紹介</label>
                    <textarea id="bio" rows="4">${this.state.user.bio || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="profileImageUrl">アイコンURL</label>
                    <input type="text" id="profileImageUrl" value="${this.state.user.profile_image_url || ''}">
                </div>
                <div class="modal-actions">
                    <button onclick="document.body.removeChild(document.querySelector('.profile-edit-modal-overlay'))">キャンセル</button>
                    <button onclick="ProfileComponent.handleUpdateProfile()">保存</button>
                </div>
            </div>
        `;

        modalOverlay.innerHTML = modalContent;
        document.body.appendChild(modalOverlay);
    },

    async handleUpdateProfile() {
        const username = document.getElementById('username').value;
        const bio = document.getElementById('bio').value;
        const profileImageUrl = document.getElementById('profileImageUrl').value;

        const updateData = {
            username,
            bio,
            profile_image_url: profileImageUrl
        };

        const result = await API.updateUserProfile(updateData);

        if (result.success) {
            this.state.user = { ...this.state.user, ...result.user };
            // 更新されたユーザー情報をクッキーに保存
            API.setCookie('user', JSON.stringify(this.state.user));
            this.updateDOM();
            document.body.removeChild(document.querySelector('.profile-edit-modal-overlay'));
        } else {
            alert(`更新に失敗しました: ${result.error}`);
        }
    }
};

router.register('profile', ProfileComponent);