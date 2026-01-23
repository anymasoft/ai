from fastapi import FastAPI, Request, HTTPException, Depends, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
from pydantic import BaseModel
import os
from auth import router as auth_router, get_current_user
from database import init_db, get_user_by_email, add_lead, get_leads
from gpt import analyze_lead_text
from onboarding import save_user_onboarding, get_niche_recommendations
from bot_runner import start_listener

app = FastAPI(title="LeadSensei")

app.mount("/static", StaticFiles(directory="../static"), name="static")
app.include_router(auth_router, prefix="/auth")

@app.on_event("startup")
def startup_event():
    init_db()
    start_listener()

@app.get("/")
def read_index():
    return FileResponse("../frontend/index.html")

@app.get("/{path}")
def read_page(path: str):
    file_path = f"../frontend/{path}"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404)

@app.post("/api/lead")
async def receive_lead(request: Request):
    data = await request.json()
    analysis = await analyze_lead_text(data['text'])
    if analysis['is_lead'] and analysis['confidence'] > 0.6:
        add_lead(data['user_id'], data, analysis)
    return {"status": "processed"}

@app.post("/api/onboarding")
async def save_onboarding(request: Request, user = Depends(get_current_user)):
    data = await request.json()
    save_user_onboarding(user['id'], data['niche'])
    return {"status": "saved"}

@app.get("/api/recommendations")
async def get_recommendations(user = Depends(get_current_user)):
    return get_niche_recommendations("freelance")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)