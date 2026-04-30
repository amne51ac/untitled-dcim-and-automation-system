import hashlib
import secrets

import bcrypt

_BCRYPT_ROUNDS = 12


def hash_password_bcrypt(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode("utf-8")


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_raw_token() -> str:
    return secrets.token_urlsafe(32)


def new_correlation_id() -> str:
    return secrets.token_hex(16)
