from fastapi import APIRouter
from api.schemas import ExtractRequest, JobResponse
from tasks.crawl_tasks import process_domain
import uuid

router = APIRouter(prefix="/extract", tags=["extract"])

@router.post("", response_model=JobResponse)
def create_extraction_job(request: ExtractRequest):
    job_id = str(uuid.uuid4())
    for domain in request.domains:
        process_domain.delay(domain.strip(), job_id)
    return JobResponse(
        job_id=job_id,
        domains_count=len(request.domains),
        status="queued"
    )
