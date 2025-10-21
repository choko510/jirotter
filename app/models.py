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
    

class Post(Base):
    """投稿モデル"""
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    user_id = Column(String(80), ForeignKey('users.id'), nullable=False)
    image_url = Column(String(255), nullable=True)
    shop_id = Column(Integer, ForeignKey('ramen_shops.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    likes = relationship('Like', backref='post', lazy=True, cascade='all, delete-orphan')
    replies = relationship('Reply', backref='post', lazy=True, cascade='all, delete-orphan')
    shop = relationship('RamenShop', backref='posts')

    @property
    def author_username(self):
        return self.author.username

    @property
    def likes_count(self):
        return len(self.likes)

    @property
    def replies_count(self):
        return len(self.replies)

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

    @property
    def author_username(self):
        return self.author.username

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

class Visit(Base):
    """訪問記録モデル"""
    __tablename__ = 'visits'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(80), ForeignKey('users.id'), nullable=False)
    shop_id = Column(Integer, ForeignKey('ramen_shops.id'), nullable=False)
    visit_date = Column(DateTime, nullable=False)
    rating = Column(Integer)  # 1-5の評価
    comment = Column(Text)
    image_url = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship('User', backref='visits')
    shop = relationship('RamenShop', backref='visits')

class Report(Base):
    """通報モデル"""
    __tablename__ = 'reports'
    
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey('posts.id'), nullable=False)
    reporter_id = Column(String(80), ForeignKey('users.id'), nullable=False)
    reason = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    post = relationship('Post', backref='reports')
    reporter = relationship('User', backref='reports_made')