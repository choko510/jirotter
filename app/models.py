from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    """ユーザーモデル"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # リレーションシップ
    posts = relationship('Post', backref='author', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """パスワードをハッシュ化して設定"""
        # 循環インポートを避けるため、ここではインポートしない
        from app.utils.auth import get_password_hash
        self.password_hash = get_password_hash(password)
    
    def check_password(self, password):
        """パスワードを検証"""
        # 循環インポートを避けるため、ここではインポートしない
        from app.utils.auth import verify_password
        return verify_password(password, self.password_hash)
    
    def to_dict(self):
        """ユーザー情報を辞書形式で返す"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }

class Post(Base):
    """投稿モデル"""
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """投稿情報を辞書形式で返す"""
        return {
            'id': self.id,
            'content': self.content,
            'user_id': self.user_id,
            'author_username': self.author.username,
            'created_at': self.created_at.isoformat()
        }

class RamenShop(Base):
    """ラーメン店モデル"""
    __tablename__ = 'ramen_shops'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=False)
    business_hours = Column(String(255))
    closed_day = Column(String(255))
    seats = Column(String(255))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    def to_dict(self):
        """ラーメン店情報を辞書形式で返す"""
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'business_hours': self.business_hours,
            'closed_day': self.closed_day,
            'seats': self.seats,
            'latitude': self.latitude,
            'longitude': self.longitude
        }