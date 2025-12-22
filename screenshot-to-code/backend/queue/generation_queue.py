import asyncio
from dataclasses import dataclass
from typing import Dict, Any, Optional

# Global generation queue - processes one generation at a time
generation_queue: asyncio.Queue = None  # Will be initialized on startup


def init_queue() -> asyncio.Queue:
    """Initialize the global generation queue"""
    global generation_queue
    if generation_queue is None:
        generation_queue = asyncio.Queue()
    return generation_queue


def get_queue() -> asyncio.Queue:
    """Get the generation queue"""
    global generation_queue
    if generation_queue is None:
        generation_queue = asyncio.Queue()
    return generation_queue


@dataclass
class GenerationJob:
    """A job in the generation queue"""
    generation_id: str
    websocket: Any  # FastAPI WebSocket
    params: Dict[str, str]

    def __repr__(self) -> str:
        return f"GenerationJob(id={self.generation_id[:8]}...)"


async def enqueue_generation(job: GenerationJob) -> None:
    """Add a generation job to the queue"""
    queue = get_queue()
    await queue.put(job)
    print(f"[QUEUE] Enqueued {job}")


async def dequeue_generation() -> Optional[GenerationJob]:
    """Get next generation job from the queue"""
    queue = get_queue()
    try:
        job = queue.get_nowait()
        return job
    except asyncio.QueueEmpty:
        return None


async def wait_for_generation() -> GenerationJob:
    """Wait for next generation job (blocking)"""
    queue = get_queue()
    job = await queue.get()
    return job


def mark_job_done(job: GenerationJob) -> None:
    """Mark a job as done in the queue"""
    queue = get_queue()
    queue.task_done()
    print(f"[QUEUE] Completed {job}")


def queue_size() -> int:
    """Get current queue size"""
    queue = get_queue()
    return queue.qsize()
