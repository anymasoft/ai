"""Generations detail endpoint."""

from db import get_api_conn, hash_api_key
from fastapi import APIRouter, Depends, HTTPException, status
from api.models.responses import GenerationDetail, InputInfo, ResultInfo
from api.auth import get_api_key

router = APIRouter()


@router.get(
    "/api/generations/{generation_id}",
    response_model=GenerationDetail,
    tags=["Generation"],
)
async def get_generation(generation_id: str, api_key_info: dict = Depends(get_api_key)):
    """Get generation details and result."""

    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT *
        FROM api_generations
        WHERE id = ? AND user_id = ?
        """,
        (generation_id, api_key_info["user_id"]),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Generation not found"},
        )

    gen = dict(row)

    return GenerationDetail(
        id=gen["id"],
        status=gen["status"],
        format=gen["format"],
        created_at=gen["created_at"],
        completed_at=gen["completed_at"],
        input=InputInfo(type=gen["input_type"], preview=gen["input_thumbnail"]),
        result=ResultInfo(code=gen["result_code"], preview_url=None),
        error=gen["error_message"],
        credits_charged=gen["credits_charged"],
    )
