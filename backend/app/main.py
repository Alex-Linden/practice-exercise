from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine
from .api.items import router as items_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LetterAI Pair Exercise")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

app.include_router(items_router)

@app.get("/healthz")
def healthz(): return {"ok": True}
