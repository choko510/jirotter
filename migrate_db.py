import sqlite3
import os

db_path = 'sns.db'
if not os.path.exists(db_path):
    print(f"Database file {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing columns
try:
    cursor.execute("PRAGMA table_info(reports)")
    columns = [info[1] for info in cursor.fetchall()]
    print(f"Current columns in 'reports': {columns}")

    # Add target_user_id if missing
    if 'target_user_id' not in columns:
        print("Adding 'target_user_id' column...")
        try:
            cursor.execute("ALTER TABLE reports ADD COLUMN target_user_id VARCHAR(80) REFERENCES users(id)")
            print("Added 'target_user_id'.")
        except Exception as e:
            print(f"Error adding 'target_user_id': {e}")
    else:
        print("'target_user_id' already exists.")

    # Add reply_id if missing
    if 'reply_id' not in columns:
        print("Adding 'reply_id' column...")
        try:
            cursor.execute("ALTER TABLE reports ADD COLUMN reply_id INTEGER REFERENCES replies(id)")
            print("Added 'reply_id'.")
        except Exception as e:
            print(f"Error adding 'reply_id': {e}")
    else:
        print("'reply_id' already exists.")

    conn.commit()
except Exception as e:
    print(f"An error occurred: {e}")
finally:
    conn.close()
