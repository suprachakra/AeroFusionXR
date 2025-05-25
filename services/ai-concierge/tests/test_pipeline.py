import pytest
from pipelines.langchain_pipeline import LangChainPipeline

def test_langchain_basic():
    pipe = LangChainPipeline()
    out = pipe.run("Hello", {})
    assert "reply" in out
