from typing import Any, Dict
from fastapi import UploadFile

ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024  # 50MB 上限

def validate_video_file(video: UploadFile) -> Dict[str, Any]:
    """動画ファイルの簡易バリデーションを行う"""
    if video.content_type not in ALLOWED_VIDEO_TYPES:
        return {"is_valid": False, "error": "サポートされていない動画形式です"}

    try:
        current_position = video.file.tell()
    except Exception:
        current_position = None

    try:
        video.file.seek(0, 2)
        size = video.file.tell()
    except Exception:
        size = 0
    finally:
        try:
            if current_position is not None:
                video.file.seek(current_position)
            else:
                video.file.seek(0)
        except Exception:
            pass

    if size > MAX_VIDEO_SIZE_BYTES:
        return {"is_valid": False, "error": "動画サイズは50MB以内にしてください"}

    return {"is_valid": True}
