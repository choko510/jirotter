from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from app.models import User
from app.schemas import UserCreate, UserLogin, UserResponse, Token
from app.utils.auth import create_access_token, get_current_active_user

router = APIRouter(tags=["auth"])

def _create_token_response(user: User) -> dict:
    """ユーザーオブジェクトからトークンレスポンスを生成します。"""
    access_token = create_access_token(data={"sub": user.id})
    user_response = UserResponse.model_validate(user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

async def check_existing_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """ユーザーIDとメールアドレスの重複をチェックする依存関係"""
    if db.query(User).filter(User.id == user_data.id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="このユーザーIDは既に使用されています"
        )
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="このメールアドレスは既に登録されています"
        )

@router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _: None = Depends(check_existing_user)
):
    """
    新しいユーザーを登録し、認証トークンを返します。
    - **id**: ユーザーID (3文字以上)
    - **email**: メールアドレス
    - **password**: パスワード (6文字以上)
    """
    user = User(id=user_data.id, email=user_data.email)
    user.set_password(user_data.password)
    
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return _create_token_response(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ユーザー登録中に予期せぬエラーが発生しました。"
        )

@router.post("/auth/login", response_model=Token)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    ユーザーを認証し、新しいアクセストークンを発行します。
    """
    user = db.query(User).filter(User.id == login_data.id).first()
    
    if not user or not user.check_password(login_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザーIDまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return _create_token_response(user)

@router.get("/auth/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_active_user)):
    """
    現在認証されているユーザーのプロフィール情報を取得します。
    """
    return current_user

@router.post("/auth/logout", status_code=status.HTTP_200_OK)
async def logout():
    """
    ログアウト処理を行います。(クライアント側でのトークン削除が主)
    """
    return {"message": "ログアウトしました"}