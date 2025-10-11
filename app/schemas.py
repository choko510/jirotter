from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional, List

# User Schemas
class UserBase(BaseModel):
    id: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    id: str # username is now id
    password: str

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
    pass

class ReplyResponse(ReplyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    post_id: int
    author_username: str
    created_at: datetime

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
    pass

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
