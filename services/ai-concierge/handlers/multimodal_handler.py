from typing import Dict, Optional, Union, List
import numpy as np
from fastapi import UploadFile
import speech_recognition as sr
from PIL import Image
import io
import torch
from transformers import CLIPProcessor, CLIPModel, AutoTokenizer, AutoModelForSequenceClassification
import logging
from opentelemetry import trace
from prometheus_client import Counter, Histogram
import json
import redis
from datetime import datetime
import time
import cv2
import qrcode
from textblob import TextBlob
import asyncio
from concurrent.futures import ThreadPoolExecutor

tracer = trace.get_tracer(__name__)

# Metrics
MODALITY_LATENCY = Histogram(
    'modality_processing_latency_seconds',
    'Time spent processing each modality',
    ['modality_type']
)

MODALITY_FALLBACKS = Counter(
    'modality_fallbacks_total',
    'Number of times fallback was triggered',
    ['from_modality', 'to_modality']
)

CONFIDENCE_SCORES = Histogram(
    'modality_confidence_scores',
    'Confidence scores for modality processing',
    ['modality_type']
)

MODALITY_ERRORS = Counter(
    'modality_errors_total',
    'Number of processing errors by modality',
    ['modality_type', 'error_type']
)

class MultiModalHandler:
    def __init__(self, redis_client: redis.Redis):
        self.logger = logging.getLogger(__name__)
        self.redis = redis_client
        self.executor = ThreadPoolExecutor(max_workers=3)
        
        # Initialize models
        self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        self.speech_recognizer = sr.Recognizer()
        
        # Initialize sentiment analyzer
        self.sentiment_tokenizer = AutoTokenizer.from_pretrained("nlptown/bert-base-multilingual-uncased-sentiment")
        self.sentiment_model = AutoModelForSequenceClassification.from_pretrained("nlptown/bert-base-multilingual-uncased-sentiment")
        
        # QR code detector
        self.qr_detector = cv2.QRCodeDetector()
        
        # Confidence thresholds
        self.confidence_thresholds = {
            'text': 0.7,
            'voice': 0.8,
            'image': 0.6,
            'qr': 0.9
        }
        
        # Retry settings
        self.max_retries = 3
        self.retry_delay = 1.0  # seconds

    async def process_query(
        self,
        text: Optional[str] = None,
        voice_file: Optional[UploadFile] = None,
        image_file: Optional[UploadFile] = None,
        session_id: str = None
    ) -> Dict:
        """Process multimodal query with automatic fallback."""
        with tracer.start_as_current_span("process_multimodal_query") as span:
            try:
                result = None
                confidence = 0.0
                modality_used = None
                
                # Try each modality in order of preference
                if text:
                    with tracer.start_span("process_text"):
                        start_time = time.time()
                        result, confidence = await self._process_text(text)
                        MODALITY_LATENCY.labels(modality_type="text").observe(time.time() - start_time)
                        
                        if confidence >= self.confidence_thresholds['text']:
                            modality_used = "text"
                            # Analyze sentiment for context
                            sentiment = await self._analyze_sentiment(text)
                        else:
                            span.set_attribute("text_confidence_low", True)

                if not modality_used and voice_file:
                    with tracer.start_span("process_voice"):
                        start_time = time.time()
                        for retry in range(self.max_retries):
                            try:
                                voice_text, voice_confidence = await self._process_voice(voice_file)
                                MODALITY_LATENCY.labels(modality_type="voice").observe(time.time() - start_time)
                                
                                if voice_confidence >= self.confidence_thresholds['voice']:
                                    result = voice_text
                                    confidence = voice_confidence
                                    modality_used = "voice"
                                    # Analyze sentiment for context
                                    sentiment = await self._analyze_sentiment(voice_text)
                                    break
                                else:
                                    span.set_attribute("voice_confidence_low", True)
                                    if voice_text:  # Fallback to text processing
                                        MODALITY_FALLBACKS.labels(from_modality="voice", to_modality="text").inc()
                                        result, confidence = await self._process_text(voice_text)
                                        if confidence >= self.confidence_thresholds['text']:
                                            modality_used = "text_from_voice"
                                            sentiment = await self._analyze_sentiment(voice_text)
                                            break
                            except Exception as e:
                                if retry == self.max_retries - 1:
                                    raise
                                await asyncio.sleep(self.retry_delay * (2 ** retry))

                if not modality_used and image_file:
                    with tracer.start_span("process_image"):
                        start_time = time.time()
                        # Try QR code detection first
                        qr_result, qr_confidence = await self._process_qr_code(image_file)
                        
                        if qr_confidence >= self.confidence_thresholds['qr']:
                            result = qr_result
                            confidence = qr_confidence
                            modality_used = "qr_code"
                        else:
                            # Fallback to general image processing
                            image_result, image_confidence = await self._process_image(image_file)
                            MODALITY_LATENCY.labels(modality_type="image").observe(time.time() - start_time)
                            
                            if image_confidence >= self.confidence_thresholds['image']:
                                result = image_result
                                confidence = image_confidence
                                modality_used = "image"
                            else:
                                span.set_attribute("image_confidence_low", True)

                # Store in session context if available
                if session_id and result:
                    context_data = {
                        "modality": modality_used,
                        "result": result,
                        "confidence": confidence,
                        "sentiment": sentiment if 'sentiment' in locals() else None,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    await self._store_in_context(session_id, context_data)

                # Record confidence score
                if modality_used:
                    CONFIDENCE_SCORES.labels(modality_type=modality_used).observe(confidence)

                return {
                    "result": result,
                    "confidence": confidence,
                    "modality_used": modality_used,
                    "sentiment": sentiment if 'sentiment' in locals() else None,
                    "uncertain": confidence < self.confidence_thresholds.get(modality_used.split("_")[0], 0.7) if modality_used else True
                }

            except Exception as e:
                self.logger.error(f"Error processing multimodal query: {str(e)}")
                span.record_exception(e)
                MODALITY_ERRORS.labels(
                    modality_type=modality_used or "unknown",
                    error_type=type(e).__name__
                ).inc()
                raise

    async def _process_qr_code(self, image_file: UploadFile) -> tuple[Optional[str], float]:
        """Process image for QR code detection."""
        try:
            # Read image file
            image_data = await image_file.read()
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Detect QR code
            data, bbox, _ = self.qr_detector.detectAndDecode(image)
            
            if data and bbox is not None:
                return data, 1.0  # High confidence if QR code is detected
            return None, 0.0

        except Exception as e:
            self.logger.error(f"Error processing QR code: {str(e)}")
            MODALITY_ERRORS.labels(
                modality_type="qr_code",
                error_type=type(e).__name__
            ).inc()
            raise

    async def _analyze_sentiment(self, text: str) -> Dict[str, float]:
        """Analyze sentiment of text input."""
        try:
            inputs = self.sentiment_tokenizer(text, return_tensors="pt", truncation=True)
            outputs = self.sentiment_model(**inputs)
            scores = torch.softmax(outputs.logits, dim=1)
            
            return {
                "positive": float(scores[0][4]),  # 5-star sentiment
                "neutral": float(scores[0][2]),   # 3-star sentiment
                "negative": float(scores[0][0])   # 1-star sentiment
            }

        except Exception as e:
            self.logger.error(f"Error analyzing sentiment: {str(e)}")
            return {"positive": 0.0, "neutral": 1.0, "negative": 0.0}

    async def _store_in_context(self, session_id: str, context_data: Dict):
        """Store query context in Redis for session continuity."""
        try:
            key = f"session:{session_id}:context"
            context_list = self.redis.lrange(key, 0, -1)
            
            # Keep last 10 interactions
            if len(context_list) >= 10:
                self.redis.ltrim(key, 0, 8)
            
            self.redis.rpush(key, json.dumps(context_data))
            self.redis.expire(key, 3600)  # Expire after 1 hour

        except Exception as e:
            self.logger.error(f"Error storing context: {str(e)}")
            raise 