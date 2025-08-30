from __future__ import annotations
import base64
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from ..config import settings


def _get_fernet() -> Optional[Fernet]:
    key = settings.hf_token_enc_key
    if not key:
        return None
    # Allow either raw 32-byte base64 key or plain string; if plain, base64-encode
    try:
        # If this succeeds, key is valid fernet key
        return Fernet(key)
    except Exception:
        try:
            k = base64.urlsafe_b64encode(key.encode("utf-8"))
            return Fernet(k)
        except Exception:
            return None


def encrypt_token(token: str) -> bytes:
    f = _get_fernet()
    if not f:
        raise RuntimeError("HF_TOKEN_ENC_KEY not configured for encryption")
    return f.encrypt(token.encode("utf-8"))


def decrypt_token(token_enc: bytes) -> str:
    f = _get_fernet()
    if not f:
        raise RuntimeError("HF_TOKEN_ENC_KEY not configured for decryption")
    try:
        return f.decrypt(token_enc).decode("utf-8")
    except InvalidToken as e:
        raise RuntimeError("Invalid encrypted token") from e
