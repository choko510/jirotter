"""
UserLoginHistoryテーブルを追加するマイグレーションスクリプト
"""
from sqlalchemy import create_engine, text
from database import SQLALCHEMY_DATABASE_URL
import sys

def add_user_login_history_table():
    """UserLoginHistoryテーブルをデータベースに追加"""
    
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    # UserLoginHistoryテーブル作成SQL
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS user_login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id VARCHAR(80) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """
    
    # インデックス作成SQL
    create_indexes_sql = [
        "CREATE INDEX IF NOT EXISTS ix_user_login_history_user_id ON user_login_history (user_id);",
        "CREATE INDEX IF NOT EXISTS ix_user_login_history_created_at ON user_login_history (created_at);"
    ]
    
    try:
        with engine.connect() as connection:
            # テーブル作成
            connection.execute(text(create_table_sql))
            print("UserLoginHistoryテーブルを作成しました")
            
            # インデックス作成
            for index_sql in create_indexes_sql:
                connection.execute(text(index_sql))
            print("UserLoginHistoryテーブルのインデックスを作成しました")
            
            connection.commit()
            print("マイグレーションが完了しました")
            
    except Exception as e:
        print(f"マイグレーションエラー: {e}")
        sys.exit(1)

if __name__ == "__main__":
    add_user_login_history_table()