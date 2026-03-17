from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from db.database import Base

class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    source_page = Column(String, nullable=True)
    job_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
