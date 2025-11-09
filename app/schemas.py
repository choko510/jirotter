from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator, field_serializer, model_validator
from datetime import datetime
from typing import Optional, List, Dict, Literal
import re
from app.utils.security import escape_html

# User Schemas
class UserBase(BaseModel):
    id: str
    email: EmailStr
    
    @field_validator('id')
    @classmethod
    def validate_username(cls, v):
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('ユーザーIDは英数字とアンダースコア(_)のみで入力してください')
        return v

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    id: str # username is now id
    password: str
    
    @field_validator('id')
    @classmethod
    def validate_username(cls, v):
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('ユーザーIDは英数字とアンダースコア(_)のみで入力してください')
        return v

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    # ニックネーム（任意・重複可）。nullの場合はフロント側でidをフォールバック表示する想定。
    username: Optional[str] = None
    email: EmailStr
    created_at: datetime
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    points: int
    rank: str
    internal_score: int
    account_status: str
class UserUpdate(BaseModel):
    # ニックネーム（任意・重複可）
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None

    @field_validator('username')
    @classmethod
    def validate_username_update(cls, v):
        if v is None:
            return v
        value = v.strip()
        if value == "":
            # 空文字は未設定扱いとしてNoneに正規化
            return None
        # 許可: 任意文字列（長さ制限のみ）※重複可
        if len(value) > 40:
            raise ValueError('ニックネームは40文字以内で入力してください')
        return value
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

class UserTitleRequirement(BaseModel):
    metric: str
    label: str
    current: int
    required: int


class UserTitleSummary(BaseModel):
    key: str
    name: str
    description: str
    category: str
    icon: Optional[str] = None
    theme_color: str
    prestige: int
    unlocked: bool
    earned_at: Optional[datetime] = None
    progress: float
    progress_label: str
    requirements: List[UserTitleRequirement] = Field(default_factory=list)


class UserTitleBrief(BaseModel):
    key: str
    name: str
    description: str
    icon: Optional[str] = None
    theme_color: Optional[str] = None
    prestige: int
    earned_at: Optional[datetime] = None


class UserProfileResponse(UserResponse):
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    followers_count: int
    following_count: int
    posts_count: int
    is_following: bool # Indicates if the current user is following this user
    rank_color: str
    rank_description: str
    next_rank_name: Optional[str] = None
    next_rank_points: Optional[int] = None
    points_to_next_rank: Optional[int] = None
    current_rank_floor: int
    rank_progress_percentage: float
    status_message: str
    featured_title: Optional[UserTitleBrief] = None
    titles: List[UserTitleSummary] = Field(default_factory=list)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AdminUserSummary(BaseModel):
    id: str
    username: str
    email: EmailStr
    created_at: datetime
    points: int
    internal_score: int
    rank: str
    account_status: str
    effective_account_status: str
    account_status_override: Optional[str] = None
    posting_restriction_expires_at: Optional[datetime] = None
    ban_expires_at: Optional[datetime] = None
    moderation_note: Optional[str] = None
    moderation_updated_at: Optional[datetime] = None
    moderated_by_id: Optional[str] = None
    is_admin: bool
    posts_count: int
    reports_submitted: int
    reports_received: int


class AdminUserDetail(AdminUserSummary):
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    followers_count: int
    following_count: int
    shop_submissions_count: int


class AdminUserListResponse(BaseModel):
    users: List[AdminUserSummary]
    total: int


class AdminUserModerationUpdate(BaseModel):
    account_status_override: Optional[Literal["active", "warning", "restricted", "banned"]] = None
    revert_account_status_override: bool = False
    posting_restriction_expires_at: Optional[datetime] = None
    clear_posting_restriction: bool = False
    ban_expires_at: Optional[datetime] = None
    clear_ban_schedule: bool = False
    moderation_note: Optional[str] = Field(None, max_length=500)
    is_admin: Optional[bool] = None


class AdminOverviewResponse(BaseModel):
    total_users: int
    active_users: int
    restricted_users: int
    banned_users: int
    new_users_last_week: int
    total_shops: int
    pending_shop_submissions: int
    reports_last_week: int


class UserRankingEntry(BaseModel):
    id: str
    username: str
    profile_image_url: Optional[str] = None
    points: int
    rank: str
    rank_color: str
    rank_description: str
    position: int
    rank_progress_percentage: float
    next_rank_name: Optional[str] = None
    points_to_next_rank: Optional[int] = None
    followers_count: int
    total_titles: int
    featured_title: Optional[UserTitleBrief] = None
    recent_titles: List[UserTitleBrief] = Field(default_factory=list)


class UserRankingResponse(BaseModel):
    top_users: List[UserRankingEntry]
    you: Optional[UserRankingEntry] = None
    total_users: int
    last_updated: datetime
    title_catalog: List[UserTitleSummary] = Field(default_factory=list)

# 通報スキーマ（posts用）
class PostReportCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)


class PostReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    reporter_id: str
    reason: str
    description: Optional[str] = None
    created_at: datetime


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
    is_shadow_banned: bool = False
    shadow_ban_reason: Optional[str] = None

    @field_serializer('content')
    def serialize_content(self, value):
        return escape_html(value)

    @field_serializer('author_username')
    def serialize_author_username(self, value):
        return escape_html(value)

    @field_serializer('author_profile_image_url')
    def serialize_author_profile_image_url(self, value):
        return escape_html(value) if value else value

    @field_serializer('shadow_ban_reason')
    def serialize_shadow_ban_reason(self, value):
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
    video_url: Optional[str] = None  # 動画URL
    video_duration: Optional[float] = None  # 動画再生時間（秒）
    shop_id: Optional[int] = None
    shop_name: Optional[str] = None
    shop_address: Optional[str] = None
    created_at: datetime
    likes_count: int
    replies_count: int
    replies: List[ReplyResponse] = []
    is_liked_by_current_user: bool = False
    is_shadow_banned: bool = False
    shadow_ban_reason: Optional[str] = None

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

    @field_serializer('shadow_ban_reason')
    def serialize_shadow_ban_reason(self, value):
        return escape_html(value) if value else value

    @field_serializer('shop_address')
    def serialize_shop_address(self, value):
        return escape_html(value) if value else value

    @field_serializer('video_url')
    def serialize_video_url(self, value):
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


class AdminShopSummary(BaseModel):
    id: int
    name: str
    address: str
    business_hours: Optional[str] = None
    closed_day: Optional[str] = None
    seats: Optional[str] = None
    latitude: float
    longitude: float
    wait_time: Optional[int] = None
    last_update: Optional[datetime] = None
    posts_count: int
    pending_submissions: int


class AdminShopDetail(AdminShopSummary):
    submissions_total: int


class AdminShopCreate(RamenShopBase):
    wait_time: Optional[int] = None


class AdminShopUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    business_hours: Optional[str] = None
    closed_day: Optional[str] = None
    seats: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    wait_time: Optional[int] = None


class AdminShopListResponse(BaseModel):
    shops: List[AdminShopSummary]
    total: int


class ShopLockRequest(BaseModel):
    shop_id: int
    # WebSocketではサーバ側で current_admin_user を使うのでここでは最低限


class ShopHistoryItem(BaseModel):
    id: int
    field: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_at: datetime
    changed_by: str
    change_type: str


class ShopHistoryResponse(BaseModel):
    history: List[ShopHistoryItem]
    total: int


class SubmissionUserInfo(BaseModel):
    id: str
    username: str


class RamenShopSubmissionBase(BaseModel):
    change_type: Literal["update", "new"]
    shop_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=255)
    business_hours: Optional[str] = Field(None, max_length=255)
    closed_day: Optional[str] = Field(None, max_length=255)
    seats: Optional[str] = Field(None, max_length=255)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    note: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def validate_submission(self):
        if self.change_type == "update":
            if not self.shop_id:
                raise ValueError("既存店舗の更新にはshop_idが必要です")

            changes = self.collect_changes()
            if not changes:
                raise ValueError("更新する項目を1つ以上入力してください")

        if self.change_type == "new":
            missing_fields = [
                field
                for field, value in {
                    "name": self.name,
                    "address": self.address,
                    "latitude": self.latitude,
                    "longitude": self.longitude,
                }.items()
                if value in (None, "")
            ]
            if missing_fields:
                raise ValueError("新規店舗の登録には店舗名、住所、緯度、経度が必要です")

        return self

    def collect_changes(self) -> Dict[str, object]:
        changes = {
            key: value
            for key, value in {
                "name": self.name,
                "address": self.address,
                "business_hours": self.business_hours,
                "closed_day": self.closed_day,
                "seats": self.seats,
                "latitude": self.latitude,
                "longitude": self.longitude,
            }.items()
            if value is not None and value != ""
        }

        if "latitude" in changes:
            changes["latitude"] = float(changes["latitude"])
        if "longitude" in changes:
            changes["longitude"] = float(changes["longitude"])

        return changes


class RamenShopSubmissionCreate(RamenShopSubmissionBase):
    pass


class RamenShopSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    change_type: Literal["update", "new"]
    shop_id: Optional[int] = None
    status: str
    note: Optional[str] = None
    proposed_changes: Dict[str, object] = Field(default_factory=dict)
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    proposer: SubmissionUserInfo
    reviewer: Optional[SubmissionUserInfo] = None


class RamenShopSubmissionReview(BaseModel):
    comment: Optional[str] = Field(None, max_length=500)

# Visit Schemas
class VisitBase(BaseModel):
    visit_date: datetime
    rating: Optional[int] = None
    comment: Optional[str] = None
    image_url: Optional[str] = None
    wait_time_minutes: Optional[int] = None
    taste_rating: Optional[int] = None
    flavor_notes: Optional[str] = None

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

    @field_validator('wait_time_minutes')
    @classmethod
    def validate_wait_time(cls, v):
        if v is not None and (v < 0 or v > 300):
            raise ValueError('待ち時間は0分から300分の間で入力してください')
        return v

    @field_validator('taste_rating')
    @classmethod
    def validate_taste_rating(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('味の評価は1から5の間で入力してください')
        return v

    @field_validator('flavor_notes')
    @classmethod
    def validate_flavor_notes(cls, v):
        if v is not None and len(v) > 500:
            raise ValueError('味のメモは500文字以内で入力してください')
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

    @field_serializer('flavor_notes')
    def serialize_flavor_notes(self, value):
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
            "性的な内容",
            "差別・攻撃的な内容",
            "デマ・偽情報",
            "権利侵害",
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

# Visited Shops Schemas
class VisitedShopItem(BaseModel):
    id: int
    name: str
    address: str
    checkin_date: datetime
    visit_images: List[str] = []

class VisitedShopsByPrefecture(BaseModel):
    prefecture: str
    shops: List[VisitedShopItem]

class VisitedShopsResponse(BaseModel):
    visited_shops: List[VisitedShopsByPrefecture]
    total_shops: int