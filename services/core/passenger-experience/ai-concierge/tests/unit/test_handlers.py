import pytest
from unittest.mock import Mock, patch, AsyncMock
import redis
from handlers.multimodal_handler import MultiModalHandler
from handlers.prompt_handler import PromptHandler
from handlers.intent_router import IntentRouter
import json
import numpy as np
from PIL import Image
import io
from datetime import datetime

# Test data
TEST_QUERY = "What's the status of flight AA123?"
TEST_VOICE_DATA = b"dummy_voice_data"
TEST_IMAGE_DATA = np.zeros((100, 100, 3), dtype=np.uint8)

@pytest.fixture
def mock_redis():
    return Mock(spec=redis.Redis)

@pytest.fixture
def multimodal_handler(mock_redis):
    handler = MultiModalHandler(mock_redis)
    # Mock model initialization
    handler.clip_model = Mock()
    handler.clip_processor = Mock()
    handler.speech_recognizer = Mock()
    handler.sentiment_model = Mock()
    handler.sentiment_tokenizer = Mock()
    return handler

@pytest.fixture
def prompt_handler(mock_redis):
    handler = PromptHandler(mock_redis)
    # Mock template loading
    handler.templates = {
        "flight-status": Mock(
            name="flight-status",
            template="Flight status for {flight_number}",
            required_fields=["flight_number"],
            constraints={},
            domain="flight-status",
            max_tokens=100,
            temperature=0.7
        )
    }
    return handler

@pytest.fixture
def intent_router(mock_redis):
    router = IntentRouter(mock_redis)
    # Mock circuit breakers
    router.circuit_breakers = {
        "flight-status": Mock(can_execute=Mock(return_value=True))
    }
    return router

@pytest.mark.asyncio
async def test_multimodal_handler_text_processing(multimodal_handler):
    """Test text processing in multimodal handler."""
    # Mock sentiment analysis
    multimodal_handler.sentiment_model.return_value = Mock(
        logits=Mock(shape=[1, 5])
    )
    
    result = await multimodal_handler._process_text(TEST_QUERY)
    
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert isinstance(result[0], str)
    assert isinstance(result[1], float)
    assert 0 <= result[1] <= 1

@pytest.mark.asyncio
async def test_multimodal_handler_voice_processing(multimodal_handler):
    """Test voice processing in multimodal handler."""
    # Mock speech recognition
    multimodal_handler.speech_recognizer.recognize_google.return_value = {
        'transcript': 'Test transcript',
        'confidence': 0.9
    }
    
    voice_file = Mock()
    voice_file.read = AsyncMock(return_value=TEST_VOICE_DATA)
    
    result = await multimodal_handler._process_voice(voice_file)
    
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert isinstance(result[0], str)
    assert isinstance(result[1], float)
    assert 0 <= result[1] <= 1

@pytest.mark.asyncio
async def test_multimodal_handler_image_processing(multimodal_handler):
    """Test image processing in multimodal handler."""
    # Mock CLIP model
    multimodal_handler.clip_model.get_image_features.return_value = Mock(
        tolist=Mock(return_value=[[0.1, 0.2, 0.3]])
    )
    
    # Create test image
    image = Image.fromarray(TEST_IMAGE_DATA.astype('uint8'))
    image_byte_array = io.BytesIO()
    image.save(image_byte_array, format='PNG')
    image_file = Mock()
    image_file.read = AsyncMock(return_value=image_byte_array.getvalue())
    
    result = await multimodal_handler._process_image(image_file)
    
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert isinstance(result[0], dict)
    assert isinstance(result[1], float)
    assert 0 <= result[1] <= 1

@pytest.mark.asyncio
async def test_multimodal_handler_qr_processing(multimodal_handler):
    """Test QR code processing in multimodal handler."""
    # Mock QR detector
    multimodal_handler.qr_detector.detectAndDecode.return_value = (
        "Test QR data",
        np.array([[0, 0], [1, 1]]),
        None
    )
    
    # Create test image
    image = Image.fromarray(TEST_IMAGE_DATA.astype('uint8'))
    image_byte_array = io.BytesIO()
    image.save(image_byte_array, format='PNG')
    image_file = Mock()
    image_file.read = AsyncMock(return_value=image_byte_array.getvalue())
    
    result = await multimodal_handler._process_qr_code(image_file)
    
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert isinstance(result[0], str)
    assert isinstance(result[1], float)
    assert result[1] == 1.0  # High confidence for QR detection

@pytest.mark.asyncio
async def test_prompt_handler_template_rendering(prompt_handler):
    """Test prompt template rendering."""
    variables = {
        "flight_number": "AA123"
    }
    
    result = await prompt_handler.render_prompt(
        template_name="flight-status",
        variables=variables,
        priority="default"
    )
    
    assert result is not None
    assert "prompt" in result
    assert result["prompt"] == "Flight status for AA123"
    assert result["template"] == "flight-status"
    assert result["domain"] == "flight-status"
    assert not result["bias_detected"]

@pytest.mark.asyncio
async def test_prompt_handler_missing_variables(prompt_handler):
    """Test prompt rendering with missing variables."""
    with pytest.raises(ValueError) as exc_info:
        await prompt_handler.render_prompt(
            template_name="flight-status",
            variables={},
            priority="default"
        )
    
    assert "Missing required fields" in str(exc_info.value)

@pytest.mark.asyncio
async def test_prompt_handler_bias_detection(prompt_handler):
    """Test bias detection in prompts."""
    result = await prompt_handler._check_bias(
        "The male passenger's flight is delayed."
    )
    
    assert isinstance(result, dict)
    assert "gender_bias" in result
    assert "male" in result["gender_bias"]

@pytest.mark.asyncio
async def test_intent_router_classification(intent_router):
    """Test intent classification."""
    result = await intent_router.classify_intent(TEST_QUERY)
    
    assert isinstance(result, dict)
    assert "flight-status" in result
    assert result["flight-status"] > 0.7
    assert all(0 <= score <= 1 for score in result.values())

@pytest.mark.asyncio
async def test_intent_router_service_call(intent_router):
    """Test service call with circuit breaker."""
    # Mock HTTP client
    intent_router.http_client = AsyncMock()
    intent_router.http_client.stream.return_value.__aenter__.return_value = Mock(
        raise_for_status=Mock(),
        json=AsyncMock(return_value={"status": "success"})
    )
    
    result = await intent_router._call_service(
        "flight-status",
        "http://flight-service/status",
        {"flight": "AA123"}
    )
    
    assert result == {"status": "success"}
    assert intent_router.circuit_breakers["flight-status"].can_execute.called

@pytest.mark.asyncio
async def test_intent_router_circuit_breaker(intent_router):
    """Test circuit breaker functionality."""
    # Mock circuit breaker in open state
    intent_router.circuit_breakers["flight-status"].can_execute.return_value = False
    
    with pytest.raises(Exception) as exc_info:
        await intent_router._call_service(
            "flight-status",
            "http://flight-service/status",
            {"flight": "AA123"}
        )
    
    assert "Circuit open" in str(exc_info.value)

@pytest.mark.asyncio
async def test_multimodal_handler_context_storage(multimodal_handler, mock_redis):
    """Test context storage in Redis."""
    session_id = "test_session"
    context_data = {
        "modality": "text",
        "result": "Test result",
        "confidence": 0.9,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await multimodal_handler._store_in_context(session_id, context_data)
    
    # Verify Redis calls
    mock_redis.lrange.assert_called_once()
    mock_redis.rpush.assert_called_once()
    mock_redis.expire.assert_called_once()

@pytest.mark.asyncio
async def test_prompt_handler_validation(prompt_handler):
    """Test response validation."""
    schema = {
        "type": "object",
        "properties": {
            "flight_status": {"type": "string"},
            "departure_time": {"type": "string"}
        },
        "required": ["flight_status"]
    }
    
    response = json.dumps({
        "flight_status": "on time",
        "departure_time": "10:00 AM"
    })
    
    result = await prompt_handler.validate_response(
        response=response,
        template_name="flight-status",
        schema=schema
    )
    
    assert result["valid"]
    assert not result["errors"]

@pytest.mark.asyncio
async def test_intent_router_idempotency(intent_router, mock_redis):
    """Test idempotency key handling."""
    # Mock Redis response
    mock_redis.get.return_value = json.dumps({"status": "cached"})
    
    result = await intent_router._check_idempotency("test_key")
    
    assert result == {"status": "cached"}
    mock_redis.get.assert_called_once_with("idempotency:test_key") 