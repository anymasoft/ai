"""History endpoints for accessing generation records."""
from fastapi import APIRouter, HTTPException
from db import list_generations, get_generation

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/generations")
async def get_generations_list(limit: int = 20):
    """Get list of recent generations."""
    try:
        generations = list_generations(limit=limit)
        return {
            "success": True,
            "data": generations,
            "count": len(generations),
        }
    except Exception as e:
        print(f"[API] error listing generations: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving generations")


@router.get("/generations/{generation_id}")
async def get_generation_detail(generation_id: str):
    """Get details of a specific generation."""
    try:
        generation = get_generation(generation_id)
        if not generation:
            raise HTTPException(status_code=404, detail="Generation not found")

        return {
            "success": True,
            "data": generation,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] error getting generation {generation_id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving generation")
