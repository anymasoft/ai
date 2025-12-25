"""Formats endpoint."""

from fastapi import APIRouter, Depends
from api.models.responses import FormatsResponse, FormatInfo
from api.auth import get_api_key
from api.credits import FORMAT_COSTS

router = APIRouter()


@router.get("/api/formats", response_model=FormatsResponse, tags=["Formats"])
async def list_formats(api_key_info: dict = Depends(get_api_key)):
    """List available code generation formats and their costs."""

    formats = [
        FormatInfo(
            id="html_tailwind",
            name="HTML + Tailwind",
            cost=FORMAT_COSTS["html_tailwind"],
        ),
        FormatInfo(
            id="html_css",
            name="HTML + CSS",
            cost=FORMAT_COSTS["html_css"],
        ),
        FormatInfo(
            id="react_tailwind",
            name="React + Tailwind",
            cost=FORMAT_COSTS["react_tailwind"],
        ),
        FormatInfo(
            id="vue_tailwind",
            name="Vue + Tailwind",
            cost=FORMAT_COSTS["vue_tailwind"],
            beta=True,
        ),
    ]

    return FormatsResponse(formats=formats)
