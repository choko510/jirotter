import pytest
from unittest.mock import patch, AsyncMock

@pytest.mark.asyncio
async def test_ask_guide_success(test_client):
    with patch("app.routes.guide.ask_ai_guide", new_callable=AsyncMock) as mock_ask:
        mock_ask.return_value = "これはテスト回答です。"
        
        response = test_client.post("/api/v1/guide/ask", json={"question": "テスト質問"})
        
        assert response.status_code == 200, f"Status: {response.status_code}, Body: {response.text}"
        assert response.json() == {"answer": "これはテスト回答です。"}
        mock_ask.assert_called_once_with("テスト質問")

@pytest.mark.asyncio
async def test_ask_guide_empty_question(test_client):
    response = test_client.post("/api/v1/guide/ask", json={"question": "   "})
    assert response.status_code == 400
