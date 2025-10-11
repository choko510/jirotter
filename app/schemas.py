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

class UserProfileResponse(UserResponse):
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
    created_at: datetime
    
    @field_serializer('content')
    def serialize_content(self, value):
        return escape_html(value)
    
    @field_serializer('author_username')
    def serialize_author_username(self, value):
        return escape_html(value)

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
    image_url: Optional[str] = None
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
    
    @field_serializer('image_url')
    def serialize_image_url(self, value):
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

class RamenShopsResponse(BaseModel):
    shops: List[RamenShopResponse]
    total: int
