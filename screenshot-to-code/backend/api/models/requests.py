"""Request models."""

from pydantic import BaseModel, Field, validator
from typing import Literal


class InputData(BaseModel):
    """Input data for generation."""

    type: Literal["image", "url"] = Field(..., description="Input type")
    data: str = Field(..., description="Base64 image or URL")

    @validator("data")
    def validate_data(cls, v, values):
        input_type = values.get("type")
        if input_type == "url":
            if not v.startswith(("http://", "https://")):
                raise ValueError("URL must start with http:// or https://")
        elif input_type == "image":
            if not v.startswith("data:image/"):
                raise ValueError("Image must be base64 data URI")
        return v


class GenerateRequest(BaseModel):
    """Request to generate code."""

    input: InputData = Field(..., description="Input data")
    format: Literal["html_tailwind", "html_css", "react_tailwind", "vue_tailwind"] = Field(
        ..., description="Output format"
    )
    instructions: str | None = Field(
        None, max_length=500, description="Optional user instructions"
    )
