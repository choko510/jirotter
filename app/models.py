from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    """ユーザーモデル"""
    __tablename__ = 'users'
    
    id = Column(String(80), primary_key=True, unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    posts = relationship('Post', backref='author', lazy=True, cascade='all, delete-orphan')
    likes = relationship('Like', backref='user', lazy=True, cascade='all, delete-orphan')
    replies = relationship('Reply', backref='author', lazy=True, cascade='all, delete-orphan')

    following = relationship(
        'Follow',
        foreign_keys='Follow.follower_id',
        backref='follower',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )
    followers = relationship(
        'Follow',
        foreign_keys='Follow.followed_id',
        backref='followed',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )
    
    @property
    def username(self):
        return self.id

    def set_password(self, password):
        from app.utils.auth import get_password_hash
        self.password_hash = get_password_hash(password)
    
    def check_password(self, password):
        from app.utils.auth import verify_password
        return verify_password(password, self.password_hash)
    
    def to_dict(self):
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
    user_id = Column(String(80), ForeignKey('users.id'), nullable=False)
    image_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    likes = relationship('Like', backref='post', lazy=True, cascade='all, delete-orphan')
    replies = relationship('Reply', backref='post', lazy=True, cascade='all, delete-orphan')

    @property
    def author_username(self):
        return self.author.username

    @property
    def likes_count(self):
        return len(self.likes)

    def to_dict(self):
        """投稿情報を辞書形式で返す"""
        return {
            'id': self.id,
            'content': self.content,
            'user_id': self.user_id,
            'author_username': self.author.username,
            'image_url': self.image_url,
            'created_at': self.created_at.isoformat(),
            'likes_count': len(self.likes),
            'replies_count': len(self.replies)
        }

class Follow(Base):
    """フォローモデル"""
    __tablename__ = 'follows'

    follower_id = Column(String(80), ForeignKey('users.id'), primary_key=True)
    followed_id = Column(String(80), ForeignKey('users.id'), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Like(Base):
    """いいねモデル"""
    __tablename__ = 'likes'

    id = Column(Integer, primary_key=True)
    user_id = Column(String(80), ForeignKey('users.id'), nullable=False)
    post_id = Column(Integer, ForeignKey('posts.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Reply(Base):
    """返信モデル"""
    __tablename__ = 'replies'

    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    user_id = Column(String(80), ForeignKey('users.id'), nullable=False)
    post_id = Column(Integer, ForeignKey('posts.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'content': self.content,
            'user_id': self.user_id,
            'author_username': self.author.username,
            'post_id': self.post_id,
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