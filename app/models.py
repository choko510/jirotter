from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    """ユーザーモデル"""
    __tablename__ = 'users'
    
    id = Column(String(80), primary_key=True, unique=True, nullable=False)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    bio = Column(Text, nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    points = Column(Integer, default=0, nullable=False)
    internal_score = Column(Integer, default=100, nullable=False)
    rank = Column(String(80), nullable=False, default='味覚ビギナー')
    account_status = Column(String(20), nullable=False, default='active')
    is_admin = Column(Boolean, nullable=False, default=False)

    # Relationships
    posts = relationship('Post', backref='author', lazy=True, cascade='all, delete-orphan')
    likes = relationship('Like', backref='user', lazy=True, cascade='all, delete-orphan')
    replies = relationship('Reply', backref='author', lazy=True, cascade='all, delete-orphan')
    point_logs = relationship('UserPointLog', backref='user', lazy=True, cascade='all, delete-orphan')
    titles = relationship('UserTitle', backref='user', lazy=True, cascade='all, delete-orphan')

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
    image_url = Column(String(255), nullable=True)  # 後方互換性のために残す
    thumbnail_url = Column(String(255), nullable=True)  # 低画質画像URL
    original_image_url = Column(String(255), nullable=True)  # 通常画質画像URL
    video_url = Column(String(255), nullable=True)  # 動画URL
    video_duration = Column(Float, nullable=True)  # 動画再生時間（秒）
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

    @property
    def author_profile_image_url(self):
        return self.author.profile_image_url if self.author else None

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

    @property
    def author_profile_image_url(self):
        return self.author.profile_image_url if self.author else None

class RamenShop(Base):
    """ラーメン店モデル"""
    __tablename__ = 'ramen_shops'
    __table_args__ = (
        Index('ix_ramen_shops_lat_lon', 'latitude', 'longitude'),
    )
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=False)
    business_hours = Column(String(255))
    closed_day = Column(String(255))
    seats = Column(String(255))
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    wait_time = Column(Integer, default=0)  # 待ち時間（分）
    last_update = Column(DateTime, default=datetime.utcnow)  # 最終更新時間


class RamenShopSubmission(Base):
    """店舗情報の提案・修正申請を管理するモデル"""
    __tablename__ = 'ramen_shop_submissions'

    id = Column(Integer, primary_key=True)
    shop_id = Column(Integer, ForeignKey('ramen_shops.id'), nullable=True, index=True)
    proposer_id = Column(String(80), ForeignKey('users.id'), nullable=False, index=True)
    change_type = Column(String(20), nullable=False, default='update')  # 'update' or 'new'
    proposed_changes = Column(JSON, nullable=False, default=dict)
    note = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default='pending')
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_id = Column(String(80), ForeignKey('users.id'), nullable=True)
    review_comment = Column(Text, nullable=True)

    proposer = relationship('User', foreign_keys=[proposer_id], backref='shop_submissions')
    reviewer = relationship('User', foreign_keys=[reviewer_id])
    shop = relationship('RamenShop', backref='submissions')

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
    wait_time_minutes = Column(Integer)  # 待ち時間（分）
    taste_rating = Column(Integer)  # 味の評価（1-5）
    flavor_notes = Column(Text)  # 味に関するメモ
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


class UserPointLog(Base):
    """ユーザーポイント履歴モデル"""
    __tablename__ = 'user_point_logs'

    id = Column(Integer, primary_key=True)
    user_id = Column(String(80), ForeignKey('users.id'), nullable=False, index=True)
    delta = Column(Integer, nullable=False)
    event_type = Column(String(50), nullable=False)
    reason = Column(String(255), nullable=False)
    context = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class UserTitle(Base):
    """ユーザーが獲得した称号を管理するモデル"""
    __tablename__ = 'user_titles'
    __table_args__ = (
        UniqueConstraint('user_id', 'title_key', name='uq_user_titles_user_key'),
        Index('ix_user_titles_user_id', 'user_id'),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(String(80), ForeignKey('users.id'), nullable=False)
    title_key = Column(String(80), nullable=False)
    title_name = Column(String(120), nullable=False)
    title_description = Column(String(255), nullable=False)
    category = Column(String(40), nullable=False)
    icon = Column(String(16), nullable=True)
    theme_color = Column(String(20), nullable=False, default='#f97316')
    prestige = Column(Integer, nullable=False, default=0)
    earned_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Checkin(Base):
    """チェックインモデル"""
    __tablename__ = 'checkins'
    __table_args__ = (
        Index('ix_checkins_shop_date', 'shop_id', 'checkin_date'),
    )
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(80), ForeignKey('users.id'), nullable=False)
    shop_id = Column(Integer, ForeignKey('ramen_shops.id'), nullable=False, index=True)
    checkin_date = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    # 位置情報
    latitude = Column(Float, nullable=True)  # GPSまたはEXIFから取得
    longitude = Column(Float, nullable=True)  # GPSまたはEXIFから取得
    location_source = Column(String(20), nullable=True)  # 'gps', 'exif', 'ip'
    location_accuracy = Column(Float, nullable=True)  # 位置情報の精度（メートル）
    
    # デバイス情報
    user_agent = Column(Text, nullable=True)
    device_type = Column(String(20), nullable=True)  # 'mobile', 'desktop', 'tablet'
    is_mobile_network = Column(Boolean, nullable=True)  # モバイルネットワーク判定
    
    # 検証情報
    verification_method = Column(String(50), nullable=True)  # 'gps', 'gps_exif', 'ip_only'
    verification_score = Column(Integer, nullable=True)  # 検証スコア（0-100）
    is_verified = Column(Boolean, default=False)
    
    # 待ち時間アンケート
    wait_time_reported = Column(Integer, nullable=True)  # 報告された待ち時間（分）
    wait_time_confidence = Column(Integer, nullable=True)  # 待ち時間の信頼度（1-5）
    
    # その他情報
    checkin_note = Column(Text, nullable=True)  # チェックイン時のメモ
    extra_data = Column(JSON, nullable=True)  # 追加情報（EXIFデータなど）
    
    # Relationships
    user = relationship('User', backref='checkins')
    shop = relationship('RamenShop', backref='checkins')
    
    @property
    def verification_level(self):
        """検証レベルを返す"""
        if self.verification_score is None:
            return 'unknown'

        if self.verification_score >= 90:
            return 'high'
        elif self.verification_score >= 60:
            return 'medium'
        else:
            return 'low'


class CheckinVerification(Base):
    """チェックイン検証ログモデル"""
    __tablename__ = 'checkin_verifications'
    
    id = Column(Integer, primary_key=True)
    checkin_id = Column(Integer, ForeignKey('checkins.id'), nullable=False)
    verification_type = Column(String(50), nullable=False)  # 'gps', 'exif', 'ip', 'device'
    verification_data = Column(JSON, nullable=True)  # 検証データ
    result = Column(String(20), nullable=False)  # 'success', 'failed', 'warning'
    score = Column(Integer, nullable=True)  # 検証スコア
    message = Column(Text, nullable=True)  # 検証メッセージ
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    checkin = relationship('Checkin', backref='verifications')
