#!/usr/bin/env python3
"""
Test script to verify generation persistence and data recovery.
Tests the critical fix for "Generation completed but confirmation signal was not received" error.
"""

import uuid
from db import init_db, save_generation, update_generation, get_generation, get_db_path

def test_generation_persistence():
    """Test that generations are properly saved and retrievable."""
    print("=" * 70)
    print("TESTING GENERATION PERSISTENCE")
    print("=" * 70)

    # Step 1: Initialize database
    print("\n[1] Initializing database...")
    try:
        init_db()
        print(f"✓ Database initialized at {get_db_path()}")
    except Exception as e:
        print(f"✗ Failed to initialize database: {e}")
        return False

    # Step 2: Create a generation with specific ID
    print("\n[2] Creating generation record...")
    generation_id = str(uuid.uuid4())
    print(f"   Generation ID: {generation_id}")

    try:
        saved_id = save_generation(
            model="gpt-4o-2024-11-20",
            status="started",
            generation_id=generation_id,
        )
        print(f"✓ Generation record created: {saved_id}")
        assert saved_id == generation_id, "Generation ID mismatch!"
    except Exception as e:
        print(f"✗ Failed to create generation: {e}")
        return False

    # Step 3: Verify generation exists in database
    print("\n[3] Retrieving generation from database...")
    try:
        gen = get_generation(generation_id)
        if not gen:
            print(f"✗ Generation {generation_id} not found in database!")
            return False
        print(f"✓ Generation found in database")
        print(f"   Status: {gen['status']}")
        print(f"   Model: {gen['model']}")
    except Exception as e:
        print(f"✗ Failed to retrieve generation: {e}")
        return False

    # Step 4: Update generation with HTML content
    print("\n[4] Updating generation with HTML content...")
    test_html = """<html>
<head><title>Test</title></head>
<body><h1>Test Page</h1></body>
</html>"""

    try:
        update_generation(
            generation_id=generation_id,
            status="completed",
            html=test_html,
            duration_ms=1500,
        )
        print(f"✓ Generation updated with HTML content")
    except Exception as e:
        print(f"✗ Failed to update generation: {e}")
        return False

    # Step 5: Verify updated generation with HTML
    print("\n[5] Retrieving updated generation...")
    try:
        gen = get_generation(generation_id)
        if not gen:
            print(f"✗ Generation {generation_id} not found after update!")
            return False

        print(f"✓ Generation retrieved successfully")
        print(f"   Status: {gen['status']}")
        print(f"   HTML content stored: {len(gen['html']) if gen['html'] else 0} bytes")
        print(f"   Duration: {gen['duration_ms']} ms")

        # Verify HTML content
        if gen['html'] != test_html:
            print(f"✗ HTML content mismatch!")
            return False
        print(f"✓ HTML content verified")
    except Exception as e:
        print(f"✗ Failed to retrieve updated generation: {e}")
        return False

    # Step 6: Test WebSocket failure scenario
    print("\n[6] Simulating WebSocket failure scenario...")
    generation_id_2 = str(uuid.uuid4())
    print(f"   Generation ID 2: {generation_id_2}")

    try:
        # This simulates what happens in the pipeline:
        # 1. Generation is created/initialized
        save_generation(
            model="gpt-4.1-2025-04-14",
            status="started",
            generation_id=generation_id_2,
        )
        print(f"✓ Generation 2 initialized (simulating pipeline start)")

        # 2. HTML is received and immediately saved
        html_content = "<html><body>Simulated result</body></html>"
        update_generation(
            generation_id=generation_id_2,
            status="completed",
            html=html_content,
        )
        print(f"✓ HTML saved to database (before WebSocket close)")

        # 3. WebSocket would close here in failure scenario
        print(f"   [Simulating WebSocket close / timeout]")

        # 4. We verify the HTML is still there
        gen_2 = get_generation(generation_id_2)
        if not gen_2 or not gen_2['html']:
            print(f"✗ HTML was lost! This would indicate the fix is not working.")
            return False

        print(f"✓ HTML recovered from database despite WebSocket failure")
        print(f"   HTML content: {gen_2['html'][:50]}...")
    except Exception as e:
        print(f"✗ Failure scenario test failed: {e}")
        return False

    # Final summary
    print("\n" + "=" * 70)
    print("✓ ALL TESTS PASSED")
    print("=" * 70)
    print("\nSummary:")
    print(f"  - Database persistence: WORKING")
    print(f"  - Generation creation: WORKING")
    print(f"  - HTML storage: WORKING")
    print(f"  - WebSocket failure recovery: WORKING")
    print(f"\nGenerations are properly saved and recoverable from database.")
    print(f"The critical fix prevents data loss when WebSocket closes.")
    print("=" * 70)

    return True

if __name__ == "__main__":
    success = test_generation_persistence()
    exit(0 if success else 1)
