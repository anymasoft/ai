from tasks.celery_app import celery_app
from crawler.crawl4ai_client import Crawl4AIClient
from extractor.email_extractor import extract_emails
from extractor.phone_extractor import extract_phones
from db.database import SessionLocal
from db.models import Lead
import asyncio

@celery_app.task(bind=True, max_retries=3)
def process_domain(self, domain: str, job_id: str):
    try:
        client = Crawl4AIClient(timeout=15, max_pages=5)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        crawl_result = loop.run_until_complete(client.crawl_domain(domain))
        loop.close()

        emails_found = set()
        phones_found = set()
        sources = []

        for page in crawl_result['pages']:
            text = page['text']
            emails = extract_emails(text)
            emails_found.update(emails)
            phones = extract_phones(text)
            phones_found.update(phones)
            if emails or phones:
                sources.append(page['url'])

        db = SessionLocal()
        try:
            for email in emails_found:
                db.add(Lead(domain=domain, email=email, job_id=job_id,
                           source_page=sources[0] if sources else None))
            for phone in phones_found:
                db.add(Lead(domain=domain, phone=phone, job_id=job_id,
                           source_page=sources[0] if sources else None))
            db.commit()
        finally:
            db.close()

        return {'domain': domain, 'job_id': job_id, 'emails': len(emails_found),
                'phones': len(phones_found), 'pages': len(crawl_result['pages'])}
    except Exception as e:
        self.retry(exc=e, countdown=60)
