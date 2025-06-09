from typing import Dict, List, Optional
from langchain import OpenAI, PromptTemplate, LLMChain
from langchain.vectorstores import FAISS
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain.retrievers import BM25Retriever, EnsembleRetriever
from langchain.agents import Tool, AgentExecutor, LLMSingleActionAgent
from langchain.memory import RedisChatMessageHistory, ConversationBufferMemory
import redis
import logging
from opentelemetry import trace
from prometheus_client import Counter, Histogram
import time
import json
import os
from datetime import datetime

tracer = trace.get_tracer(__name__)

# Metrics
PIPELINE_LATENCY = Histogram(
    'langchain_pipeline_latency_seconds',
    'Time spent in LangChain pipeline',
    ['stage']
)

RETRIEVAL_COUNT = Counter(
    'langchain_retrieval_total',
    'Number of knowledge base retrievals',
    ['source', 'status']
)

TOOL_USAGE = Counter(
    'langchain_tool_usage_total',
    'Number of tool invocations',
    ['tool_name', 'status']
)

class LangChainPipeline:
    def __init__(self, redis_client: redis.Redis):
        self.logger = logging.getLogger(__name__)
        self.redis = redis_client
        
        # Initialize LLM
        self.llm = OpenAI(
            temperature=0,
            model_name="gpt-4",
            max_tokens=1000
        )
        
        # Initialize embeddings
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-mpnet-base-v2"
        )
        
        # Initialize vector store
        self.vector_store = self._initialize_vector_store()
        
        # Initialize retrievers
        self.bm25_retriever = BM25Retriever.from_documents(
            self._load_documents(),
            k=5
        )
        
        self.ensemble_retriever = EnsembleRetriever(
            retrievers=[
                self.vector_store.as_retriever(search_kwargs={"k": 5}),
                self.bm25_retriever
            ],
            weights=[0.7, 0.3]
        )
        
        # Initialize tools
        self.tools = self._initialize_tools()
        
        # Initialize agent
        self.agent_executor = self._initialize_agent()
        
        # Text splitter for document processing
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )

    def _initialize_vector_store(self):
        """Initialize FAISS vector store with knowledge base documents."""
        try:
            # Load documents from knowledge base
            docs = self._load_documents()
            
            # Create vector store
            vector_store = FAISS.from_documents(docs, self.embeddings)
            
            return vector_store

        except Exception as e:
            self.logger.error(f"Error initializing vector store: {str(e)}")
            raise

    def _load_documents(self) -> List:
        """Load documents from various knowledge sources."""
        try:
            documents = []
            
            # Load flight schedules
            flight_schedules = self._load_flight_schedules()
            documents.extend(flight_schedules)
            
            # Load airport maps
            airport_maps = self._load_airport_maps()
            documents.extend(airport_maps)
            
            # Load product catalogs
            product_catalogs = self._load_product_catalogs()
            documents.extend(product_catalogs)
            
            return self.text_splitter.split_documents(documents)

        except Exception as e:
            self.logger.error(f"Error loading documents: {str(e)}")
            raise

    def _initialize_tools(self) -> List[Tool]:
        """Initialize available tools for the agent."""
        return [
            Tool(
                name="Calendar",
                func=self._calendar_tool,
                description="Check and manage calendar events"
            ),
            Tool(
                name="Payments",
                func=self._payment_tool,
                description="Process payments and refunds"
            ),
            Tool(
                name="CRM",
                func=self._crm_tool,
                description="Access customer information and history"
            )
        ]

    def _initialize_agent(self) -> AgentExecutor:
        """Initialize LLM agent with tools."""
        agent = LLMSingleActionAgent(
            llm=self.llm,
            tools=self.tools,
            max_iterations=3
        )
        
        return AgentExecutor.from_agent_and_tools(
            agent=agent,
            tools=self.tools,
            verbose=True
        )

    async def process(self, payload: Dict, session_id: Optional[str] = None) -> Dict:
        """Process query through LangChain pipeline."""
        with tracer.start_as_current_span("langchain_pipeline") as span:
            try:
                start_time = time.time()
                query = payload.get("input_text")
                
                if not query:
                    raise ValueError("No input text provided")
                
                # Initialize conversation memory
                memory = None
                if session_id:
                    memory = ConversationBufferMemory(
                        memory_key="chat_history",
                        chat_memory=RedisChatMessageHistory(
                            session_id,
                            url=f"redis://{self.redis.connection_pool.connection_kwargs['host']}:{self.redis.connection_pool.connection_kwargs['port']}"
                        )
                    )
                
                # Retrieve relevant documents
                with tracer.start_span("retrieval"):
                    retrieval_start = time.time()
                    docs = self.ensemble_retriever.get_relevant_documents(query)
                    PIPELINE_LATENCY.labels(stage="retrieval").observe(
                        time.time() - retrieval_start
                    )
                    RETRIEVAL_COUNT.labels(source="ensemble", status="success").inc()
                
                # Create QA chain
                qa_chain = RetrievalQA.from_chain_type(
                    llm=self.llm,
                    chain_type="stuff",
                    retriever=self.ensemble_retriever,
                    memory=memory
                )
                
                # Get answer
                with tracer.start_span("qa_chain"):
                    qa_start = time.time()
                    answer = qa_chain({"query": query})
                    PIPELINE_LATENCY.labels(stage="qa_chain").observe(
                        time.time() - qa_start
                    )
                
                # Check if tools are needed
                tools_needed = self._check_tools_needed(query, answer['result'])
                if tools_needed:
                    with tracer.start_span("tool_execution"):
                        tool_start = time.time()
                        tool_result = await self.agent_executor.arun(
                            input=query,
                            chat_history=memory.chat_memory.messages if memory else None
                        )
                        PIPELINE_LATENCY.labels(stage="tools").observe(
                            time.time() - tool_start
                        )
                        answer['result'] = self._combine_results(
                            answer['result'],
                            tool_result
                        )
                
                PIPELINE_LATENCY.labels(stage="total").observe(
                    time.time() - start_time
                )
                
                return {
                    "response": answer['result'],
                    "source_documents": [doc.page_content for doc in docs],
                    "tools_used": tools_needed
                }

            except Exception as e:
                self.logger.error(f"Error in LangChain pipeline: {str(e)}")
                span.record_exception(e)
                raise

    def _check_tools_needed(self, query: str, initial_answer: str) -> List[str]:
        """Check if any tools are needed based on query and initial answer."""
        tools_needed = []
        
        # Check for calendar-related queries
        if any(word in query.lower() for word in ['schedule', 'calendar', 'appointment']):
            tools_needed.append('Calendar')
        
        # Check for payment-related queries
        if any(word in query.lower() for word in ['pay', 'refund', 'charge']):
            tools_needed.append('Payments')
        
        # Check for customer-related queries
        if any(word in query.lower() for word in ['account', 'profile', 'history']):
            tools_needed.append('CRM')
        
        return tools_needed

    def _combine_results(self, qa_result: str, tool_result: str) -> str:
        """Combine QA and tool results into a coherent response."""
        return f"{qa_result}\n\nAdditional Information:\n{tool_result}"

    async def _calendar_tool(self, query: str) -> str:
        """Tool for calendar operations."""
        try:
            TOOL_USAGE.labels(tool_name="Calendar", status="success").inc()
            # Implement calendar integration
            return "Calendar tool executed successfully"
        except Exception as e:
            TOOL_USAGE.labels(tool_name="Calendar", status="error").inc()
            raise

    async def _payment_tool(self, query: str) -> str:
        """Tool for payment operations."""
        try:
            TOOL_USAGE.labels(tool_name="Payments", status="success").inc()
            # Implement payment integration
            return "Payment tool executed successfully"
        except Exception as e:
            TOOL_USAGE.labels(tool_name="Payments", status="error").inc()
            raise

    async def _crm_tool(self, query: str) -> str:
        """Tool for CRM operations."""
        try:
            TOOL_USAGE.labels(tool_name="CRM", status="success").inc()
            # Implement CRM integration
            return "CRM tool executed successfully"
        except Exception as e:
            TOOL_USAGE.labels(tool_name="CRM", status="error").inc()
            raise

    def _load_flight_schedules(self) -> List:
        """Load flight schedule documents."""
        # Implement flight schedule loading
        return []

    def _load_airport_maps(self) -> List:
        """Load airport map documents."""
        # Implement airport map loading
        return []

    def _load_product_catalogs(self) -> List:
        """Load product catalog documents."""
        # Implement product catalog loading
        return [] 