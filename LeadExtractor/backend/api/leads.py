from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from api.schemas import LeadResponse
from db.database import get_db
from db.models import Lead

router = APIRouter(prefix="/leads", tags=["leads"])

@router.get("", response_model=List[LeadResponse])
def get_leads(
    job_id: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Lead)
    if job_id:
        query = query.filter(Lead.job_id == job_id)
    if domain:
        query = query.filter(Lead.domain == domain)
    leads = query.order_by(Lead.created_at.desc()).limit(1000).all()
    return [
        LeadResponse(
            id=lead.id, domain=lead.domain, email=lead.email,
            phone=lead.phone, source_page=lead.source_page,
            job_id=lead.job_id, created_at=lead.created_at.isoformat()
        )
        for lead in leads
    ]
