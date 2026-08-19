import os
from pathlib import Path

# Limits
MAX_FILES = 20
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
MAX_TOTAL_SIZE = 500 * 1024 * 1024  # 500MB
MAX_PDF_PAGES = 1000

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BASE_DIR / "temp"
TEMP_DIR.mkdir(exist_ok=True)

# Cleanup
TEMP_RETENTION_SECONDS = 3600

# CORS：生产环境用 Nginx 同域反代时可不改；若前后端分域名，设置环境变量
# CORS_ORIGINS=https://your-domain.com,http://your-ip
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", ",".join(_default_origins)).split(",")
    if o.strip()
]
