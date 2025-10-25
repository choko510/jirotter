// プロフィールコンポーネント
const ProfileComponent = {
    state: {
        user: null,
        posts: [],
        isLoading: true,
        error: null,
        selectedIconFile: null
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
                // ユーザーが存在しない場合のエラーハンドリング
                if (profileResult.error && (
                    profileResult.error.includes('ユーザーが見つかりません') ||
                    profileResult.error.includes('User not found') ||
                    profileResult.error.includes('404')
                )) {
                    this.renderUserNotFound(userId);
                    return;
                }
                throw new Error(profileResult.error || postsResult.error || 'データの取得に失敗しました');
            }
        } catch (error) {
            this.state.isLoading = false;
            this.state.error = error.message;
            this.updateDOM();
        }
    },

    // ユーザーが見つからない場合の表示
    renderUserNotFound(userId) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="error">
                <h2>ユーザーが見つかりません</h2>
                <p>ユーザーID "${userId}" のユーザーは存在しません。</p>
                <button onclick="router.navigate('timeline')" style="margin-top: 16px; padding: 8px 16px; background: #d4a574; color: white; border: none; border-radius: 4px; cursor: pointer;">ホームに戻る</button>
            </div>
        `;
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
            avatar.src = this.state.user.profile_image_url || 'assets/baseicon.png';
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
                if (post.image_url || post.thumbnail_url) {
                    const picture = document.createElement('picture');
                    
                    // source要素（通常画質）
                    if (post.original_image_url) {
                        const source = document.createElement('source');
                        source.srcset = post.original_image_url;
                        source.media = '(min-width: 768px)';
                        picture.appendChild(source);
                    }
                    
                    // img要素（低画質）
                    const img = document.createElement('img');
                    img.src = post.thumbnail_url || post.image_url;
                    img.alt = '投稿画像';
                    img.loading = 'lazy';
                    
                    // 通常画質画像をdata-srcに設定
                    if (post.original_image_url) {
                        img.dataset.src = post.original_image_url;
                    }
                    
                    picture.appendChild(img);
                    item.appendChild(picture);
                }
                const p = document.createElement('p');
                p.textContent = post.content;
                item.appendChild(p);
                grid.appendChild(item);
            });
            content.appendChild(grid);
            
            // 遅延読み込みを設定
            setTimeout(() => {
                this.setupLazyLoading();
            }, 100);
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
            content.innerHTML = ''; // Clear loading

            if (result.success) {
                if (result.users.length === 0) {
                    const noUsersDiv = document.createElement('div');
                    noUsersDiv.textContent = 'フォロワーはいません。';
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
                    const avatarImg = document.createElement('img');
                    avatarImg.src = user.profile_image_url || 'assets/baseicon.png';
                    avatarImg.alt = `${user.username}のアイコン`;
                    avatarImg.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                    avatar.appendChild(avatarImg);
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
            content.innerHTML = `<div class="error">フォロワーの読み込みに失敗しました: ${error.message}</div>`;
        }
    },

    async showFollowing() {
        const content = document.getElementById('profileContent');
        content.innerHTML = `<div class="loading">フォロー中を読み込み中...</div>`;

        try {
            const result = await API.getFollowing(this.state.user.id);
            content.innerHTML = ''; // Clear loading

            if (result.success) {
                if (result.users.length === 0) {
                    const noUsersDiv = document.createElement('div');
                    noUsersDiv.textContent = 'フォロー中はいません。';
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
                    const avatarImg = document.createElement('img');
                    avatarImg.src = user.profile_image_url || 'assets/baseicon.png';
                    avatarImg.alt = `${user.username}のアイコン`;
                    avatarImg.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                    avatar.appendChild(avatarImg);
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
            content.innerHTML = `<div class="error">フォロー中の読み込みに失敗しました: ${error.message}</div>`;
        }
    },

    async renderUserList(title, apiMethod) {
        const content = document.getElementById('profileContent');
        content.innerHTML = `<div class="loading">${title}を読み込み中...</div>`;

        try {
            // APIメソッドを直接呼び出すのではなく、APIオブジェクトのメソッドとして呼び出す
            let result;
            if (apiMethod === API.getFollowers) {
                result = await API.getFollowers(this.state.user.id);
            } else if (apiMethod === API.getFollowing) {
                result = await API.getFollowing(this.state.user.id);
            } else {
                throw new Error('不明なAPIメソッド');
            }
            
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
                    const avatarImg = document.createElement('img');
                    avatarImg.src = user.profile_image_url || 'assets/baseicon.png';
                    avatarImg.alt = `${user.username}のアイコン`;
                    avatarImg.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                    avatar.appendChild(avatarImg);
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

        this.state.selectedIconFile = null;

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

        const fileGroup = document.createElement('div');
        fileGroup.className = 'form-group';

        const fileLabel = document.createElement('label');
        fileLabel.htmlFor = 'profileImageFile';
        fileLabel.textContent = 'アイコン画像をアップロード';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'profileImageFile';
        fileInput.accept = 'image/*';

        const helperText = document.createElement('small');
        helperText.textContent = '5MB以下のJPEG/PNG/GIF/WebPを推奨します。';
        helperText.style.display = 'block';
        helperText.style.marginTop = '4px';
        helperText.style.color = '#666';

        const previewWrapper = document.createElement('div');
        previewWrapper.id = 'profileImagePreview';
        previewWrapper.style.cssText = 'margin-top: 12px; display: flex; justify-content: center;';
        const previewImg = document.createElement('img');
        previewImg.id = 'profileImagePreviewImg';
        previewImg.src = this.state.user.profile_image_url || 'assets/baseicon.png';
        previewImg.alt = `${this.state.user.username || ''}のプレビュー`;
        previewImg.style.cssText = 'width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 1px solid #e0e0e0;';
        previewWrapper.appendChild(previewImg);

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const validation = this.validateIconFile(file);
                if (!validation.isValid) {
                    Utils.showNotification(validation.error, 'error');
                    event.target.value = '';
                    previewImg.src = this.state.user.profile_image_url || 'assets/baseicon.png';
                    this.state.selectedIconFile = null;
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                };
                reader.readAsDataURL(file);
                this.state.selectedIconFile = file;
            } else {
                previewImg.src = this.state.user.profile_image_url || 'assets/baseicon.png';
                this.state.selectedIconFile = null;
            }
        });

        fileGroup.appendChild(fileLabel);
        fileGroup.appendChild(fileInput);
        fileGroup.appendChild(helperText);
        fileGroup.appendChild(previewWrapper);
        modal.appendChild(fileGroup);

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
        const profileImageUrlInput = document.getElementById('profileImageUrl');
        const fileInput = document.getElementById('profileImageFile');

        let profileImageUrl = profileImageUrlInput ? profileImageUrlInput.value.trim() : '';

        if (fileInput && fileInput.files && fileInput.files[0]) {
            const uploadResult = await API.uploadProfileIcon(fileInput.files[0]);
            if (!uploadResult.success) {
                Utils.showNotification(uploadResult.error || 'アイコンのアップロードに失敗しました。', 'error');
                return;
            }
            profileImageUrl = uploadResult.url;
        } else if (this.state.selectedIconFile) {
            const uploadResult = await API.uploadProfileIcon(this.state.selectedIconFile);
            if (!uploadResult.success) {
                Utils.showNotification(uploadResult.error || 'アイコンのアップロードに失敗しました。', 'error');
                return;
            }
            profileImageUrl = uploadResult.url;
        }

        const updateData = {
            username,
            bio,
            profile_image_url: profileImageUrl
        };

        const result = await API.updateUserProfile(updateData);

        if (result.success) {
            this.state.user = { ...this.state.user, ...result.user };
            API.setCookie('user', JSON.stringify(this.state.user));
            this.state.selectedIconFile = null;
            this.updateDOM();
            closeModal();
        } else {
            console.error('Update failed:', result.error);
            Utils.showNotification('プロフィールの更新に失敗しました。入力内容を確認してください。', 'error');
        }
    },

    validateIconFile(file) {
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp'
        ];

        const maxSizeInBytes = 5 * 1024 * 1024;

        if (!allowedMimeTypes.includes(file.type)) {
            return {
                isValid: false,
                error: '対応している画像形式はJPEG、PNG、GIF、WebPのみです'
            };
        }

        if (file.size > maxSizeInBytes) {
            return {
                isValid: false,
                error: '画像サイズは5MB以下にしてください'
            };
        }

        const dangerousExtensions = ['.php', '.js', '.exe', '.bat', '.cmd', '.sh', '.py', '.pl', '.rb'];
        const fileName = file.name.toLowerCase();
        for (const ext of dangerousExtensions) {
            if (fileName.endsWith(ext)) {
                return {
                    isValid: false,
                    error: 'このファイル形式は許可されていません'
                };
            }
        }

        return { isValid: true, error: null };
    },

    // 遅延読み込みの設定
    setupLazyLoading() {
        const images = document.querySelectorAll('.profile-post-item img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        // ネットワーク状況に応じて画像の読み込みを制御
                        if (this.isSlowNetwork()) {
                            // 低速ネットワークの場合はサムネイルのまま
                            img.dataset.loaded = 'true';
                            observer.unobserve(img);
                            return;
                        }
                        
                        // 通常画質画像に切り替え
                        const highQualitySrc = img.dataset.src;
                        if (highQualitySrc && img.src !== highQualitySrc) {
                            const tempImg = new Image();
                            tempImg.onload = () => {
                                img.src = highQualitySrc;
                                img.removeAttribute('data-src');
                                img.dataset.loaded = 'true';
                            };
                            tempImg.src = highQualitySrc;
                        } else if (!highQualitySrc) {
                            // 高画質画像がない場合でもロード済みとしてマーク
                            img.dataset.loaded = 'true';
                        }
                        
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px' // ビューポートの50px手前から読み込み開始
            });
            
            images.forEach(img => imageObserver.observe(img));
        } else {
            // IntersectionObserverがサポートされていない場合のフォールバック
            images.forEach(img => {
                if (this.isSlowNetwork()) {
                    img.dataset.loaded = 'true';
                    return; // 低速ネットワークの場合はサムネイルのまま
                }
                
                const highQualitySrc = img.dataset.src;
                if (highQualitySrc) {
                    img.src = highQualitySrc;
                    img.removeAttribute('data-src');
                    img.dataset.loaded = 'true';
                } else {
                    // 高画質画像がない場合でもロード済みとしてマーク
                    img.dataset.loaded = 'true';
                }
            });
        }
    },

    // ネットワーク速度の判定
    isSlowNetwork() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            // 接続タイプで判定
            if (connection.type === 'cellular') {
                // モバイルネットワークの場合
                if (connection.effectiveType === 'slow-2g' ||
                    connection.effectiveType === '2g' ||
                    connection.effectiveType === '3g') {
                    return true;
                }
            }
            
            // ダウンロード速度で判定
            if (connection.downlink && connection.downlink < 1.5) {
                return true; // 1.5Mbps未満は低速と判定
            }
        }
        
        return false;
    }
};