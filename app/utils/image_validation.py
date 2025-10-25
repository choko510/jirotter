"""画像バリデーションユーティリティ."""

import io
import os
import tempfile
import imghdr
from typing import Dict, Any

from fastapi import UploadFile
from PIL import Image
from PIL.ExifTags import TAGS


def validate_image_file(image: UploadFile) -> Dict[str, Any]:
    """アップロードされた画像ファイルの安全性を検証する."""

    allowed_mime_types = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
    ]

    max_size_in_bytes = 5 * 1024 * 1024

    if not image.filename:
        return {"is_valid": False, "error": "ファイル名がありません"}

    allowed_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    file_extension = os.path.splitext(image.filename)[1].lower()

    if file_extension not in allowed_extensions:
        return {
            "is_valid": False,
            "error": "対応している画像形式はJPEG、PNG、GIF、WebPのみです",
        }

    dangerous_extensions = [
        ".php",
        ".js",
        ".exe",
        ".bat",
        ".cmd",
        ".sh",
        ".py",
        ".pl",
        ".rb",
    ]
    for ext in dangerous_extensions:
        if image.filename.lower().endswith(ext):
            return {"is_valid": False, "error": "このファイル形式は許可されていません"}

    if hasattr(image, "size") and image.size and image.size > max_size_in_bytes:
        return {"is_valid": False, "error": "画像サイズは5MB以下にしてください"}

    try:
        file_position = image.file.tell()
        image.file.seek(0)
        file_header = image.file.read(1024)
        image.file.seek(file_position)

        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(file_header)
            temp_file_path = temp_file.name

        try:
            image_type = imghdr.what(temp_file_path)

            if image_type:
                detected_mime = f"image/{image_type}"
                if image_type == "jpg":
                    detected_mime = "image/jpeg"

                if detected_mime not in allowed_mime_types:
                    return {
                        "is_valid": False,
                        "error": f"ファイルの内容が対応している画像形式ではありません: {detected_mime}",
                    }
        finally:
            os.unlink(temp_file_path)
    except Exception as exc:  # pragma: no cover - ログ用
        print(f"画像形式検出エラー: {exc}")

    try:
        file_position = image.file.tell()
        image.file.seek(0)
        file_content = image.file.read()
        image.file.seek(file_position)

        validation_result = validate_image_content(file_content)
        if not validation_result["is_valid"]:
            return validation_result
    except Exception as exc:  # pragma: no cover - ログ用
        print(f"詳細画像検証エラー: {exc}")
        return {
            "is_valid": False,
            "error": "画像の検証に失敗しました。もう一度お試しください。",
        }

    return {"is_valid": True, "error": None}


def validate_image_content(file_content: bytes) -> Dict[str, Any]:
    """画像のメタ情報や品質を検証する."""

    try:
        with Image.open(io.BytesIO(file_content)) as img:
            resolution_validation = validate_image_resolution(img)
            if not resolution_validation["is_valid"]:
                return resolution_validation

            aspect_ratio_validation = validate_image_aspect_ratio(img)
            if not aspect_ratio_validation["is_valid"]:
                return aspect_ratio_validation

            exif_validation = validate_image_exif(img)
            if not exif_validation["is_valid"]:
                return exif_validation

            quality_validation = validate_image_quality(img)
            if not quality_validation["is_valid"]:
                return quality_validation

            spoofing_validation = validate_image_spoofing(img)
            if not spoofing_validation["is_valid"]:
                return spoofing_validation
    except Exception as exc:
        print(f"画像内容検証エラー: {exc}")
        return {
            "is_valid": False,
            "error": "画像ファイルが破損しているか、サポートされていない形式です",
        }

    return {"is_valid": True, "error": None}


def validate_image_resolution(img: Image.Image) -> Dict[str, Any]:
    min_width = 100
    min_height = 100
    max_width = 4096
    max_height = 4096

    width, height = img.size

    if width < min_width or height < min_height:
        return {
            "is_valid": False,
            "error": f"画像サイズが小さすぎます。最小サイズは{min_width}x{min_height}pxです",
        }

    if width > max_width or height > max_height:
        return {
            "is_valid": False,
            "error": f"画像サイズが大きすぎます。最大サイズは{max_width}x{max_height}pxです",
        }

    return {"is_valid": True, "error": None}


def validate_image_aspect_ratio(img: Image.Image) -> Dict[str, Any]:
    width, height = img.size
    aspect_ratio = width / height

    if aspect_ratio < 0.1 or aspect_ratio > 10:
        return {
            "is_valid": False,
            "error": "画像のアスペクト比が不正です",
        }

    return {"is_valid": True, "error": None}


def validate_image_exif(img: Image.Image) -> Dict[str, Any]:
    try:
        exif_data = img.getexif()
        if exif_data:
            gps_info = {}
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag == "GPSInfo":
                    gps_info = value
                    break

            if gps_info:
                return {
                    "is_valid": False,
                    "error": "位置情報(GPS)が含まれている画像はアップロードできません",
                }
    except Exception as exc:
        print(f"EXIF検証エラー: {exc}")

    return {"is_valid": True, "error": None}


def validate_image_quality(img: Image.Image) -> Dict[str, Any]:
    try:
        if hasattr(img, "info"):
            quality = img.info.get("quality")
            if quality and isinstance(quality, int) and quality < 30:
                return {
                    "is_valid": False,
                    "error": "画質が低すぎるため、アップロードできません",
                }
    except Exception as exc:
        print(f"画像品質検証エラー: {exc}")

    return {"is_valid": True, "error": None}


def validate_image_spoofing(img: Image.Image) -> Dict[str, Any]:
    try:
        if hasattr(img, "info") and img.info:
            for key, value in img.info.items():
                if isinstance(key, str) and isinstance(value, str):
                    dangerous_patterns = [
                        "<script",
                        "javascript:",
                        "vbscript:",
                        "data:text/html",
                        "data:application",
                        "data:image/svg+xml",
                    ]

                    for pattern in dangerous_patterns:
                        if pattern in value.lower():
                            return {
                                "is_valid": False,
                                "error": "危険なメタデータが含まれています",
                            }

        width, height = img.size
        pixel_count = width * height

        if pixel_count < 100:
            return {"is_valid": False, "error": "画像が小さすぎます"}

        if pixel_count > 100 * 1024 * 1024:
            return {"is_valid": False, "error": "画像が大きすぎます"}
    except Exception as exc:
        print(f"偽装画像検証エラー: {exc}")

    return {"is_valid": True, "error": None}
