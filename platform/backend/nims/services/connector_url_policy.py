"""SSRF-hardening for connector outbound HTTP: scheme, IP resolution, optional host allowlist."""

from __future__ import annotations

import ipaddress
import re
import socket
from typing import Any
from urllib.parse import urlparse

from nims.config import Settings, get_settings

_INVALID_HOST = re.compile(r"[\r\n\0]")


def _parse_schemes(s: str) -> set[str]:
    return {x.strip().lower() for x in s.split(",") if x.strip()}


def _host_suffixes(settings: Settings) -> list[str] | None:
    raw = settings.connector_url_allowed_host_suffixes
    if not raw or not str(raw).strip():
        return None
    return [x.strip().lower() for x in str(raw).split(",") if x.strip()]


def _host_allowed_by_suffix(hostname: str, suffixes: list[str]) -> bool:
    h = hostname.lower().rstrip(".")
    for suf in suffixes:
        if h == suf or h.endswith("." + suf) or (suf.startswith(".") and h.endswith(suf)):
            return True
    return False


def _is_forbidden_address(ip: str) -> bool:
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return True
    if a.is_loopback or a.is_link_local or a.is_multicast or a.is_reserved:
        return True
    if a.is_private:
        return True
    if a.version == 4:
        # AWS/GCP style metadata
        if a in ipaddress.ip_network("169.254.169.254/32"):
            return True
    if a.version == 6 and a.ipv4_mapped is not None:
        return _is_forbidden_address(str(a.ipv4_mapped))
    return False


def assert_connector_url_allowed(url: str, settings: Settings | None = None) -> None:
    """
    Resolve hostname and block common SSRF targets. Call before httpx.
    Optional host suffix list tightens which names are allowed (in addition to public IP checks).
    """
    s = settings or get_settings()
    if not url or not isinstance(url, str):
        raise ValueError("url is required")
    if _INVALID_HOST.search(url):
        raise ValueError("invalid characters in url")
    parsed = urlparse(url)
    allowed = _parse_schemes(s.connector_url_http_allowed_schemes)
    if (parsed.scheme or "").lower() not in allowed:
        raise ValueError(f"url scheme not allowed (allowed: {sorted(allowed)})")
    if not parsed.netloc:
        raise ValueError("url has no host")
    host = parsed.hostname
    if not host:
        raise ValueError("url has no host")
    host = str(host)
    if _INVALID_HOST.search(host):
        raise ValueError("invalid host")

    suffixes = _host_suffixes(s)
    if host.startswith("[") and "]" in host:
        # Bracketed IPv6 literal
        inside = host[1 : host.index("]")]
        if s.connector_url_block_private_networks and _is_forbidden_address(inside):
            raise ValueError("url resolves to a forbidden address")
        return

    try:
        if ipaddress.ip_address(host):
            if s.connector_url_block_private_networks and _is_forbidden_address(host):
                raise ValueError("url uses a forbidden address")
            return
    except ValueError:
        pass  # not a bare IP, continue with DNS

    if suffixes and not _host_allowed_by_suffix(host, suffixes):
        raise ValueError("hostname is not in the allowed host suffix list")

    try:
        addrinfos: Any = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP)
    except OSError as e:  # noqa: SLF001
        raise ValueError(f"host resolution failed: {e!s}") from e
    if not s.connector_url_block_private_networks:
        return
    for _fam, _type, _proto, _canon, sockaddr in addrinfos:
        target = sockaddr[0]
        if not isinstance(target, str):
            continue
        if _is_forbidden_address(target):
            raise ValueError("url hostname resolves to a private or forbidden address")
