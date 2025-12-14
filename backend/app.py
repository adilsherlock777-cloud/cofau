"""
ASGI entry point for PM2.
This file imports the FastAPI app from server.py to maintain compatibility
with PM2 configuration that expects app:app.
"""
from server import app

__all__ = ["app"]

