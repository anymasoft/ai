"""History endpoints for accessing generation records."""
from fastapi import APIRouter, HTTPException
from db import list_generations, get_generation, get_generation_variants
from datetime import datetime

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/generations")
async def get_generations_list(limit: int = 20):
    """Get list of recent generations with metadata."""
    try:
        generations = list_generations(limit=limit)

        # Enhance each generation with variants_count and display_name
        enhanced = []
        for gen in generations:
            variants = get_generation_variants(gen["id"])

            # Create display_name from created_at
            created_at = datetime.fromisoformat(gen["created_at"])
            display_name = f"Generation — {created_at.strftime('%Y-%m-%d %H:%M')}"

            enhanced.append({
                "generation_id": gen["id"],
                "created_at": gen["created_at"],
                "display_name": display_name,
                "variants_count": len(variants),
            })

        return {
            "success": True,
            "data": enhanced,
            "count": len(enhanced),
        }
    except Exception as e:
        print(f"[API] error listing generations: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving generations")


@router.get("/generations/{generation_id}")
async def get_generation_detail(generation_id: str):
    """Get details of a specific generation including all variants."""
    try:
        generation = get_generation(generation_id)
        if not generation:
            raise HTTPException(status_code=404, detail="Generation not found")

        # 🔧 FIXED: Include all variants in response
        variants = get_generation_variants(generation_id)

        # 🔧 DIAGNOSTICS: Log what we're returning
        print(f"[API] GET /generations/{generation_id}: found {len(variants)} variants")
        for i, v in enumerate(variants):
            html_len = len(v.get("html", "") or "") if v.get("html") else 0
            print(f"  - Variant {i}: status={v.get('status')}, html_length={html_len}")

        return {
            "success": True,
            "data": {
                **generation,
                "variants": variants,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] error getting generation {generation_id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving generation")
