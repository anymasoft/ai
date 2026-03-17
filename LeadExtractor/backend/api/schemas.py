from pydantic import BaseModel, Field
from typing import Optional

class ExtractRequest(BaseModel):
    domains: list[str] = Field(..., min_length=1, max_length=50)

class JobResponse(BaseModel):
    job_id: str
    domains_count: int
    status: str = "queued"

class LeadResponse(BaseModel):
    id: int
    domain: str
    email: Optional[str] = None
    phone: Optional[str] = None
    source_page: Optional[str] = None
    job_id: str
    created_at: str
    class Config:
        from_attributes = True
