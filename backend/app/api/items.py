from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
import asyncio
import json
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..models import Item
from ..schemas import ItemIn, ItemOut

router = APIRouter(prefix="/items", tags=["items"])


# Simple in-process SSE event manager
class _EventManager:
    def __init__(self) -> None:
        self._listeners: set[asyncio.Queue[str]] = set()

    def subscribe(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        self._listeners.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        self._listeners.discard(q)

    def publish(self, payload: dict) -> None:
        data = json.dumps(payload, separators=(",", ":"))
        stale: list[asyncio.Queue[str]] = []
        for q in list(self._listeners):
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                stale.append(q)
        for q in stale:
            self._listeners.discard(q)


events = _EventManager()

def _item_dict(obj: Item) -> dict:
    return {"id": obj.id, "title": obj.title, "description": obj.description}


@router.get("", response_model=List[ItemOut])
def list_items(
    response: Response,
    q: str | None = Query(None),
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Item)
    if q:
        like = f"%{q}%"
        query = query.filter(Item.title.ilike(like))
    query = query.order_by(Item.id.desc())

    # If pagination parameters are provided, apply them and emit metadata headers
    if (page is not None) or (page_size is not None):
        if page is None or page_size is None:
            raise HTTPException(400, "Both page and page_size must be provided")
        total = query.count()
        offset = (page - 1) * page_size
        items = query.offset(offset).limit(page_size).all()
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page"] = str(page)
        response.headers["X-Page-Size"] = str(page_size)
        return items

    # Default: maintain previous behavior (no pagination applied)
    return query.all()


@router.post("", response_model=ItemOut, status_code=201)
def create_item(payload: ItemIn, db: Session = Depends(get_db)):
    obj = Item(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    try:
        events.publish({"type": "created", "item": _item_dict(obj)})
    except Exception:
        pass
    return obj


@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemIn, db: Session = Depends(get_db)):
    obj = db.get(Item, item_id)
    if not obj:
        raise HTTPException(404, "Not found")
    for k, v in payload.dict().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    try:
        events.publish({"type": "updated", "item": _item_dict(obj)})
    except Exception:
        pass
    return obj


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(Item, item_id)
    if not obj:
        raise HTTPException(404, "Not found")
    db.delete(obj)
    db.commit()
    try:
        events.publish({"type": "deleted", "id": item_id})
    except Exception:
        pass


@router.get("/events")
async def items_events():
    async def event_generator():
        q = events.subscribe()
        try:
            # Initial comment to establish stream
            yield ": connected\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat to keep connections alive through proxies
                    yield ": heartbeat\n\n"
        finally:
            events.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
