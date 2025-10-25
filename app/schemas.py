from pydantic import BaseModel, EmailStr, ConfigDict, field_validator, field_serializer
from datetime import datetime
from typing import Optional, List
import re
from app.utils.security import escape_html

# User Schemas
class UserBase(BaseModel):
    id: str
    email: EmailStr
    
    @field_validator('id')
    @classmethod
    def validate_username(cls, v):
        if not re.match(r'^[a-zA-Z0-9]+$', v):
            raise ValueError('ユーザーIDは英数字のみで入力してください')
        return v

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    id: str # username is now id
    password: str
    
    @field_validator('id')
    @classmethod
    def validate_username(cls, v):
        if not re.match(r'^[a-zA-Z0-9]+$', v):
            raise ValueError('ユーザーIDは英数字のみで入力してください')
        return v

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    username: str
    email: EmailStr
    created_at: datetime
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None

    @field_validator('username')
    @classmethod
    def validate_username_update(cls, v):
        if v is not None:
            if not re.match(r'^[a-zA-Z0-9_]{3,20}$', v):
                raise ValueError('ユーザー名は3〜20文字の英数字とアンダースコア(_)のみ使用できます')
        return v

    @field_validator('bio')
    @classmethod
    def validate_bio_length(cls, v):
        if v is not None and len(v) > 200:
            raise ValueError('自己紹介は200文字以内で入力してください')
        return v

    @field_validator('profile_image_url')
    @classmethod
    def validate_url(cls, v):
        if v is not None and v.strip() != '':
            value = v.strip()
            if value.startswith('/uploads/') or value.startswith('data:'):
                return value

            if not re.match(r'^https?://[^\s/$.?#].[^\s]*$', value):
                raise ValueError('有効なURLを入力してください')
            return value
        return v

class UserProfileResponse(UserResponse):
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    followers_count: int
    following_count: int
    posts_count: int
    is_following: bool # Indicates if the current user is following this user

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Reply Schemas
class ReplyBase(BaseModel):
    content: str

class ReplyCreate(ReplyBase):
    @field_validator('content')
    @classmethod
    def validate_content_length(cls, v):
        if len(v) > 200:
            raise ValueError('返信内容は200文字以内で入力してください')
        return v

class ReplyResponse(ReplyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    post_id: int
    author_username: str
    author_profile_image_url: Optional[str] = None
    created_at: datetime

    @field_serializer('content')
    def serialize_content(self, value):
        return escape_html(value)

    @field_serializer('author_username')
    def serialize_author_username(self, value):
        return escape_html(value)

    @field_serializer('author_profile_image_url')
    def serialize_author_profile_image_url(self, value):
        return escape_html(value) if value else value

# Like Schemas
class LikeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    post_id: int

# Post Schemas
class PostBase(BaseModel):
    content: str

class PostCreate(PostBase):
    shop_id: Optional[int] = None
    
    @field_validator('content')
    @classmethod
    def validate_content_length(cls, v):
        if len(v) > 200:
            raise ValueError('投稿内容は200文字以内で入力してください')
        return v

class PostResponse(PostBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    author_username: str
    author_profile_image_url: Optional[str] = None
    image_url: Optional[str] = None  # 後方互換性のために残す
    thumbnail_url: Optional[str] = None  # 低画質画像URL
    original_image_url: Optional[str] = None  # 通常画質画像URL
    shop_id: Optional[int] = None
    shop_name: Optional[str] = None
    shop_address: Optional[str] = None
    created_at: datetime
    likes_count: int
    replies_count: int
    replies: List[ReplyResponse] = []
    is_liked_by_current_user: bool = False
    
    @field_serializer('content')
    def serialize_content(self, value):
        return escape_html(value)
    
    @field_serializer('author_username')
    def serialize_author_username(self, value):
        return escape_html(value)

    @field_serializer('author_profile_image_url')
    def serialize_author_profile_image_url(self, value):
        return escape_html(value) if value else value

    @field_serializer('image_url')
    def serialize_image_url(self, value):
        return escape_html(value) if value else value
    
    @field_serializer('thumbnail_url')
    def serialize_thumbnail_url(self, value):
        return escape_html(value) if value else value
    
    @field_serializer('original_image_url')
    def serialize_original_image_url(self, value):
        return escape_html(value) if value else value
    
    @field_serializer('shop_name')
    def serialize_shop_name(self, value):
        return escape_html(value) if value else value
    
    @field_serializer('shop_address')
    def serialize_shop_address(self, value):
        return escape_html(value) if value else value

class PostsResponse(BaseModel):
    posts: List[PostResponse]
    total: int
    pages: int
    current_page: int

# Ramen Shop Schemas
class RamenShopBase(BaseModel):
    name: str
    address: str
    business_hours: Optional[str] = None
    closed_day: Optional[str] = None
    seats: Optional[str] = None
    latitude: float
    longitude: float

class RamenShopResponse(RamenShopBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    distance: Optional[float] = None
    wait_time: Optional[int] = None
    last_update: Optional[datetime] = None

class RamenShopsResponse(BaseModel):
    shops: List[RamenShopResponse]
    total: int

# Visit Schemas
class VisitBase(BaseModel):
    visit_date: datetime
    rating: Optional[int] = None
    comment: Optional[str] = None
    image_url: Optional[str] = None

class VisitCreate(VisitBase):
    shop_id: int
    
    @field_validator('rating')
    @classmethod
    def validate_rating(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('評価は1から5の間で入力してください')
        return v
    
    @field_validator('comment')
    @classmethod
    def validate_comment_length(cls, v):
        if v is not None and len(v) > 500:
            raise ValueError('コメントは500文字以内で入力してください')
        return v

class VisitResponse(VisitBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: str
    shop_id: int
    created_at: datetime
    shop_name: str
    shop_address: str
    author_username: str
    
    @field_serializer('comment')
    def serialize_comment(self, value):
        return escape_html(value) if value else value
    
    @field_serializer('shop_name')
    def serialize_shop_name(self, value):
        return escape_html(value)
    
    @field_serializer('shop_address')
    def serialize_shop_address(self, value):
        return escape_html(value)
    
    @field_serializer('author_username')
    def serialize_author_username(self, value):
        return escape_html(value)
    
    @field_serializer('image_url')
    def serialize_image_url(self, value):
        return escape_html(value) if value else value

class VisitsResponse(BaseModel):
    visits: List[VisitResponse]
    total: int


# Report Schemas
class ReportBase(BaseModel):
    reason: str
    description: Optional[str] = None

class ReportCreate(ReportBase):
    @field_validator('reason')
    @classmethod
    def validate_reason(cls, v):
        valid_reasons = [
            "スパム・広告",
            "過度な宣伝",
            "繰り返し投稿",
            "暴力的・グロテスクな内容",
            "性的な内容",
            "不快な表現",
            "人種・民族差別",
            "性差別",
            "障害者差別",
            "その他の差別",
            "個人攻撃",
            "脅迫",
            "いじめ",
            "ストーカー行為",
            "デマ・偽情報",
            "医療・健康に関する誤情報",
            "政治に関する誤情報",
            "無断転載",
            "画像の無断使用",
            "その他の著作権侵害",
            "プライバシー侵害",
            "自殺・自傷を助長する内容",
            "その他"
        ]
        if v not in valid_reasons:
            raise ValueError(f'通報理由は次の中から選択してください: {", ".join(valid_reasons)}')
        return v
    
    @field_validator('description')
    @classmethod
    def validate_description_length(cls, v):
        if v is not None and len(v) > 500:
            raise ValueError('詳細は500文字以内で入力してください')
        return v

class ReportResponse(ReportBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    post_id: int
    reporter_id: str
    created_at: datetime


# Checkin Schemas
class CheckinBase(BaseModel):
    checkin_date: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_source: Optional[str] = None
    location_accuracy: Optional[float] = None
    wait_time_reported: Optional[int] = None
    wait_time_confidence: Optional[int] = None
    checkin_note: Optional[str] = None

class CheckinCreate(CheckinBase):
    shop_id: int
    user_agent: Optional[str] = None
    device_type: Optional[str] = None
    is_mobile_network: Optional[bool] = None
    extra_data: Optional[dict] = None
    
    @field_validator('wait_time_reported')
    @classmethod
    def validate_wait_time(cls, v):
        if v is not None and (v < 0 or v > 300):
            raise ValueError('待ち時間は0分から300分の間で入力してください')
        return v
    
    @field_validator('wait_time_confidence')
    @classmethod
    def validate_confidence(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('信頼度は1から5の間で入力してください')
        return v
    
    @field_validator('location_source')
    @classmethod
    def validate_location_source(cls, v):
        if v is not None and v not in ['gps', 'exif', 'ip']:
            raise ValueError('位置情報ソースはgps、exif、ipのいずれかでなければなりません')
        return v

class CheckinResponse(CheckinBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: str
    shop_id: int
    verification_method: Optional[str] = None
    verification_score: Optional[int] = None
    is_verified: bool
    verification_level: str
    shop_name: str
    shop_address: str
    author_username: str
    
    @field_serializer('checkin_note')
    def serialize_checkin_note(self, value):
        return escape_html(value) if value else value
    
    @field_serializer('shop_name')
    def serialize_shop_name(self, value):
        return escape_html(value)
    
    @field_serializer('shop_address')
    def serialize_shop_address(self, value):
        return escape_html(value)
    
    @field_serializer('author_username')
    def serialize_author_username(self, value):
        return escape_html(value)

class CheckinsResponse(BaseModel):
    checkins: List[CheckinResponse]
    total: int

class CheckinVerificationRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    shop_id: int
    location_source: str = 'gps'
    location_accuracy: Optional[float] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None
    is_mobile_network: Optional[bool] = None
    exif_data: Optional[dict] = None

class CheckinVerificationResponse(BaseModel):
    is_valid: bool
    verification_score: int
    verification_method: str
    verification_level: str
    warnings: List[str] = []
    errors: List[str] = []

class NearbyShopsForCheckinRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: float = 0.5  # デフォルトは500m範囲
    include_ip_location: bool = False

class NearbyShopsForCheckinResponse(BaseModel):
    shops: List[dict]
    can_checkin: bool
    recommended_shop: Optional[dict] = None
    location_method: str  # 'gps', 'ip', 'manual'

class WaitTimeReportRequest(BaseModel):
    shop_id: int
    wait_time: int
    confidence: int = 3
    checkin_id: Optional[int] = None
    
    @field_validator('wait_time')
    @classmethod
    def validate_wait_time(cls, v):
        if v < 0 or v > 300:
            raise ValueError('待ち時間は0分から300分の間で入力してください')
        return v
    
    @field_validator('confidence')
    @classmethod
    def validate_confidence(cls, v):
        if v < 1 or v > 5:
            raise ValueError('信頼度は1から5の間で入力してください')
        return v

class WaitTimeReportResponse(BaseModel):
    success: bool
    updated_wait_time: int
    previous_wait_time: Optional[int] = None
    message: str

# Stamp Rally Schemas
class StampProgressItem(BaseModel):
    prefecture: str
    total_shops: int
    visited_shops: int

class StampProgressResponse(BaseModel):
    progress: List[StampProgressItem]