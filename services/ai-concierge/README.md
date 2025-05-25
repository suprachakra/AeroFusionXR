### GenAI Concierge Service

This service provides a unified, multimodal AI concierge for the Aerofusion XR platform. It handles text, voice, and image inputs; orchestrates LLM calls; enforces guardrails; and integrates with downstream flight, booking, and loyalty systems.

#### Features

* **Multimodal Inputs**: Text, voice (ASR), and image (CV) processing with fallback gracefully handled.
* **Prompt Pipelines**: LangChain orchestration, retrieval-augmented generation, re-ranking, and output validation.
* **Guardrails & Governance**: Bias detection, hallucination mitigation, GDPR/PDPL compliance, audit logging.
* **Context Management**: Session state, user profile, and itinerary stitching.
* **Domain Services**: Flight lookup, booking actions, loyalty checks, and recommendation adapters.
* **Observability**: Structured JSON logging, OpenTelemetry traces, Prometheus metrics.
* **CI/CD**: Automated tests, SAST/DAST scans, policy-as-code gates in GitHub Actions.

#### Repository Structure

```
ai-concierge/
├── app.py                          # FastAPI app setup, middleware, router registration
├── pipelines/
│   ├── langchain_pipeline.py      # Defines chain of retriever, LLM, and post-processors
│   ├── rerank_pipeline.py         # End-to-end reranking and answer selection logic
│   └── utils.py                   # Tokenization, cache management, rate-limit wrappers
├── prompts/
│   ├── base_prompt.md             # Core system instructions and style guidelines
│   ├── fallback_prompt.md         # Fallback messaging templates
│   ├── slot_filling_template.json # JSON schema for slot-filling interactions
│   └── test_prompts.yaml          # YAML cases for automated prompt QA
├── services/
│   ├── flight_service.py          # Flight info API client and adapter
│   ├── booking_service.py         # Booking action orchestrator (reserve, upgrade)
│   └── context_manager.py         # Session state, cache, and user context loader
├── models/
│   ├── request_models.py          # Pydantic schemas for incoming requests
│   └── response_models.py         # Pydantic schemas for outgoing responses
├── tests/
│   ├── test_pipeline.py           # Unit tests for pipeline logic
│   ├── test_prompts.py            # Prompt compliance and template tests
│   └── test_endpoints.py          # Integration tests for FastAPI routes
├── requirements.txt               # Python dependencies pinned for reproducibility
├── Dockerfile                     # Multi-stage build for production container
└── Readme.md                      # This documentation
```

#### Quickstart

```bash
# Create virtualenv
python3 -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations (if any)
# alembic upgrade head

# Start server
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

#### Configuration

| ENV VAR              | Description                                  | Default     |
| -------------------- | -------------------------------------------- | ----------- |
| `AWS_REGION`         | AWS region for Bedrock & S3                  | `us-east-1` |
| `BEDROCK_DOMAIN`     | Bedrock endpoint                             |             |
| `SAGEMAKER_ENDPOINT` | SageMaker inference endpoint                 |             |
| `OPENAI_API_KEY`     | OpenAI API key (if used)                     |             |
| `LOG_LEVEL`          | Logging verbosity (`DEBUG`, `INFO`, `ERROR`) | `INFO`      |

---
