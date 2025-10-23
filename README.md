# RameN-Social: ラーメンファンのためのソーシャルネットワーキングサービス

RameN-Socialは、ラーメン愛好家が自分のお気に入りのラーメン店について語り合ったり、新しいお店を発見したりできる、コミュニティ指向のWebアプリケーションです。

[デモ](http://ramen-social.example.com) (リンクはダミーです)

![スクリーンショット](https://i.imgur.com/example.png) (画像はダミーです)

## 🍜 主な機能

- **タイムライン**: ユーザーの投稿を時系列で表示し、他のユーザーの発見を追体験できます。
- **インタラクティブマップ**: 地図上でお近くのラーメン店を視覚的に検索できます。
- **投稿と共有**: お気に入りの一杯やお店のレビューを写真付きで簡単に投稿できます。
- **ユーザープロフィール**: 自己紹介や過去の投稿一覧をカスタマイズできます。
- **フォロー機能**: 気になるユーザーをフォローして、その活動をタイムラインでチェックできます。
- **いいね・返信**: 投稿に対して「いいね」をしたり、返信をしたりして、他のユーザーと交流できます。

## 🛠️ 技術スタック

本プロジェクトは、モダンな技術スタックで構築されており、高いパフォーマンスと拡張性を目指しています。

- **バックエンド**:
  - **フレームワーク**: [FastAPI](https://fastapi.tiangolo.com/)
  - **データベース**: [SQLite](https://www.sqlite.org/index.html) (開発用) / [PostgreSQL](https://www.postgresql.org/) (本番推奨)
  - **ORM**: [SQLAlchemy](https://www.sqlalchemy.org/)
  - **認証**: JWT (JSON Web Tokens)
- **フロントエンド**:
  - **言語**: JavaScript (ES6+)
  - **ライブラリ**: [Leaflet.js](https://leafletjs.com/) (地図), [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
  - **アーキテクチャ**: Vanilla JSによるコンポーネントベースのSPA
- **テスト**:
  - **バックエンド**: [Pytest](https://docs.pytest.org/en/stable/)
  - **フロントエンド (UI)**: [Playwright](https://playwright.dev/)

## 🚀 セットアップと実行

### 1. 前提条件

- [Python 3.10](https://www.python.org/downloads/release/python-3100/) 以降
- [Node.js](https://nodejs.org/ja/) (Playwrightの依存関係で必要)
- [Poetry](https://python-poetry.org/) (推奨: 依存関係管理)

### 2. インストール

リポジトリをクローンし、必要な依存関係をインストールします。

```bash
# リポジトリをクローン
git clone https://github.com/your-username/ramen-social.git
cd ramen-social

# Pythonの依存関係をインストール
pip install -r requirements.txt

# Playwrightのブラウザ依存関係をインストール
playwright install --with-deps
```

### 3. アプリケーションの実行

以下のコマンドでバックエンドサーバーを起動します。

```bash
python run.py
```

サーバーが起動したら、ブラウザで [http://localhost:8000](http://localhost:8000) にアクセスしてください。

## ✅ テストの実行

プロジェクト全体の品質を保証するため、以下のコマンドで全てのテストを実行できます。

```bash
# PYTHONPATHを設定してPytestを実行
PYTHONPATH=. python -m pytest
```

## 📂 プロジェクト構造

```
.
├── app/                  # FastAPIバックエンド
│   ├── routes/           # APIルーター
│   ├── models.py         # SQLAlchemyモデル
│   └── schemas.py        # Pydanticスキーマ
├── frontend/             # Vanilla JSフロントエンド
│   ├── js/
│   │   └── components/   # 各UIコンポーネント
│   └── static/           # CSS, 画像など
├── tests/                # Pytestによるテストコード
│   └── ui/               # PlaywrightによるUIテスト
├── run.py                # アプリケーション起動スクリプト
├── requirements.txt      # Python依存ライブラリ
└── README.md
```

## 🤝 貢献

バグ報告、機能改善の提案など、あらゆるコントリビューションを歓迎します。Issueを作成するか、プルリクエストを送ってください。

## 📄 ライセンス

このプロジェクトは[MITライセンス](LICENSE)のもとで公開されています。
