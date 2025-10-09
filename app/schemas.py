from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class PostBase(BaseModel):
    content: str

class PostCreate(PostBase):
    pass

class PostResponse(PostBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    author_username: str
    created_at: datetime

class PostsResponse(BaseModel):
    posts: List[PostResponse]
    total: int
    pages: int
    current_page: int

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