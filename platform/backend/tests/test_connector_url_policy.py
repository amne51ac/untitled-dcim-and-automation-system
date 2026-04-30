import pytest

from nims.config import Settings, get_settings
from nims.services.connector_url_policy import assert_connector_url_allowed


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_blocks_loopback() -> None:
    s = Settings(
        database_url="postgresql+psycopg://x:x@localhost:1/x",
        connector_url_block_private_networks=True,
    )
    with pytest.raises(ValueError, match="forbidden"):
        assert_connector_url_allowed("https://127.0.0.1/foo", s)


def test_allows_public_ip_literal() -> None:
    s = Settings(
        database_url="postgresql+psycopg://x:x@localhost:1/x",
        connector_url_block_private_networks=True,
    )
    assert_connector_url_allowed("https://1.1.1.1/cdn-cgi/trace", s)


def test_host_suffix_enforced() -> None:
    s = Settings(
        database_url="postgresql+psycopg://x:x@localhost:1/x",
        connector_url_block_private_networks=True,
        connector_url_allowed_host_suffixes="other.example",
    )
    with pytest.raises(ValueError, match="suffix"):
        assert_connector_url_allowed("https://example.com/", s)
