import re
import math
import unicodedata
import os
import importlib
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from app.models import JST
from difflib import SequenceMatcher
from typing import List, Optional, Tuple, Set

from sqlalchemy.orm import Session

from app.models import Post, Reply

JACONV_AVAILABLE = importlib.util.find_spec("jaconv") is not None
if JACONV_AVAILABLE:
    import jaconv  # type: ignore
else:  # pragma: no cover - 環境依存
    jaconv = None  # type: ignore


# -----------------------------
# Public result object (backward compatible)
# -----------------------------
@dataclass
class SpamCheckResult:
    is_spam: bool
    reasons: List[str]
    score: float = 0.0  # 追加: スコアで重み付け評価（既存呼び出し互換）


# -----------------------------
# 設定（重み・閾値はプロダクションで調整可能）
# -----------------------------
@dataclass
class SpamDetectorConfig:
    # スコアの閾値
    threshold: float = 3.5

    # 簡易しきい値
    link_excess_threshold: int = 2
    repeated_char_threshold: int = 10  # 同一文字が10回以上

    # 速度規制（バースト投稿）
    burst_window_min: int = 5
    burst_max_posts: int = 5

    # 近似重複の探索範囲
    near_dup_limit: int = 20
    near_dup_ratio: float = 0.95

    # 繰り返し語の比率
    max_top_token_ratio: float = 0.6
    min_tokens_for_ratio: int = 8

    # 絵文字/メンション過多
    emoji_max_ratio: float = 0.2
    mention_max_count: int = 5

    # 重み（理由ごとに加算）
    weights: dict = field(default_factory=lambda: {
        "excess_links": 3.0,
        "suspicious_tld": 2.0,
        "url_shortener": 1.5,
        "keyword": 2.5,
        "badwords": 10.0,  # 不適切な単語の重みを追加
        "repeated_chars": 2.0,
        "repetition": 1.5,
        "meaningless_reply": 1.0,
        "exact_duplicate": 3.0,
        "near_duplicate": 2.0,
        "burst": 2.0,
        "base64_blob": 2.0,
        "obfuscated_url": 2.0,
        "zero_width": 2.0,
        "contact_drop": 2.0,
        "mention_bomb": 2.0,
        "emoji_bomb": 1.5,
    })


class SpamDetector:
    """多角的なヒューリスティック＋スコアリングでスパム検出を強化したユーティリティ"""

    # URL/テキスト検出系
    URL_PATTERN = re.compile(r"(?i)\b(?:https?://|www\.)[^\s]+")
    LINK_PATTERN = re.compile(r"https?://")  # 互換のために残す
    REPEATED_CHAR_PATTERN = re.compile(r"(.)\1{9,}")  # 同じ文字が10回以上連続

    # 誘導・スパム頻出語（日本語+英語）
    KEYWORD_PATTERN = re.compile(
        r"(?i)(無料|副業|高収入|即金|副収入|今だけ|完全無料|クリック|登録はこちら|儲け話|出会い|初回無料|限定オファー|LINE\s?ID|招待コード|airdrop|giveaway|earn money|passive income|work from home|crypto giveaway|casino|bet|binary options)"
    )

    # 連絡先・外部誘導（電話/メッセンジャー/招待リンク）
    CONTACT_PATTERN = re.compile(
        r"(?i)(?:tel:\\+?\d{7,}|\b\+?\d{10,}\b|line\.me/|t\.me/|telegram\.me/|wa\.me/|discord\.gg/|@\w{3,})"
    )

    # 難読化URL
    OBFUSCATED_URL_PATTERN = re.compile(r"(?i)(hxxps?|h\W*tt\W*p|\[\s*\.\s*\]|ドット|dot)\s*")

    # ゼロ幅/制御文字
    ZERO_WIDTH_PATTERN = re.compile(r"[\u200B-\u200F\u202A-\u202E\u2066-\u2069]")

    # Base64/乱数列風の長大ブロブ
    BASE64_BLOB = re.compile(r"(?:[A-Za-z0-9+/]{30,}={0,2})")

    # 短縮URL・怪しいTLD
    URL_SHORTENERS = {
        "bit.ly", "t.co", "goo.gl", "is.gd", "ow.ly", "tinyurl.com", "cutt.ly",
        "rebrand.ly", "buff.ly", "tiny.one", "lnkd.in",
    }
    SUSPICIOUS_TLDS = {
        ".xyz", ".top", ".tk", ".icu", ".click", ".work", ".cn", ".ru", ".gq", ".cf", ".pw",
    }

    EMOJI_PATTERN = re.compile(r"[\U0001F300-\U0001FAFF]")
    MENTION_PATTERN = re.compile(r"@[-_A-Za-z0-9]{2,}")

    def __init__(self, config: Optional[SpamDetectorConfig] = None):
        self.cfg = config or SpamDetectorConfig()
        # badwords.txtから不適切な単語リストを読み込む
        self.badwords = self._load_badwords()
        # badwordsの正規表現パターンをコンパイル
        self.badwords_pattern = self._compile_badwords_pattern()

    def _load_badwords(self) -> Set[str]:
        """badwords.txtから不適切な単語リストを読み込む"""
        badwords = set()
        try:
            # 現在のファイルのディレクトリを基準にbadwords.txtのパスを取得
            current_dir = os.path.dirname(os.path.abspath(__file__))
            badwords_path = os.path.join(current_dir, 'badwords.txt')
            
            with open(badwords_path, 'r', encoding='utf-8') as f:
                for line in f:
                    word = line.strip()
                    if word and not word.startswith('#'):  # 空行とコメント行を無視
                        badwords.add(word)
                        # カタカナとひらがなの相互変換を追加
                        converted = self._convert_kana(word)
                        if converted != word:
                            badwords.add(converted)
            print(f"{len(badwords)}件の不適切な単語を読み込みました")
        except FileNotFoundError:
            print("警告: badwords.txtが見つかりませんでした")
        except Exception as e:
            print(f"badwords.txtの読み込み中にエラーが発生しました: {e}")
        
        return badwords

    def _convert_kana(self, text: str) -> str:
        """カタカナとひらがなの相互変換を行う"""
        if not JACONV_AVAILABLE or jaconv is None:
            return text

        # カタカナをひらがなに変換
        hiragana = jaconv.kata2hira(text)
        # ひらがなをカタカナに変換
        katakana = jaconv.hira2kata(text)
        
        # 元のテキストと異なる場合は両方を返す
        if hiragana != text:
            return hiragana
        elif katakana != text:
            return katakana
        return text

    def _compile_badwords_pattern(self) -> re.Pattern:
        """badwordsから正規表現パターンをコンパイルする"""
        if not self.badwords:
            return re.compile(r"(?!a)a")  # 空のパターン（マッチしない）
        
        # 特殊文字をエスケープして正規表現パターンを作成
        escaped_words = [re.escape(word) for word in self.badwords]
        pattern = r'\b(?:' + '|'.join(escaped_words) + r')\b'
        
        try:
            return re.compile(pattern, re.IGNORECASE)
        except re.error:
            # パターンが大きすぎる場合は分割して処理
            return self._compile_chunked_patterns(escaped_words)

    def _compile_chunked_patterns(self, escaped_words: List[str]) -> re.Pattern:
        """大きなパターンを分割してコンパイルする"""
        chunk_size = 100  # チャンクサイズを調整
        patterns = []
        
        for i in range(0, len(escaped_words), chunk_size):
            chunk = escaped_words[i:i + chunk_size]
            chunk_pattern = r'\b(?:' + '|'.join(chunk) + r')\b'
            try:
                patterns.append(re.compile(chunk_pattern, re.IGNORECASE))
            except re.error:
                # さらに分割
                if len(chunk) > 1:
                    sub_patterns = self._compile_chunked_patterns(chunk[:len(chunk)//2])
                    patterns.extend([sub_patterns] if isinstance(sub_patterns, re.Pattern) else sub_patterns)
                    sub_patterns = self._compile_chunked_patterns(chunk[len(chunk)//2:])
                    patterns.extend([sub_patterns] if isinstance(sub_patterns, re.Pattern) else sub_patterns)
        
        # 分割されたパターンをまとめるためのラッパー
        class ChunkedPattern:
            def __init__(self, patterns):
                self.patterns = patterns
            
            def search(self, text):
                for pattern in self.patterns:
                    match = pattern.search(text)
                    if match:
                        return match
                return None
        
        return ChunkedPattern(patterns)

    # -----------------------------
    # Public API (互換)
    # -----------------------------
    def evaluate_post(self, db: Session, user_id: str, content: str) -> SpamCheckResult:
        reasons: List[str] = []
        normalized = self._normalize(content)
        if not normalized:
            return SpamCheckResult(is_spam=False, reasons=reasons, score=0.0)

        score = 0.0
        score += self._check_links(normalized, reasons)
        score += self._check_patterns(normalized, reasons)
        score += self._check_badwords(normalized, reasons)
        score += self._check_repetition(normalized, reasons)
        score += self._check_contacts(normalized, reasons)
        score += self._check_noise(normalized, reasons)
        score += self._check_social(normalized, reasons)

        # DB依存のチェック（存在すれば）
        score += self._check_exact_duplicate_post(db, user_id, normalized, reasons)
        score += self._check_near_duplicate_posts(db, user_id, normalized, reasons)
        score += self._check_burst_posts(db, user_id, reasons)

        is_spam = (score >= self.cfg.threshold) or bool(reasons and any(r for r in reasons if "重複" in r or "過剰" in r))
        return SpamCheckResult(is_spam=is_spam, reasons=reasons, score=round(score, 2))

    def evaluate_reply(self, db: Session, user_id: str, content: str, post_id: int) -> SpamCheckResult:
        reasons: List[str] = []
        normalized = self._normalize(content)
        if not normalized:
            return SpamCheckResult(is_spam=False, reasons=reasons, score=0.0)

        score = 0.0
        # 既存の短文ノイズ
        if len(normalized) < 3 and normalized.lower() in {"ok", "nice", "test"}:
            reasons.append("意味のない短い返信です")
            score += self.cfg.weights["meaningless_reply"]

        score += self._check_links(normalized, reasons)
        score += self._check_patterns(normalized, reasons)
        score += self._check_badwords(normalized, reasons)
        score += self._check_repetition(normalized, reasons)
        score += self._check_contacts(normalized, reasons)
        score += self._check_noise(normalized, reasons)
        score += self._check_social(normalized, reasons)

        # DB依存チェック
        score += self._check_exact_duplicate_reply(db, user_id, post_id, normalized, reasons)
        score += self._check_burst_posts(db, user_id, reasons)  # 返信もバーストに含める

        is_spam = (score >= self.cfg.threshold) or bool(reasons and any(r for r in reasons if "重複" in r or "過剰" in r))
        return SpamCheckResult(is_spam=is_spam, reasons=reasons, score=round(score, 2))

    # -----------------------------
    # Normalization & common utils
    # -----------------------------
    def _normalize(self, text: Optional[str]) -> str:
        if not text:
            return ""
        # 全角半角の統一 + 制御文字除去 + 空白正規化
        t = unicodedata.normalize("NFKC", text)
        t = self.ZERO_WIDTH_PATTERN.sub("", t)
        t = re.sub(r"\s+", " ", t).strip()
        return t

    # -----------------------------
    # Heuristic checks (content only)
    # -----------------------------
    def _check_links(self, text: str, reasons: List[str]) -> float:
        score = 0.0
        links = list(self.URL_PATTERN.findall(text))
        link_count = len(links)

        if link_count > self.cfg.link_excess_threshold:
            reasons.append("短文に過剰なリンクが含まれています")
            score += self.cfg.weights["excess_links"]

        # 短縮URL/TLD
        for url in links:
            host = self._extract_host(url)
            if not host:
                continue
            if any(host.endswith(tld) for tld in self.SUSPICIOUS_TLDS):
                reasons.append(f"怪しいTLDのリンクが含まれています: {host}")
                score += self.cfg.weights["suspicious_tld"]
            if any(s in host for s in self.URL_SHORTENERS):
                reasons.append(f"短縮URLが含まれています: {host}")
                score += self.cfg.weights["url_shortener"]

        # 難読化URL
        if self.OBFUSCATED_URL_PATTERN.search(text):
            reasons.append("URLを難読化した表現が含まれています")
            score += self.cfg.weights["obfuscated_url"]

        return score

    def _check_patterns(self, text: str, reasons: List[str]) -> float:
        score = 0.0
        if self.REPEATED_CHAR_PATTERN.search(text):
            reasons.append("同じ文字が異常に繰り返されています")
            score += self.cfg.weights["repeated_chars"]
        if self.KEYWORD_PATTERN.search(text):
            reasons.append("スパムと疑われる誘導表現が含まれています")
            score += self.cfg.weights["keyword"]
        if self.BASE64_BLOB.search(text):
            reasons.append("不自然な長いランダム文字列/エンコード片が含まれています")
            score += self.cfg.weights["base64_blob"]
        if self.ZERO_WIDTH_PATTERN.search(text):
            reasons.append("ゼロ幅/不可視文字による難読化が検出されました")
            score += self.cfg.weights["zero_width"]
        return score

    def _check_badwords(self, text: str, reasons: List[str]) -> float:
        """badwordsリストに含まれる不適切な単語をチェックする"""
        if not self.badwords_pattern:
            return 0.0
        
        # テキストを正規化（カタカナとひらがなの変換も考慮）
        normalized_text = self._normalize(text)
        
        texts_to_check = [normalized_text]

        # カタカナをひらがなに変換したテキストでもチェック
        if JACONV_AVAILABLE and jaconv is not None:
            hiragana_text = jaconv.kata2hira(normalized_text)
            if hiragana_text != normalized_text:
                texts_to_check.append(hiragana_text)
        
        for check_text in texts_to_check:
            if self.badwords_pattern.search(check_text):
                reasons.append("不適切な単語が含まれています")
                return self.cfg.weights.get("badwords", 2.5)  # 重み設定
        
        return 0.0

    def _check_contacts(self, text: str, reasons: List[str]) -> float:
        if self.CONTACT_PATTERN.search(text):
            reasons.append("外部連絡先やIDへの誘導が含まれています")
            return self.cfg.weights["contact_drop"]
        return 0.0

    def _check_repetition(self, text: str, reasons: List[str]) -> float:
        score = 0.0
        # 単語ベース（英数字）
        word_tokens = re.findall(r"[A-Za-z0-9_]+", text.lower())
        if word_tokens:
            freq = {}
            for w in word_tokens:
                freq[w] = freq.get(w, 0) + 1
            max_count = max(freq.values())
            ratio = max_count / max(len(word_tokens), 1)
            if ratio > self.cfg.max_top_token_ratio and len(word_tokens) > self.cfg.min_tokens_for_ratio:
                reasons.append("同じ語句が不自然に繰り返されています")
                score += self.cfg.weights["repetition"]

        # CJK向けの文字n-gram（2-gram）での繰り返し検出
        cjk = re.findall(r"[\u3040-\u30ff\u3400-\u9fff]+", text)
        if cjk:
            chars = "".join(cjk)
            ngrams = [chars[i:i+2] for i in range(len(chars)-1)] if len(chars) > 2 else []
            if ngrams:
                freq2 = {}
                for g in ngrams:
                    freq2[g] = freq2.get(g, 0) + 1
                top = max(freq2.values())
                if top / max(len(ngrams), 1) > 0.5 and len(ngrams) > 8:
                    reasons.append("CJK文字列での不自然な繰り返しパターンが検出されました")
                    score += self.cfg.weights["repetition"]
        return score

    def _check_noise(self, text: str, reasons: List[str]) -> float:
        # 大文字や記号、絵文字の密度など
        score = 0.0
        total = max(len(text), 1)
        emojis = len(self.EMOJI_PATTERN.findall(text))
        if emojis / total > self.cfg.emoji_max_ratio and emojis >= 5:
            reasons.append("絵文字が不自然に多用されています")
            score += self.cfg.weights["emoji_bomb"]
        return score

    def _check_social(self, text: str, reasons: List[str]) -> float:
        score = 0.0
        mentions = self.MENTION_PATTERN.findall(text)
        if len(mentions) > self.cfg.mention_max_count:
            reasons.append("メンションが過剰に含まれています")
            score += self.cfg.weights["mention_bomb"]
        return score

    # -----------------------------
    # DB-based checks
    # -----------------------------
    def _check_exact_duplicate_post(self, db: Session, user_id: str, content: str, reasons: List[str]) -> float:
        try:
            duplicate = (
                db.query(Post)
                .filter(Post.user_id == user_id, Post.content == content)
                .order_by(Post.id.desc())
                .first()
            )
            if duplicate:
                reasons.append("同一内容の投稿が既に存在します")
                return self.cfg.weights["exact_duplicate"]
        except Exception:
            pass
        return 0.0

    def _check_exact_duplicate_reply(self, db: Session, user_id: str, post_id: int, content: str, reasons: List[str]) -> float:
        try:
            duplicate = (
                db.query(Reply)
                .filter(Reply.user_id == user_id, Reply.post_id == post_id, Reply.content == content)
                .first()
            )
            if duplicate:
                reasons.append("同一内容の返信が既に存在します")
                return self.cfg.weights["exact_duplicate"]
        except Exception:
            pass
        return 0.0

    def _check_near_duplicate_posts(self, db: Session, user_id: str, content: str, reasons: List[str]) -> float:
        try:
            recent = (
                db.query(Post)
                .filter(Post.user_id == user_id)
                .order_by(Post.id.desc())
                .limit(self.cfg.near_dup_limit)
                .all()
            )
            for p in recent:
                other = (p.content or "").strip()
                if not other:
                    continue
                if len(content) < 30 and len(other) < 30:
                    # 短文は厳しめに近似重複判定を避ける
                    continue
                ratio = SequenceMatcher(None, content, other).ratio()
                if ratio >= self.cfg.near_dup_ratio:
                    reasons.append("直近の投稿と内容がほぼ同一です")
                    return self.cfg.weights["near_duplicate"]
        except Exception:
            pass
        return 0.0

    def _check_burst_posts(self, db: Session, user_id: str, reasons: List[str]) -> float:
        try:
            # created_at は JST（tz-aware）で保存されている前提
            window_start = datetime.now(JST) - timedelta(minutes=self.cfg.burst_window_min)
            count_posts = db.query(Post).filter(Post.user_id == user_id, Post.created_at >= window_start).count()
            count_replies = db.query(Reply).filter(Reply.user_id == user_id, Reply.created_at >= window_start).count()
            total = count_posts + count_replies
            if total > self.cfg.burst_max_posts:
                reasons.append("短時間に大量の投稿/返信が行われています")
                return self.cfg.weights["burst"]
        except Exception:
            pass
        return 0.0

    # -----------------------------
    # helpers
    # -----------------------------
    @staticmethod
    def _extract_host(url: str) -> Optional[str]:
        # 粗い抽出で十分（正規のURLパーサ不要）
        m = re.search(r"(?i)^(?:https?://|www\.)?([^/]+)", url.strip())
        return m.group(1).lower() if m else None


# 既存の名前でエクスポート（差し替え容易）
spam_detector = SpamDetector()
