from pydantic import BaseModel

class ItemIn(BaseModel):
    title: str
    description: str = ""

class ItemOut(ItemIn):
    id: int
    class Config:
        from_attributes = True  # Pydantic v2 compat
