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

            const profilePage = document.createElement('div');
            profilePage.className = 'profile-page';

            // Header
            const header = document.createElement('div');
            header.className = 'profile-header';

            const avatar = document.createElement('img');
            avatar.className = 'profile-avatar';
            avatar.src = this.state.user.profile_image_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';
            avatar.alt = `${username}のアバター`;
            header.appendChild(avatar);

            const infoDiv = document.createElement('div');

            const nameDiv = document.createElement('div');
            nameDiv.className = 'profile-name';
            nameDiv.textContent = username;
            infoDiv.appendChild(nameDiv);

            const idDiv = document.createElement('div');
            idDiv.className = 'profile-id';
            idDiv.textContent = `@${id}`;
            infoDiv.appendChild(idDiv);

            const bioDiv = document.createElement('div');
            bioDiv.className = 'profile-bio';
            bioDiv.textContent = this.state.user.bio || '';
            infoDiv.appendChild(bioDiv);

            const statsDiv = document.createElement('div');
            statsDiv.className = 'profile-stats';

            const createStat = (value, label, onClick = null) => {
                const span = document.createElement('span');
                const b = document.createElement('b');
                b.textContent = value;
                span.appendChild(b);
                span.append(` ${label}`);
                if (onClick) {
                    span.style.cursor = 'pointer';
                    span.addEventListener('click', onClick);
                }
                return span;
            };

            statsDiv.appendChild(createStat(posts_count, '投稿'));
            statsDiv.appendChild(createStat(followers_count, 'フォロワー', isOwnProfile ? () => this.showFollowers() : null));
            statsDiv.appendChild(createStat(following_count, 'フォロー中', isOwnProfile ? () => this.showFollowing() : null));
            infoDiv.appendChild(statsDiv);

            const actionButton = document.createElement('button');
            actionButton.style.cssText = "padding: 6px 12px; border-radius: 15px; cursor: pointer;";
            if (isOwnProfile) {
                actionButton.textContent = 'プロフィールを編集';
                actionButton.addEventListener('click', () => this.showEditModal());
            } else {
                actionButton.id = 'followBtn';
                actionButton.textContent = is_following ? 'フォロー解除' : 'フォローする';
                actionButton.addEventListener('click', () => this.toggleFollow(id));
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
            profilePage.appendChild(tabs);

            const profileContent = document.createElement('div');
            profileContent.id = 'profileContent';
            profilePage.appendChild(profileContent);

            container.appendChild(profilePage);

            this.addTabListeners();
            this.renderTabContent('posts'); // Initial render
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
        content.innerHTML = ''; // Clear previous content

        if (tabName === 'posts') {
            const grid = document.createElement('div');
            grid.className = 'profile-post-grid';
            this.state.posts.forEach(post => {
                const item = document.createElement('div');
                item.className = 'profile-post-item';
                if (post.image_url) {
                    const img = document.createElement('img');
                    img.src = post.image_url;
                    img.alt = '投稿画像';
                    item.appendChild(img);
                }
                const p = document.createElement('p');
                p.textContent = post.content;
                item.appendChild(p);
                grid.appendChild(item);
            });
            content.appendChild(grid);
        } else if (tabName === 'followers') {
            this.showFollowers();
        } else if (tabName === 'following') {
            this.showFollowing();
        }
    },

    async showFollowers() {
        this.renderUserList('フォロワー', API.getFollowers);
    },

    async showFollowing() {
        this.renderUserList('フォロー中', API.getFollowing);
    },

    async renderUserList(title, apiMethod) {
        const content = document.getElementById('profileContent');
        content.innerHTML = `<div class="loading">${title}を読み込み中...</div>`;

        try {
            const result = await apiMethod(this.state.user.id);
            content.innerHTML = ''; // Clear loading

            if (result.success) {
                if (result.users.length === 0) {
                    const noUsersDiv = document.createElement('div');
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
                    item.appendChild(avatar);

                    const userInfo = document.createElement('div');
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

    async toggleFollow(userId) {
        const token = API.getCookie('authToken');
        if (!token) {
            Utils.showNotification('フォローするにはログインしてください', 'info');
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
                Utils.showNotification(`エラー: ${result.error}`, 'error');
            }
        } catch (error) {
            // Revert UI on error
            this.state.user.is_following = originalIsFollowing;
            this.state.user.followers_count = originalFollowersCount;
            if(followBtn) followBtn.textContent = this.state.user.is_following ? 'フォロー解除' : 'フォローする';
            if(followersCountEl) followersCountEl.textContent = this.state.user.followers_count;
            Utils.showNotification('フォロー/フォロー解除に失敗しました。', 'error');
        }
    },

    showEditModal() {
        if (!this.state.user) return;

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

        modal.appendChild(createFormGroup('username', 'ニックネーム', 'input', this.state.user.username || ''));
        modal.appendChild(createFormGroup('bio', '自己紹介', 'textarea', this.state.user.bio || ''));
        modal.appendChild(createFormGroup('profileImageUrl', 'アイコンURL', 'input', this.state.user.profile_image_url || ''));

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
            API.setCookie('user', JSON.stringify(this.state.user));
            this.updateDOM();
            closeModal();
        } else {
            console.error('Update failed:', result.error);
            Utils.showNotification('プロフィールの更新に失敗しました。入力内容を確認してください。', 'error');
        }
    }
};

router.register('profile', ProfileComponent);