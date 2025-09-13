from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..models import Item
from ..schemas import ItemIn, ItemOut

router = APIRouter(prefix="/items", tags=["items"])


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
    return obj


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(Item, item_id)
    if not obj:
        raise HTTPException(404, "Not found")
    db.delete(obj)
    db.commit()
