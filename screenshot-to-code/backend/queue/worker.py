import asyncio
import traceback
from typing import Optional

from queue.generation_queue import wait_for_generation, mark_job_done, GenerationJob
from db import update_generation


class GenerationWorker:
    """Processes generation jobs from the queue one at a time"""

    def __init__(self):
        self.is_running = False
        self.current_job: Optional[GenerationJob] = None

    async def start(self) -> None:
        """Start the worker loop"""
        self.is_running = True
        print("[WORKER] Generation worker started")

        while self.is_running:
            try:
                # Wait for next job
                job = await wait_for_generation()
                self.current_job = job

                print(f"[WORKER] Processing {job}")

                # Update status to processing
                try:
                    update_generation(
                        generation_id=job.generation_id,
                        status="processing",
                    )
                except Exception as e:
                    print(f"[WORKER] Failed to update status to processing: {e}")

                # Execute the generation pipeline
                try:
                    # Lazy import to avoid circular dependencies
                    from routes.generate_code import Pipeline, WebSocketSetupMiddleware, ParameterExtractionMiddleware, StatusBroadcastMiddleware, PromptCreationMiddleware, CodeGenerationMiddleware, PostProcessingMiddleware

                    pipeline = Pipeline()
                    pipeline.use(WebSocketSetupMiddleware())
                    # Skip ParameterExtractionMiddleware - we already have params in job
                    pipeline.use(StatusBroadcastMiddleware())
                    pipeline.use(PromptCreationMiddleware())
                    pipeline.use(CodeGenerationMiddleware())
                    pipeline.use(PostProcessingMiddleware())

                    # Execute pipeline with job websocket and pre-provided parameters
                    await pipeline.execute(job.websocket, params=job.params)

                    # Mark job as done
                    mark_job_done(job)

                except asyncio.CancelledError:
                    # Job was cancelled by client
                    print(f"[WORKER] Job cancelled: {job}")
                    try:
                        update_generation(
                            generation_id=job.generation_id,
                            status="cancelled",
                            error_message="Generation cancelled by user",
                        )
                    except Exception as e:
                        print(f"[WORKER] Failed to update cancelled status: {e}")
                    mark_job_done(job)

                except Exception as e:
                    # Job failed
                    print(f"[WORKER] Job failed: {job}")
                    print(f"[WORKER] Error: {e}")
                    traceback.print_exc()

                    try:
                        update_generation(
                            generation_id=job.generation_id,
                            status="failed",
                            error_message=str(e),
                        )
                    except Exception as db_error:
                        print(f"[WORKER] Failed to update error status: {db_error}")

                    mark_job_done(job)

                finally:
                    self.current_job = None

            except asyncio.CancelledError:
                print("[WORKER] Worker cancelled")
                self.is_running = False
                break
            except Exception as e:
                print(f"[WORKER] Unexpected error: {e}")
                traceback.print_exc()
                await asyncio.sleep(1)  # Brief pause before retrying

    async def stop(self) -> None:
        """Stop the worker"""
        print("[WORKER] Stopping worker...")
        self.is_running = False


# Global worker instance
_worker: Optional[GenerationWorker] = None


def get_worker() -> GenerationWorker:
    """Get or create the global worker instance"""
    global _worker
    if _worker is None:
        _worker = GenerationWorker()
    return _worker


async def start_worker() -> None:
    """Start the global worker"""
    worker = get_worker()
    await worker.start()


async def stop_worker() -> None:
    """Stop the global worker"""
    worker = get_worker()
    await worker.stop()


def get_current_job() -> Optional[GenerationJob]:
    """Get the currently processing job"""
    worker = get_worker()
    return worker.current_job
