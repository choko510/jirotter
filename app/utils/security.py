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
    elif not re.match(r'^[a-zA-Z0-9_]+$', data.get('id')):
        errors['id'] = 'ユーザーIDは英数字とアンダースコア(_)のみで入力してください'
    
    if not data.get('email'):
        errors['email'] = 'メールアドレスは必須です'
    elif '@' not in data.get('email'):
        errors['email'] = '有効なメールアドレスを入力してください'
    
    password = data.get('password', '')
    if not password:
        errors['password'] = 'パスワードは必須です'
    elif len(password) < 8:
        errors['password'] = 'パスワードは8文字以上で入力してください'
    else:
        # 英字、数字、記号のチェック
        char_types = 0
        if re.search(r'[a-zA-Z]', password):
            char_types += 1
        if re.search(r'[0-9]', password):
            char_types += 1
        if re.search(r'[^a-zA-Z0-9]', password):
            char_types += 1

        if char_types < 2:
            errors['password'] = 'パスワードには英字、数字、記号のうち少なくとも2種類を含めてください'
    
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
    elif not re.match(r'^[a-zA-Z0-9_]+$', data.get('id')):
        errors['id'] = 'ユーザーIDは英数字とアンダースコア(_)のみで入力してください'
    
    if not data.get('password'):
        errors['password'] = 'パスワードは必須です'
    
    return errors

def escape_html(text: str) -> str:
    """HTML特殊文字をエスケープする"""
    if text is None:
        return ""
    return html.escape(text, quote=True)

def filter_allowed_characters(text: str) -> str:
    """許可された文字のみを残すフィルタリング関数"""
    if text is None:
        return ""
    
    # 許可する文字：ひらがな、カタカナ、漢字、英数字、記号（一部）、絵文字
    # Unicode範囲：
    # \u3040-\u309F: ひらがな
    # \u30A0-\u30FF: カタカナ
    # \u4E00-\u9FAF: 漢字（主な範囲）
    # \u3000-\u303F: 日本語の記号
    # \uFF00-\uFFEF: 半角カタカナ、全角記号など
    # \u2600-\u26FF: 各種記号
    # \u2700-\u27BF: 補助記号
    # \u1F600-\u1F64F: 絵文字（顔）
    # \u1F300-\u1F5FF: 絵文字（記号）
    # \u1F680-\u1F6FF: 絵文字（交通・記号）
    # \u1F700-\u1F77F: 絵文字（絵文字文字）
    # \u1F780-\u1F7FF: 絵文字（拡張）
    # \u1F800-\u1F8FF: 絵文字（補助）
    # \u1F900-\u1F9FF: 絵文字（補助記号）
    # \u2000-\u206F: 一般句読点
    # \u0020-\u007E: 基本ラテン文字（ASCII）
    # \u00A0-\u00FF: ラテン文字補助
    allowed_pattern = r'[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\uFF00-\uFFEF\u2600-\u26FF\u2700-\u27BF\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u1F700-\u1F77F\u1F780-\u1F7FF\u1F800-\u1F8FF\u1F900-\u1F9FF\u2000-\u206F\u0020-\u007E\u00A0-\u00FF\s]'
    
    # 許可されていない文字を削除
    filtered_text = re.sub(allowed_pattern, '', text)
    
    return filtered_text

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
    
    # 文字フィルタリング
    filtered_content = filter_allowed_characters(content)
    
    # フィルタリング後に内容が変わった場合は警告
    if filtered_content != content:
        # 特にエラーは返さず、フィルタリングした内容を使用
        content = filtered_content
    
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
    
    # 文字フィルタリング
    filtered_content = filter_allowed_characters(content)
    
    # フィルタリング後に内容が変わった場合は警告
    if filtered_content != content:
        # 特にエラーは返さず、フィルタリングした内容を使用
        content = filtered_content
    
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