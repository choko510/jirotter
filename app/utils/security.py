from sqlalchemy.orm import Session
from app.models import User

def validate_registration_data(data: dict, db: Session) -> dict:
    """ユーザー登録データのバリデーション"""
    errors = {}
    
    if not data.get('username'):
        errors['username'] = 'ユーザー名は必須です'
    elif len(data.get('username')) < 3:
        errors['username'] = 'ユーザー名は3文字以上で入力してください'
    
    if not data.get('email'):
        errors['email'] = 'メールアドレスは必須です'
    elif '@' not in data.get('email'):
        errors['email'] = '有効なメールアドレスを入力してください'
    
    if not data.get('password'):
        errors['password'] = 'パスワードは必須です'
    elif len(data.get('password')) < 6:
        errors['password'] = 'パスワードは6文字以上で入力してください'
    
    # 既存ユーザーのチェック
    if db.query(User).filter(User.username == data.get('username')).first():
        errors['username'] = 'このユーザー名は既に使用されています'
    
    if db.query(User).filter(User.email == data.get('email')).first():
        errors['email'] = 'このメールアドレスは既に登録されています'
    
    return errors

def validate_login_data(data: dict) -> dict:
    """ログインデータのバリデーション"""
    errors = {}
    
    if not data.get('username'):
        errors['username'] = 'ユーザー名は必須です'
    
    if not data.get('password'):
        errors['password'] = 'パスワードは必須です'
    
    return errors