from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import asyncio
import logging

from crawler import Crawler

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

class ContactResult(BaseModel):
    website: str
    emails: List[str]
    phones: List[str]
    sources: List[str]

class ExtractResponse(BaseModel):
    results: List[ContactResult]
    total: int

@app.post("/api/extract", response_model=ExtractResponse)
async def extract_contacts(request: ExtractRequest):
    """
    Извлечь контакты из списка URL.
    """
    if not request.urls:
        raise HTTPException(status_code=400, detail="URLs list cannot be empty")

    # Очистить и валидировать URLs
    urls = [url.strip() for url in request.urls if url.strip()]
    if not urls:
        raise HTTPException(status_code=400, detail="No valid URLs provided")

    crawler = Crawler()
    results = []

    try:
        # Краулим все URL параллельно
        tasks = [crawler.crawl(url) for url in urls]
        all_results = await asyncio.gather(*tasks)

        for url, crawl_result in zip(urls, all_results):
            # Нормализуем URL для отображения
            display_url = url if url.startswith(('http://', 'https://')) else f'https://{url}'

            result = ContactResult(
                website=display_url,
                emails=crawl_result['emails'][:5],
                phones=crawl_result['phones'][:3],
                sources=crawl_result['sources']
            )
            results.append(result)

        return ExtractResponse(
            results=results,
            total=len(results)
        )

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
