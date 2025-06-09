from typing import Dict, List, Optional, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer, util
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import logging
from opentelemetry import trace
from prometheus_client import Counter, Histogram
import time
import redis
from dataclasses import dataclass
from sklearn.metrics.pairwise import cosine_similarity

tracer = trace.get_tracer(__name__)

# Metrics
RERANK_LATENCY = Histogram(
    'rerank_pipeline_latency_seconds',
    'Time spent in reranking pipeline',
    ['stage']
)

CANDIDATE_COUNT = Histogram(
    'rerank_candidate_count',
    'Number of candidates processed',
    ['stage']
)

SCORE_DISTRIBUTION = Histogram(
    'rerank_score_distribution',
    'Distribution of reranking scores',
    ['method']
)

@dataclass
class RerankCandidate:
    """Data class for reranking candidates."""
    text: str
    semantic_score: float = 0.0
    relevance_score: float = 0.0
    coherence_score: float = 0.0
    final_score: float = 0.0
    metadata: Optional[Dict] = None

class RerankPipeline:
    """Reranks multiple candidate responses using ensemble of methods."""
    def __init__(self, redis_client: redis.Redis):
        self.logger = logging.getLogger(__name__)
        self.redis = redis_client
        
        # Initialize models
        self.semantic_model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
        self.relevance_tokenizer = AutoTokenizer.from_pretrained('cross-encoder/ms-marco-MiniLM-L-6-v2')
        self.relevance_model = AutoModelForSequenceClassification.from_pretrained('cross-encoder/ms-marco-MiniLM-L-6-v2')
        
        # Cache settings
        self.cache_ttl = 3600  # 1 hour
        
        # Scoring weights
        self.weights = {
            'semantic': 0.4,
            'relevance': 0.4,
            'coherence': 0.2
        }
        
        # Thresholds
        self.min_score_threshold = 0.3
        self.max_candidates = 10

    async def rerank(
        self,
        query: str,
        candidates: List[str],
        context: Optional[Dict] = None
    ) -> Dict:
        """Rerank candidates using multiple scoring methods."""
        with tracer.start_as_current_span("rerank_pipeline") as span:
            try:
                start_time = time.time()
                
                # Check cache first
                cache_key = f"rerank:{hash(query)}:{hash(str(candidates))}"
                cached_result = self.redis.get(cache_key)
                if cached_result:
                    return json.loads(cached_result)
                
                # Convert candidates to RerankCandidate objects
                rerank_candidates = [
                    RerankCandidate(text=text)
                    for text in candidates[:self.max_candidates]
                ]
                
                CANDIDATE_COUNT.labels(stage="initial").observe(len(rerank_candidates))
                
                # Calculate semantic similarity scores
                with tracer.start_span("semantic_scoring"):
                    semantic_start = time.time()
                    await self._calculate_semantic_scores(query, rerank_candidates)
                    RERANK_LATENCY.labels(stage="semantic").observe(
                        time.time() - semantic_start
                    )
                
                # Calculate relevance scores
                with tracer.start_span("relevance_scoring"):
                    relevance_start = time.time()
                    await self._calculate_relevance_scores(query, rerank_candidates)
                    RERANK_LATENCY.labels(stage="relevance").observe(
                        time.time() - relevance_start
                    )
                
                # Calculate coherence scores
                if context:
                    with tracer.start_span("coherence_scoring"):
                        coherence_start = time.time()
                        await self._calculate_coherence_scores(
                            rerank_candidates,
                            context
                        )
                        RERANK_LATENCY.labels(stage="coherence").observe(
                            time.time() - coherence_start
                        )
                
                # Calculate final scores
                for candidate in rerank_candidates:
                    candidate.final_score = (
                        self.weights['semantic'] * candidate.semantic_score +
                        self.weights['relevance'] * candidate.relevance_score +
                        self.weights['coherence'] * candidate.coherence_score
                    )
                
                # Filter by minimum score
                rerank_candidates = [
                    c for c in rerank_candidates
                    if c.final_score >= self.min_score_threshold
                ]
                
                # Sort by final score
                rerank_candidates.sort(key=lambda x: x.final_score, reverse=True)
                
                CANDIDATE_COUNT.labels(stage="final").observe(len(rerank_candidates))
                
                result = {
                    "reranked_responses": [
                        {
                            "text": c.text,
                            "score": c.final_score,
                            "scores": {
                                "semantic": c.semantic_score,
                                "relevance": c.relevance_score,
                                "coherence": c.coherence_score
                            }
                        }
                        for c in rerank_candidates
                    ]
                }
                
                # Cache result
                self.redis.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps(result)
                )
                
                RERANK_LATENCY.labels(stage="total").observe(
                    time.time() - start_time
                )
                
                return result

            except Exception as e:
                self.logger.error(f"Error in reranking pipeline: {str(e)}")
                span.record_exception(e)
                raise

    async def _calculate_semantic_scores(
        self,
        query: str,
        candidates: List[RerankCandidate]
    ):
        """Calculate semantic similarity scores using sentence embeddings."""
        try:
            # Get embeddings
            query_embedding = self.semantic_model.encode(
                query,
                convert_to_tensor=True
            )
            
            candidate_embeddings = self.semantic_model.encode(
                [c.text for c in candidates],
                convert_to_tensor=True
            )
            
            # Calculate cosine similarities
            similarities = util.pytorch_cos_sim(
                query_embedding,
                candidate_embeddings
            )[0]
            
            # Update candidates
            for idx, candidate in enumerate(candidates):
                score = float(similarities[idx])
                candidate.semantic_score = score
                SCORE_DISTRIBUTION.labels(method="semantic").observe(score)

        except Exception as e:
            self.logger.error(f"Error calculating semantic scores: {str(e)}")
            raise

    async def _calculate_relevance_scores(
        self,
        query: str,
        candidates: List[RerankCandidate]
    ):
        """Calculate query-document relevance scores."""
        try:
            # Prepare inputs
            inputs = self.relevance_tokenizer(
                [(query, c.text) for c in candidates],
                padding=True,
                truncation=True,
                return_tensors='pt'
            )
            
            # Get relevance scores
            with torch.no_grad():
                outputs = self.relevance_model(**inputs)
                scores = torch.sigmoid(outputs.logits).squeeze()
            
            # Update candidates
            for idx, candidate in enumerate(candidates):
                score = float(scores[idx])
                candidate.relevance_score = score
                SCORE_DISTRIBUTION.labels(method="relevance").observe(score)

        except Exception as e:
            self.logger.error(f"Error calculating relevance scores: {str(e)}")
            raise

    async def _calculate_coherence_scores(
        self,
        candidates: List[RerankCandidate],
        context: Dict
    ):
        """Calculate coherence with conversation context."""
        try:
            if 'history' not in context:
                return
            
            # Get last few turns of conversation
            history = context['history'][-3:]  # Last 3 turns
            history_text = " ".join(history)
            
            # Get embeddings
            history_embedding = self.semantic_model.encode(
                history_text,
                convert_to_tensor=True
            )
            
            candidate_embeddings = self.semantic_model.encode(
                [c.text for c in candidates],
                convert_to_tensor=True
            )
            
            # Calculate coherence scores
            similarities = util.pytorch_cos_sim(
                history_embedding,
                candidate_embeddings
            )[0]
            
            # Update candidates
            for idx, candidate in enumerate(candidates):
                score = float(similarities[idx])
                candidate.coherence_score = score
                SCORE_DISTRIBUTION.labels(method="coherence").observe(score)

        except Exception as e:
            self.logger.error(f"Error calculating coherence scores: {str(e)}")
            raise 