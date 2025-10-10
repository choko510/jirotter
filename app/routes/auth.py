from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Dict, Any

from database import get_db
from app.models import User
from app.schemas import UserCreate, UserLogin, UserResponse, Token
from app.utils.auth import create_access_token, get_current_user, get_current_active_user
from app.utils.security import validate_registration_data, validate_login_data

router = APIRouter(tags=["auth"])

@router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """ユーザー登録エンドポイント"""
    # バリデーション
    validation_errors = validate_registration_data(user_data.model_dump(), db)
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=validation_errors
        )
    
    # ユーザー作成
    user = User(
        id=user_data.id,
        email=user_data.email
    )
    user.set_password(user_data.password)
    
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # アクセストークンの発行
        access_token = create_access_token(data={"sub": user.id})
        
        # ユーザーレスポンスの作成
        user_response = UserResponse.model_validate(user)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_response
        }
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ユーザー登録に失敗しました"
        )

@router.post("/auth/login", response_model=Token)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """ログインエンドポイント"""
    # バリデーション
    validation_errors = validate_login_data(login_data.model_dump())
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=validation_errors
        )
    
    # ユーザー認証
    user = db.query(User).filter(User.id == login_data.id).first()
    
    if not user or not user.check_password(login_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザーIDまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # アクセストークンの発行
    access_token = create_access_token(data={"sub": user.id})
    
    # ユーザーレスポンスの作成
    user_response = UserResponse.model_validate(user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

@router.get("/auth/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_active_user)):
    """ユーザープロフィール取得エンドポイント"""
    return UserResponse.model_validate(current_user)

@router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """ログアウトエンドポイント（クライアント側でトークンを削除する必要があります）"""
    return {"message": "ログアウトしました"}