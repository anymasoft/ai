import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import logging

from crawl4ai_client import Crawl4AIClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeadExtractor API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExtractRequest(BaseModel):
    urls: List[str]

class ContactEmail(BaseModel):
    email: str
    source_page: str

class ContactPhone(BaseModel):
    phone: str
    source_page: str

class ContactResult(BaseModel):
    website: str
    emails: List[ContactEmail]
    phones: List[ContactPhone]
    sources: List[str]
    status_per_site: dict = {}

class ExtractResponse(BaseModel):
    results: List[ContactResult]
    total: int

@app.post("/api/extract", response_model=ExtractResponse)
async def extract_contacts(request: ExtractRequest):
    """Извлечь контакты из списка URL."""
    if not request.urls:
        raise HTTPException(status_code=400, detail="URLs list cannot be empty")

    urls = [url.strip() for url in request.urls if url.strip()]
    if not urls:
        raise HTTPException(status_code=400, detail="No valid URLs provided")

    client = Crawl4AIClient(timeout=30, max_pages=10, max_depth=2)
    results = []

    try:
        # Обработать все URL параллельно
        tasks = [client.extract(url) for url in urls]
        all_results = await asyncio.gather(*tasks, return_exceptions=True)

        for url, crawl_result in zip(urls, all_results):
            if isinstance(crawl_result, Exception):
                logger.error(f"Error crawling {url}: {crawl_result}")
                crawl_result = {"emails": [], "phones": [], "status_per_site": {}}

            display_url = url if url.startswith(('http://', 'https://')) else f'https://{url}'

            # DEBUG: Log raw crawl_result
            logger.info(f"\n[API DEBUG] Processing URL: {display_url}")
            logger.info(f"[API DEBUG] Raw crawl_result phones count: {len(crawl_result.get('phones', []))}")
            logger.info(f"[API DEBUG] Raw crawl_result phones:")
            for i, phone in enumerate(crawl_result.get('phones', [])[:20]):
                logger.info(f"    [{i}] {phone}")

            # Собрать все source_page для отображения
            sources = set()
            for item in crawl_result.get("emails", []):
                sources.add(item.get("source_page", ""))
            for item in crawl_result.get("phones", []):
                sources.add(item.get("source_page", ""))

            result = ContactResult(
                website=display_url,
                emails=[ContactEmail(**e) for e in crawl_result.get("emails", [])],
                phones=[ContactPhone(**p) for p in crawl_result.get("phones", [])],
                sources=list(s for s in sources if s),
                status_per_site=crawl_result.get("status_per_site", {})
            )

            # DEBUG: Log ContactResult
            logger.info(f"[API DEBUG] ContactResult created:")
            logger.info(f"    emails: {len(result.emails)}")
            logger.info(f"    phones: {len(result.phones)}")
            logger.info(f"[API DEBUG] ContactResult phones:")
            for i, phone in enumerate(result.phones[:20]):
                logger.info(f"    [{i}] {phone}")

            results.append(result)

        logger.info(f"\n[API DEBUG] FINAL RESPONSE:")
        logger.info(f"  Total results: {len(results)}")
        for i, result in enumerate(results):
            logger.info(f"  [{i}] {result.website}: {len(result.emails)} emails, {len(result.phones)} phones")

        return ExtractResponse(results=results, total=len(results))

    except Exception as e:
        logger.error(f"Error during extraction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
