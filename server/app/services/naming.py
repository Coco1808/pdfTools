from __future__ import annotations

import asyncio
import html
import json
import re
import urllib.parse
import urllib.request

MAX_TEXT_LEN = 80
SKIP_WORDS = {"a", "an", "the"}
HAS_CJK = re.compile(r"[\u4e00-\u9fff]")
CAMEL_BREAK = re.compile(r"([a-z0-9])([A-Z])")
ACRONYM_BREAK = re.compile(r"([A-Z]+)([A-Z][a-z])")
NON_WORD = re.compile(r"[^A-Za-z0-9]+")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; pdf-tools/1.0)",
    "Accept": "application/json",
}


class NamingError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def to_words(english: str) -> list[str]:
    text = (english or "").strip()
    if not text:
        return []
    text = CAMEL_BREAK.sub(r"\1 \2", text)
    text = ACRONYM_BREAK.sub(r"\1 \2", text)
    text = NON_WORD.sub(" ", text)
    words = [w.lower() for w in text.split() if w]
    return [w for w in words if w not in SKIP_WORDS]


def _get_json(url: str, timeout: float = 10) -> object:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _from_youdao(text: str) -> str | None:
    url = "https://dict.youdao.com/jsonapi?" + urllib.parse.urlencode({"q": text})
    data = _get_json(url)
    if not isinstance(data, dict):
        return None
    web = data.get("web_trans") or {}
    items = web.get("web-translation") or []
    if isinstance(items, list) and items and isinstance(items[0], dict):
        trans = items[0].get("trans") or []
        if isinstance(trans, list) and trans and isinstance(trans[0], dict):
            value = str(trans[0].get("value") or "").strip()
            if value:
                return value
    return None


def _from_google(text: str) -> str | None:
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": "zh-CN", "tl": "en", "dt": "t", "q": text}
    )
    data = _get_json(url)
    if not isinstance(data, list) or not data or not isinstance(data[0], list):
        return None
    parts: list[str] = []
    for item in data[0]:
        if isinstance(item, list) and item and isinstance(item[0], str):
            parts.append(item[0])
    result = "".join(parts).strip()
    return result or None


def _from_mymemory(text: str) -> str | None:
    url = "https://api.mymemory.translated.net/get?" + urllib.parse.urlencode(
        {"q": text, "langpair": "zh|en"}
    )
    data = _get_json(url)
    if not isinstance(data, dict):
        return None
    payload = data.get("responseData") or {}
    if not isinstance(payload, dict):
        return None
    result = str(payload.get("translatedText") or "").strip()
    if not result or "MYMEMORY WARNING" in result.upper():
        return None
    return result


def _translate_sync(text: str) -> str:
    for fn in (_from_mymemory, _from_youdao, _from_google):
        try:
            result = fn(text)
        except Exception:
            continue
        if result and not HAS_CJK.search(result):
            return html.unescape(result).strip()
    raise NamingError("中文翻译失败，请稍后重试")


async def translate_to_english(text: str) -> dict:
    source = (text or "").strip()
    if not source:
        raise NamingError("请输入要命名的中文含义")
    if len(source) > MAX_TEXT_LEN:
        raise NamingError(f"内容过长，最多 {MAX_TEXT_LEN} 个字符")

    if HAS_CJK.search(source):
        english = await asyncio.to_thread(_translate_sync, source)
    else:
        english = source

    words = to_words(english)
    if not words:
        raise NamingError("没有得到可用的英文单词，请换个说法试试")

    return {
        "source": source,
        "english": english,
        "words": words,
    }
