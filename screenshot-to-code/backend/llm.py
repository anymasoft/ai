from enum import Enum
from typing import TypedDict


# Actual model versions that are passed to the LLMs and stored in our logs
class Llm(Enum):
    GPT_4_1_MINI = "gpt-4.1-mini"
    GPT_5_1_MINI = "gpt-5.1-mini"


class Completion(TypedDict):
    duration: float
    code: str


# Explicitly map each model to the provider backing it.
MODEL_PROVIDER: dict[Llm, str] = {
    Llm.GPT_4_1_MINI: "openai",
    Llm.GPT_5_1_MINI: "openai",
}

# Convenience set for membership checks
OPENAI_MODELS = {m for m, p in MODEL_PROVIDER.items() if p == "openai"}
