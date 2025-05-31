import pytest
import asyncio
from unittest.mock import Mock, patch
import redis
from fastapi.testclient import TestClient
from pipelines.langchain_pipeline import LangChainPipeline
from pipelines.rerank_pipeline import RerankPipeline
from handlers.multimodal_handler import MultiModalHandler
from handlers.prompt_handler import PromptHandler
from handlers.intent_router import IntentRouter
import json
import os
from PIL import Image
import io
import numpy as np

# Test data
TEST_QUERY = "What's the status of flight AA123?"
TEST_VOICE_DATA = b"dummy_voice_data"
TEST_IMAGE_DATA = np.zeros((100, 100, 3), dtype=np.uint8)

@pytest.fixture
def redis_client():
    return redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=0
    )

@pytest.fixture
def langchain_pipeline(redis_client):
    return LangChainPipeline(redis_client)

@pytest.fixture
def rerank_pipeline(redis_client):
    return RerankPipeline(redis_client)

@pytest.fixture
def multimodal_handler(redis_client):
    return MultiModalHandler(redis_client)

@pytest.fixture
def prompt_handler(redis_client):
    return PromptHandler(redis_client)

@pytest.fixture
def intent_router(redis_client):
    return IntentRouter(redis_client)

@pytest.mark.asyncio
async def test_langchain_pipeline_end_to_end(langchain_pipeline):
    """Test complete LangChain pipeline flow."""
    # Test data
    payload = {
        "input_text": TEST_QUERY,
        "session_id": "test_session"
    }
    
    # Process query
    result = await langchain_pipeline.process(payload)
    
    # Assertions
    assert result is not None
    assert "response" in result
    assert "source_documents" in result
    assert isinstance(result["response"], str)
    assert isinstance(result["source_documents"], list)

@pytest.mark.asyncio
async def test_rerank_pipeline_end_to_end(rerank_pipeline):
    """Test complete reranking pipeline flow."""
    # Test data
    candidates = [
        "Flight AA123 is on time.",
        "Flight AA123 is delayed by 30 minutes.",
        "Flight AA123 has been cancelled."
    ]
    
    # Process reranking
    result = await rerank_pipeline.rerank(
        query=TEST_QUERY,
        candidates=candidates,
        context={"history": ["Previous query about flight status"]}
    )
    
    # Assertions
    assert result is not None
    assert "reranked_responses" in result
    assert len(result["reranked_responses"]) > 0
    assert all(
        "text" in r and "score" in r and "scores" in r
        for r in result["reranked_responses"]
    )

@pytest.mark.asyncio
async def test_multimodal_handler_text(multimodal_handler):
    """Test multimodal handler with text input."""
    result = await multimodal_handler.process_query(
        text=TEST_QUERY,
        session_id="test_session"
    )
    
    # Assertions
    assert result is not None
    assert "result" in result
    assert "confidence" in result
    assert "modality_used" in result
    assert result["modality_used"] == "text"

@pytest.mark.asyncio
async def test_multimodal_handler_voice(multimodal_handler):
    """Test multimodal handler with voice input."""
    # Create test voice file
    voice_file = Mock()
    voice_file.read = asyncio.coroutine(lambda: TEST_VOICE_DATA)
    
    result = await multimodal_handler.process_query(
        voice_file=voice_file,
        session_id="test_session"
    )
    
    # Assertions
    assert result is not None
    assert "result" in result
    assert "confidence" in result
    assert "modality_used" in result
    assert result["modality_used"] in ["voice", "text_from_voice"]

@pytest.mark.asyncio
async def test_multimodal_handler_image(multimodal_handler):
    """Test multimodal handler with image input."""
    # Create test image file
    image = Image.fromarray(TEST_IMAGE_DATA.astype('uint8'))
    image_byte_array = io.BytesIO()
    image.save(image_byte_array, format='PNG')
    image_file = Mock()
    image_file.read = asyncio.coroutine(
        lambda: image_byte_array.getvalue()
    )
    
    result = await multimodal_handler.process_query(
        image_file=image_file,
        session_id="test_session"
    )
    
    # Assertions
    assert result is not None
    assert "result" in result
    assert "confidence" in result
    assert "modality_used" in result
    assert result["modality_used"] in ["image", "qr_code"]

@pytest.mark.asyncio
async def test_prompt_handler(prompt_handler):
    """Test prompt handler template rendering and validation."""
    variables = {
        "flight_number": "AA123",
        "departure_time": "10:00 AM"
    }
    
    result = await prompt_handler.render_prompt(
        template_name="flight-status",
        variables=variables,
        priority="default"
    )
    
    # Assertions
    assert result is not None
    assert "prompt" in result
    assert "template" in result
    assert "domain" in result
    assert "bias_detected" in result

@pytest.mark.asyncio
async def test_intent_router(intent_router):
    """Test intent classification and routing."""
    result = await intent_router.route_intent(
        query=TEST_QUERY,
        context={"user_id": "test_user"}
    )
    
    # Assertions
    assert result is not None
    assert not isinstance(result, dict) or "error" not in result
    
    # Test intent classification
    intent_scores = await intent_router.classify_intent(TEST_QUERY)
    assert isinstance(intent_scores, dict)
    assert "flight-status" in intent_scores
    assert intent_scores["flight-status"] > 0.7

@pytest.mark.asyncio
async def test_error_handling(langchain_pipeline, rerank_pipeline, multimodal_handler):
    """Test error handling across pipelines."""
    # Test invalid input
    with pytest.raises(ValueError):
        await langchain_pipeline.process({"input_text": ""})
    
    with pytest.raises(ValueError):
        await rerank_pipeline.rerank("", [])
    
    with pytest.raises(ValueError):
        await multimodal_handler.process_query()

@pytest.mark.asyncio
async def test_redis_integration(redis_client, multimodal_handler):
    """Test Redis integration for context storage."""
    # Clear test data
    redis_client.delete("session:test_session:context")
    
    # Process query
    result = await multimodal_handler.process_query(
        text=TEST_QUERY,
        session_id="test_session"
    )
    
    # Check context storage
    context_data = redis_client.lrange("session:test_session:context", 0, -1)
    assert len(context_data) > 0
    
    # Verify context data
    latest_context = json.loads(context_data[-1])
    assert "modality" in latest_context
    assert "result" in latest_context
    assert "confidence" in latest_context
    assert "timestamp" in latest_context

@pytest.mark.asyncio
async def test_concurrent_requests(langchain_pipeline):
    """Test handling of concurrent requests."""
    # Create multiple concurrent requests
    async def make_request():
        return await langchain_pipeline.process({
            "input_text": TEST_QUERY,
            "session_id": f"test_session_{id}"
        })
    
    # Run concurrent requests
    tasks = [make_request() for _ in range(5)]
    results = await asyncio.gather(*tasks)
    
    # Verify all requests completed successfully
    assert len(results) == 5
    assert all(isinstance(r, dict) for r in results)
    assert all("response" in r for r in results) 
