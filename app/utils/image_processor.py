"""
画像処理ユーティリティ
WebP変換、リサイズ、品質調整機能を提供
"""

import os
import time
from typing import Tuple, Optional
from PIL import Image
import io
from fastapi import UploadFile
import tempfile
import shutil


def ensure_directories_exist():
    """必要なディレクトリが存在することを確認"""
    os.makedirs("uploads/thumbnails", exist_ok=True)
    os.makedirs("uploads/original", exist_ok=True)
    os.makedirs("uploads/profile_icons", exist_ok=True)


def process_image(image: UploadFile, user_id: str) -> Tuple[Optional[str], Optional[str]]:
    """
    アップロードされた画像を処理してWebP形式に変換
    
    Args:
        image: アップロードされた画像ファイル
        user_id: ユーザーID
        
    Returns:
        Tuple[thumbnail_url, original_url]: サムネイルと元画像のURL
    """
    try:
        # 必要なディレクトリを確認
        ensure_directories_exist()
        
        # ファイルを一時的に保存
        image.file.seek(0)
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            shutil.copyfileobj(image.file, temp_file)
            temp_file_path = temp_file.name
        
        try:
            # PILで画像を開く
            with Image.open(temp_file_path) as img:
                # EXIFからGPS情報を除去（位置情報をサーバー側で削除）
                try:
                    exif = img.getexif()
                    if exif:
                        from PIL.ExifTags import TAGS

                        gps_tag_id = None
                        for tag_id, tag_name in TAGS.items():
                            if tag_name == "GPSInfo":
                                gps_tag_id = tag_id
                                break

                        if gps_tag_id is not None and gps_tag_id in exif:
                            del exif[gps_tag_id]

                        # PillowのWebP保存では EXIF をそのまま保存しないケースも多いが、
                        # 念のため他形式に拡張されてもGPSは含まれないようにクリーンなEXIFを用意
                        img.info["exif"] = exif.tobytes()
                except Exception as exif_err:
                    # EXIF処理に失敗してもアップロード自体は継続（安全側でログのみ）
                    print(f"EXIF削除処理エラー: {exif_err}")
                # RGBモードに変換（必要な場合）
                if img.mode in ('RGBA', 'LA', 'P'):
                    # 透明度を持つ画像は白背景で合成
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # 元の解像度を保持
                original_size = img.size
                
                # タイムスタンプを生成
                timestamp = int(time.time())
                
                # 通常画質画像（元の解像度、品質90%）
                original_filename = f"{user_id}_{timestamp}_original.webp"
                original_path = f"uploads/original/{original_filename}"
                
                # WebP形式で保存（品質90%）
                img.save(original_path, 'WEBP', quality=90, optimize=True)
                original_url = f"/{original_path}"
                
                # 低画質サムネイル（幅400px、品質40%）
                thumbnail_filename = f"{user_id}_{timestamp}_thumbnail.webp"
                thumbnail_path = f"uploads/thumbnails/{thumbnail_filename}"
                
                # 幅を400pxにリサイズ（アスペクト比を維持）
                thumbnail_img = img.copy()
                thumbnail_width = 400
                aspect_ratio = thumbnail_img.height / thumbnail_img.width
                thumbnail_height = int(thumbnail_width * aspect_ratio)
                thumbnail_img = thumbnail_img.resize((thumbnail_width, thumbnail_height), Image.Resampling.LANCZOS)
                
                # WebP形式で保存（品質40%）
                thumbnail_img.save(thumbnail_path, 'WEBP', quality=40, optimize=True)
                thumbnail_url = f"/{thumbnail_path}"
                
                return thumbnail_url, original_url

        finally:
            # 一時ファイルを削除
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    except Exception as e:
        print(f"画像処理エラー: {e}")
        return None, None


def process_profile_icon(image: UploadFile, user_id: str, size: int = 256) -> Optional[str]:
    """プロフィールアイコン用に画像を処理して保存する."""

    try:
        ensure_directories_exist()

        image.file.seek(0)
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            shutil.copyfileobj(image.file, temp_file)
            temp_file_path = temp_file.name

        try:
            with Image.open(temp_file_path) as img:
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA")
                else:
                    img = img.convert("RGBA")

                width, height = img.size
                min_side = min(width, height)
                left = (width - min_side) / 2
                top = (height - min_side) / 2
                right = left + min_side
                bottom = top + min_side
                cropped = img.crop((left, top, right, bottom))

                resized = cropped.resize((size, size), Image.Resampling.LANCZOS)

                timestamp = int(time.time())
                filename = f"{user_id}_{timestamp}_icon.webp"
                icon_path = f"uploads/profile_icons/{filename}"

                resized.save(icon_path, "WEBP", quality=90, method=6)

                return f"/{icon_path}"
        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    except Exception as exc:
        print(f"プロフィールアイコン処理エラー: {exc}")

    return None


def resize_image_if_needed(img: Image.Image, max_width: int = 1200, max_height: int = 1200) -> Image.Image:
    """
    画像が指定された最大サイズを超えている場合にリサイズ
    
    Args:
        img: PIL Imageオブジェクト
        max_width: 最大幅
        max_height: 最大高さ
        
    Returns:
        リサイズされた画像
    """
    width, height = img.size
    
    # リサイズが必要かチェック
    if width <= max_width and height <= max_height:
        return img
    
    # アスペクト比を維持してリサイズ
    aspect_ratio = width / height
    
    if width > height:
        # 横長の画像
        new_width = min(width, max_width)
        new_height = int(new_width / aspect_ratio)
    else:
        # 縦長の画像
        new_height = min(height, max_height)
        new_width = int(new_height * aspect_ratio)
    
    return img.resize((new_width, new_height), Image.Resampling.LANCZOS)


def optimize_image_for_web(img: Image.Image, quality: int = 85) -> io.BytesIO:
    """
    Web用に画像を最適化
    
    Args:
        img: PIL Imageオブジェクト
        quality: WebP品質（0-100）
        
    Returns:
        最適化された画像のバイトデータ
    """
    # RGBモードに変換
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # バッファに保存
    buffer = io.BytesIO()
    img.save(buffer, 'WEBP', quality=quality, optimize=True)
    buffer.seek(0)
    
    return buffer