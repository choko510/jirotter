from sqlalchemy.orm import Session
import re
import html
from app.models import User

def validate_registration_data(data: dict, db: Session) -> dict:
    """ユーザー登録データのバリデーション"""
    errors = {}
    
    if not data.get('id'):
        errors['id'] = 'ユーザーIDは必須です'
    elif len(data.get('id')) < 3:
        errors['id'] = 'ユーザーIDは3文字以上で入力してください'
    elif not re.match(r'^[a-zA-Z0-9]+$', data.get('id')):
        errors['id'] = 'ユーザーIDは英数字のみで入力してください'
    
    if not data.get('email'):
        errors['email'] = 'メールアドレスは必須です'
    elif '@' not in data.get('email'):
        errors['email'] = '有効なメールアドレスを入力してください'
    
    if not data.get('password'):
        errors['password'] = 'パスワードは必須です'
    elif len(data.get('password')) < 6:
        errors['password'] = 'パスワードは6文字以上で入力してください'
    
    # 既存ユーザーのチェック
    if db.query(User).filter(User.id == data.get('id')).first():
        errors['id'] = 'このユーザーIDは既に使用されています'
    
    if db.query(User).filter(User.email == data.get('email')).first():
        errors['email'] = 'このメールアドレスは既に登録されています'
    
    return errors

def validate_login_data(data: dict) -> dict:
    """ログインデータのバリデーション"""
    errors = {}
    
    if not data.get('id'):
        errors['id'] = 'ユーザーIDは必須です'
    elif not re.match(r'^[a-zA-Z0-9]+$', data.get('id')):
        errors['id'] = 'ユーザーIDは英数字のみで入力してください'
    
    if not data.get('password'):
        errors['password'] = 'パスワードは必須です'
    
    return errors

def escape_html(text: str) -> str:
    """HTML特殊文字をエスケープする"""
    if text is None:
        return ""
    return html.escape(text, quote=True)

def sanitize_content(content: str) -> str:
    """投稿内容をサニタイズする"""
    if content is None:
        return ""
    
    # HTMLタグを除去
    content = re.sub(r'<[^>]+>', '', content)
    
    # 危険なJavaScriptイベントハンドラを除去（最適化されたパターン）
    # 具体的なイベントハンドラ名を明示的に指定することで、バックトラッキングを削減
    dangerous_handlers = [
        r'onclick\s*=', r'ondblclick\s*=', r'onmousedown\s*=', r'onmouseup\s*=', r'onmouseover\s*=',
        r'onmouseout\s*=', r'onmousemove\s*=', r'onkeydown\s*=', r'onkeyup\s*=', r'onkeypress\s*=',
        r'onload\s*=', r'onunload\s*=', r'onchange\s*=', r'onsubmit\s*=', r'onreset\s*=', r'onselect\s*=',
        r'onblur\s*=', r'onfocus\s*=', r'onresize\s*=', r'onerror\s*=', r'onscroll\s*='
    ]
    
    for pattern in dangerous_handlers:
        content = re.sub(pattern, '', content, flags=re.IGNORECASE)
    
    # JavaScriptプロトコルを除去
    content = re.sub(r'javascript\s*:', '', content, flags=re.IGNORECASE)
    
    # 余分な空白を整理
    content = re.sub(r'\s+', ' ', content).strip()
    
    return content

def validate_post_content(content: str) -> dict:
    """投稿内容のバリデーションとサニタイズ"""
    errors = {}
    
    if not content or not content.strip():
        errors['content'] = '投稿内容は必須です'
        return errors, None
    
    # 長さチェック
    if len(content) > 200:
        errors['content'] = '投稿内容は200文字以内で入力してください'
        return errors, None
    
    # サニタイズ
    sanitized_content = sanitize_content(content)
    
    # サニタイズ後の内容チェック
    if not sanitized_content.strip():
        errors['content'] = '有効な投稿内容を入力してください'
        return errors, None
    
    return errors, sanitized_content

def validate_reply_content(content: str) -> dict:
    """返信内容のバリデーションとサニタイズ"""
    errors = {}
    
    if not content or not content.strip():
        errors['content'] = '返信内容は必須です'
        return errors, None
    
    # 長さチェック
    if len(content) > 200:
        errors['content'] = '返信内容は200文字以内で入力してください'
        return errors, None
    
    # サニタイズ
    sanitized_content = sanitize_content(content)
    
    # サニタイズ後の内容チェック
    if not sanitized_content.strip():
        errors['content'] = '有効な返信内容を入力してください'
        return errors, None
    
    return errors, sanitized_content