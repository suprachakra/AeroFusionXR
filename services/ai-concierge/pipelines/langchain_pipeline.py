from langchain import OpenAI, PromptTemplate, LLMChain

class AIPipeline:
    def __init__(self):
        template = PromptTemplate(
            input_variables=["input_text"],
            template="{{input_text}}"
        )
        self.chain = LLMChain(llm=OpenAI(temperature=0), prompt=template)

    def process(self, payload):
        return {"response": self.chain.run(payload.get("input_text"))}

pipeline = AIPipeline()
