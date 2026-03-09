import httpx
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json
from ..models.schema import ExternalSchemaCache

async def fetch_and_cache_external_schema(db: Session, url: str, force_refresh: bool = False) -> dict:
    """
    Fetches an external schema and caches it in the database.
    If force_refresh is False, it will use the cached version if available.
    Returns the parsed JSON schema.
    """
    # Check cache first
    if not force_refresh:
        cached = db.query(ExternalSchemaCache).filter(ExternalSchemaCache.url == url).first()
        if cached:
            return cached.content

    # If no cache or force refresh, fetch from network
    headers = {'Accept': 'application/json'}
    cached = db.query(ExternalSchemaCache).filter(ExternalSchemaCache.url == url).first()
    
    # Use ETag if we have one to save bandwidth
    if cached and cached.etag:
        headers['If-None-Match'] = cached.etag

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=10.0)
            
            if response.status_code == 304 and cached:
                # Not modified, update timestamp
                cached.last_fetched = datetime.now(timezone.utc)
                db.commit()
                return cached.content
                
            if response.status_code == 200:
                content = response.json()
                etag = response.headers.get("etag")
                
                if cached:
                    cached.content = content
                    cached.etag = etag
                    cached.last_fetched = datetime.now(timezone.utc)
                else:
                    new_cache = ExternalSchemaCache(
                        url=url,
                        content=content,
                        etag=etag
                    )
                    db.add(new_cache)
                
                db.commit()
                return content
            else:
                raise ValueError(f"Failed to fetch schema from {url}: HTTP {response.status_code}")
                
        except Exception as e:
            # Fallback to cache if network fails during refresh
            if cached:
                return cached.content
            raise e
