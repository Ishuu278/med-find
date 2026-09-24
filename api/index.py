import sys
import os

# Add root directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, ensure_db_exists

# Ensure database is created on cold start
ensure_db_exists()

# Entrypoint for Vercel Serverless Function
app_entry = app
