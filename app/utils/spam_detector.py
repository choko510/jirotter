import re
from dataclasses import dataclass
from typing import List

from sqlalchemy.orm import Session

from app.models import Post, Reply


@dataclass
class SpamCheckResult:
    is_spam: bool
    reasons: List[str]


class SpamDetector:
    """投稿・返信のスパム検出を行うシンプルなユーティリティ"""

    LINK_PATTERN = re.compile(r"https?://")
    REPEATED_CHAR_PATTERN = re.compile(r"(.)\1{9,}")  # 同じ文字が10回以上連続
    KEYWORD_PATTERN = re.compile(
        r"(?i)(無料|副業|稼げる|今だけ|完全無料|クリック|登録はこちら|儲け話|earn money|crypto giveaway)"
    )

    def evaluate_post(self, db: Session, user_id: str, content: str) -> SpamCheckResult:
        reasons: List[str] = []
        normalized = (content or "").strip()

        if not normalized:
            return SpamCheckResult(is_spam=False, reasons=reasons)

        link_count = len(self.LINK_PATTERN.findall(normalized))
        if link_count > 2:
            reasons.append("短文に過剰なリンクが含まれています")

        if self.REPEATED_CHAR_PATTERN.search(normalized):
            reasons.append("同じ文字が異常に繰り返されています")

        if self.KEYWORD_PATTERN.search(normalized):
            reasons.append("スパムと疑われる誘導表現が含まれています")

        word_tokens = re.findall(r"\w+", normalized.lower())
        if word_tokens:
            most_common_ratio = self._calculate_max_frequency_ratio(word_tokens)
            if most_common_ratio > 0.6 and len(word_tokens) > 8:
                reasons.append("同じ語句が不自然に繰り返されています")

        duplicate_post = (
            db.query(Post)
            .filter(Post.user_id == user_id, Post.content == normalized)
            .order_by(Post.id.desc())
            .first()
        )
        if duplicate_post:
            reasons.append("同一内容の投稿が既に存在します")

        return SpamCheckResult(is_spam=bool(reasons), reasons=reasons)

    def evaluate_reply(self, db: Session, user_id: str, content: str, post_id: int) -> SpamCheckResult:
        reasons: List[str] = []
        normalized = (content or "").strip()

        if not normalized:
            return SpamCheckResult(is_spam=False, reasons=reasons)

        if len(normalized) < 3 and normalized.lower() in {"ok", "nice", "test"}:
            reasons.append("意味のない短い返信です")

        if self.REPEATED_CHAR_PATTERN.search(normalized):
            reasons.append("同じ文字が異常に繰り返されています")

        if self.KEYWORD_PATTERN.search(normalized):
            reasons.append("スパムと疑われる誘導表現が含まれています")

        reply_duplicate = (
            db.query(Reply)
            .filter(Reply.user_id == user_id, Reply.post_id == post_id, Reply.content == normalized)
            .first()
        )
        if reply_duplicate:
            reasons.append("同一内容の返信が既に存在します")

        return SpamCheckResult(is_spam=bool(reasons), reasons=reasons)

    @staticmethod
    def _calculate_max_frequency_ratio(tokens: List[str]) -> float:
        frequency = {}
        for token in tokens:
            frequency[token] = frequency.get(token, 0) + 1
        max_count = max(frequency.values(), default=0)
        return max_count / len(tokens) if tokens else 0.0


spam_detector = SpamDetector()
