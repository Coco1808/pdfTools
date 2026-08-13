from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import compress, health, images, invoice, merge, naming, replace, split, textable, toc, watermark
from app.config import CORS_ORIGINS, TEMP_DIR
from app.utils.cleanup import cleanup_temp_files


@asynccontextmanager
async def lifespan(_app: FastAPI):
    TEMP_DIR.mkdir(exist_ok=True)
    cleanup_temp_files()
    yield
    cleanup_temp_files()


app = FastAPI(
    title="PDF Tools API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(health.router)
app.include_router(merge.router)
app.include_router(invoice.router)
app.include_router(replace.router)
app.include_router(textable.router)
app.include_router(toc.router)
app.include_router(split.router)
app.include_router(compress.router)
app.include_router(watermark.router)
app.include_router(images.router)
app.include_router(naming.router)
