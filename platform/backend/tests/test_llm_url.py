from nims.services.llm_url import (
    chat_completions_url,
    is_azure_openai_host,
    llm_request_headers,
    openai_api_base_for_chat,
)


def test_host_only_gets_v1() -> None:
    assert openai_api_base_for_chat("https://api.openai.com") == "https://api.openai.com/v1"
    assert chat_completions_url("https://api.openai.com") == "https://api.openai.com/v1/chat/completions"


def test_azure_host_does_not_get_v1() -> None:
    assert openai_api_base_for_chat("https://r.openai.azure.com") == "https://r.openai.azure.com"


def test_explicit_v1_unchanged() -> None:
    assert chat_completions_url("https://api.openai.com/v1") == "https://api.openai.com/v1/chat/completions"


def test_custom_path_unchanged() -> None:
    assert chat_completions_url("https://proxy.example/llm/v1") == "https://proxy.example/llm/v1/chat/completions"


def test_azure_host_only_uses_deployment() -> None:
    u = chat_completions_url("https://intentcenter-resource.openai.azure.com", deployment="intentcenter")
    assert "openai.azure.com" in u
    assert "openai/deployments/intentcenter/chat/completions" in u
    assert "api-version" in u


def test_azure_cognitive_services_host() -> None:
    u = chat_completions_url("https://myres.cognitiveservices.azure.com", deployment="my")
    assert "/openai/deployments/my/chat/completions" in u
    h = llm_request_headers("https://myres.cognitiveservices.azure.com", "key")
    assert h.get("api-key") == "key"
    assert "Authorization" not in h


def test_azure_is_detected() -> None:
    assert is_azure_openai_host("https://foo.openai.azure.com")
    assert is_azure_openai_host("https://bar.cognitiveservices.azure.com")
    assert not is_azure_openai_host("https://api.openai.com/v1")


def test_openai_uses_bearer() -> None:
    h = llm_request_headers("https://api.openai.com/v1", "sk")
    assert h.get("Authorization") == "Bearer sk"
    assert "api-key" not in h
