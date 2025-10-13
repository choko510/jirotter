const Utils = {
    // CSSを動的に読み込む
    loadCSS(name) {
        // 既存のコンポーネントCSSをアンロード
        this.unloadCSS();

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `/static/css/components/${name}.css`;
        link.id = `component-css-${name}`;
        document.head.appendChild(link);
    },

    // 以前のコンポーネントCSSをアンロード
    unloadCSS() {
        const oldLink = document.querySelector('link[id^="component-css-"]');
        if (oldLink) {
            oldLink.remove();
        }
    },
};
