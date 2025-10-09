# SNS Backend API

FastAPIを使用して構築されたSNSバックエンドAPIです。

## 機能

- ユーザー認証（登録、ログイン、JWTトークン認証）
- 投稿機能（作成、取得、削除）
- ユーザープロフィール管理
- RESTful API設計
- 自動APIドキュメント生成（Swagger UI）

## 技術スタック

- **バックエンド**: FastAPI
- **データベース**: SQLite（開発用） / PostgreSQL（本番用推奨）
- **ORM**: SQLAlchemy
- **認証**: JWT（JSON Web Tokens）
- **パスワードハッシュ化**: bcrypt
- **APIドキュメント**: FastAPI自動生成（Swagger UI / ReDoc）

## セットアップ

1. 仮想環境を作成してアクティベート：
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# または
venv\Scripts\activate  # Windows
```

2. 依存関係をインストール：
```bash
pip install -r requirements.txt
```

3. 環境変数を設定（.envファイルを作成）：
```
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///./sns.db
```

4. アプリケーションを実行：
```bash
python run.py
```

アプリケーションは http://localhost:8000 で実行されます。

## APIドキュメント

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## APIエンドポイント

### 認証
- `POST /api/v1/auth/register` - ユーザー登録
- `POST /api/v1/auth/login` - ユーザーログイン
- `GET /api/v1/auth/profile` - ユーザープロフィール取得（認証済み）

### 投稿
- `POST /api/v1/posts` - 投稿作成（認証済み）
- `GET /api/v1/posts` - 投稿一覧取得
- `GET /api/v1/posts/{post_id}` - 特定の投稿取得
- `DELETE /api/v1/posts/{post_id}` - 投稿削除（認証済み、所有者のみ）

## テスト

テストを実行するには：
```bash
pytest
```

## プロジェクト構造

```
.
├── app/
│   ├── __init__.py          # FastAPIアプリケーションファクトリー
│   ├── models.py            # SQLAlchemyモデル
│   ├── schemas.py           # Pydanticモデル
│   ├── routes/              # APIルート
│   │   ├── auth.py          # 認証関連エンドポイント
│   │   └── posts.py         # 投稿関連エンドポイント
│   └── utils/               # ユーティリティ
│       ├── auth.py          # 認証関連ユーティリティ
│       └── security.py      # セキュリティ関連ユーティリティ
├── js/                      # フロントエンドJavaScript
├── tests/                   # テストファイル
├── database.py              # データベース設定
├── config.py                # 設定
├── run.py                   # アプリケーションエントリーポイント
└── requirements.txt         # 依存関係
```

## 開発

### データベースマイグレーション

本番環境ではAlembicを使用してデータベースマイグレーションを管理してください：

```bash
# マイグレーション初期化
alembic init alembic

# マイグレーション作成
alembic revision --autogenerate -m "Initial migration"

# マイグレーション適用
alembic upgrade head
```

### コーディング規約

- Python: PEP 8
- 型ヒントを使用
- 適切なエラーハンドリング
- テストカバレッジを維持

## ライセンス

MIT License