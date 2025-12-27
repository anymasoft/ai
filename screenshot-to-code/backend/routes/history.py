"""History endpoints for accessing generation records."""
from fastapi import APIRouter, HTTPException, Depends, Request
from db import list_generations, get_generation, get_generation_variants, delete_generation, get_api_conn
from datetime import datetime
from api.routes.auth import get_current_user

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/generations")
async def get_generations_list(limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get list of recent generations for current user with metadata."""
    try:
        user = current_user.get("user")
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        user_id = user.get("id")
        print(f"[API:get_generations] current_user.id={repr(user_id)} (type={type(user_id).__name__})")
        print(f"[API:get_generations] Full user object: {user}")

        # Query API generations table filtered by user_id
        conn = get_api_conn()
        cursor = conn.cursor()

        print(f"[API:get_generations] Executing WHERE user_id = {repr(user_id)} LIMIT {limit}")
        cursor.execute(
            """
            SELECT id, input_type, input_label, input_thumbnail, format, status,
                   result_code, created_at, completed_at, error_message, credits_charged
            FROM api_generations
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, limit)
        )

        rows = cursor.fetchall()
        conn.close()

        print(f"[API:get_generations] Query returned {len(rows)} rows")
        if len(rows) == 0:
            print(f"[API:get_generations] WARNING: Empty result! Checking database for ANY generations...")
            conn2 = get_api_conn()
            cursor2 = conn2.cursor()
            cursor2.execute("SELECT id, user_id FROM api_generations")
            all_gens = cursor2.fetchall()
            print(f"[API:get_generations] Total generations in DB: {len(all_gens)}")
            for gen in all_gens:
                print(f"[API:get_generations] Found: id={gen[0]}, user_id={repr(gen[1])} (type={type(gen[1]).__name__})")
            conn2.close()

        # Format response
        enhanced = []
        for row in rows:
            gen = dict(row)

            # Use input_label if available, otherwise derive from input_type
            input_label = gen.get("input_label")
            if not input_label:
                if gen["input_type"] == "url":
                    # For URLs, try to extract domain from input_data
                    try:
                        from urllib.parse import urlparse
                        parsed = urlparse(gen["input_data"])
                        input_label = parsed.hostname or gen["input_data"]
                    except:
                        input_label = "URL"
                else:
                    # For images, use generic label
                    input_label = "Image"

            enhanced.append({
                "generation_id": gen["id"],
                "created_at": gen["created_at"],
                "input_type": gen["input_type"],
                "input_label": input_label,
                "input_thumbnail": gen["input_thumbnail"],
                "format": gen["format"],
                "status": gen["status"],
                "result_code": gen["result_code"],
                "display_name": f"Generation — {datetime.fromisoformat(gen['created_at']).strftime('%Y-%m-%d %H:%M')}",
            })

        return {
            "success": True,
            "data": enhanced,
            "count": len(enhanced),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] error listing generations for user {user_id}: {e}")
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


@router.delete("/generations/{generation_id}")
async def delete_generation_endpoint(generation_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a single generation if it belongs to current user."""
    try:
        user = current_user.get("user")
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        user_id = user.get("id")

        # Verify generation belongs to current user
        conn = get_api_conn()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM api_generations WHERE id = ? AND user_id = ?",
            (generation_id, user_id)
        )

        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Generation not found")

        # Delete the generation
        cursor.execute("DELETE FROM api_generations WHERE id = ?", (generation_id,))
        conn.commit()
        conn.close()

        print(f"[API] DELETE /generations/{generation_id}: deleted for user {user_id}")
        return {
            "success": True,
            "data": {"generation_id": generation_id},
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] error deleting generation {generation_id}: {e}")
        raise HTTPException(status_code=500, detail="Error deleting generation")


@router.delete("/history")
async def clear_history(current_user: dict = Depends(get_current_user)):
    """Clear all history for current user."""
    try:
        user = current_user.get("user")
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        user_id = user.get("id")

        # Delete all generations for this user
        conn = get_api_conn()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM api_generations WHERE user_id = ?", (user_id,))
        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()

        print(f"[API] DELETE /history: cleared {deleted_count} items for user {user_id}")
        return {
            "success": True,
            "data": {"deleted_count": deleted_count},
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] error clearing history: {e}")
        raise HTTPException(status_code=500, detail="Error clearing history")
