# ラーメンSNS

ラーメン好きのためのソーシャルネットワーキングサービス（SNS）です。
お気に入りのラーメン店を見つけ、チェックインし、レビューを投稿し、他のユーザーと交流することができます。

## 主な機能

*   **タイムライン**: ユーザーの投稿、いいね、リプライ（AIサポート付き）を表示。
*   **マップ**: Leaflet/MapLibreを使用したラーメン店マップ。現在地周辺の店舗検索。
*   **チェックイン & スタンプラリー**: 店舗への訪問を記録し、スタンプを集めることができます。
*   **店舗詳細**: レビュー、待ち時間情報、店舗の詳細情報を閲覧・投稿。
*   **ユーザープロフィール**: プロフィール画像、自己紹介、訪問履歴、統計情報。
*   **検索**: ユーザーや店舗のグローバル検索。
*   **ランキング**: 人気の店舗やユーザーのランキング表示。
*   **設定**: ダークモード切替など。
*   **セキュリティ**: Cloudflare Turnstileによる認証保護、CSRF対策、フロントエンドJSの難読化。

## 技術スタック

### バックエンド
*   **Python 3.10+**
*   **FastAPI**: 高速なWebフレームワーク。
*   **SQLAlchemy**: ORM（SQLiteをデフォルトで使用）。
*   **Pydantic**: データバリデーション。
*   **Google GenAI (Gemini)**: AIによるリプライ生成・モデレーション支援。

### フロントエンド
*   **Vanilla JavaScript**: コンポーネントベースの設計。
*   **HTML5 / CSS3**: レスポンシブデザイン。
*   **Leaflet / MapLibre GL JS**: 地図表示。

### その他
*   **Pytest / Playwright**: テスト自動化。
*   **Uvicorn**: ASGIサーバー。

## セットアップ手順

### 前提条件
*   Python 3.10以上
*   pip

### インストール

1.  リポジトリをクローンします。
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  依存関係をインストールします。
    ```bash
    pip install -r requirements.txt
    ```
    ブラウザテスト（Playwright）用のブラウザもインストールする場合は以下を実行します。
    ```bash
    playwright install --with-deps
    ```

3.  環境変数を設定します。
    `.env.example` をコピーして `.env` を作成し、必要な値を設定してください。
    ```bash
    cp .env.example .env
    ```
    *   `GOOGLE_API_KEY`: AI機能を使用する場合に設定。
    *   `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: Cloudflare Turnstileを使用する場合に設定。
    *   `SESSION_SECRET_KEY`: セッション管理用の秘密鍵。

### 実行方法

以下のコマンドで開発サーバーを起動します。

```bash
python run.py
```

サーバーが起動したら、ブラウザで `http://localhost:8000` にアクセスしてください。

## テスト

### バックエンドテスト (Pytest)

```bash
python -m pytest
```

### E2Eテスト (Playwright)

```bash
python -m pytest tests/ui
```

## ディレクトリ構造

*   `app/`: バックエンドのソースコード
    *   `routes/`: APIエンドポイント定義
    *   `models.py`: データベースモデル
    *   `schemas.py`: Pydanticスキーマ
    *   `utils/`: ユーティリティ関数
*   `frontend/`: フロントエンドの静的ファイル
    *   `js/`: JavaScriptファイル（`components/`配下に各機能のロジック）
    *   `css/`: スタイルシート
    *   `index.html`: エントリーポイント
*   `tests/`: テストコード
*   `run.py`: アプリケーション起動スクリプト
*   `config.py`: 設定ファイル
