import argparse
import random
from typing import List

from .db import Base, engine, SessionLocal
from .models import Item


TITLES = [
    "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
    "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
    "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey",
    "X-ray", "Yankee", "Zulu",
]

DESCS = [
    "Quick brown fox jumps over the lazy dog.",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Batteries included; some assembly required.",
    "This is just sample seed data for testing.",
    "Highly scalable, blazing fast, and developer friendly.",
    "Edge cases included for pagination and search.",
]


def make_items(n: int, start_index: int = 1) -> List[Item]:
    items: List[Item] = []
    for i in range(n):
        idx = start_index + i
        title = f"Item {idx:03d} - {random.choice(TITLES)}"
        desc = random.choice(DESCS)
        items.append(Item(title=title, description=desc))
    return items


def seed(count: int = 200, reset: bool = False) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if reset:
            db.query(Item).delete()
            db.commit()

        existing = db.query(Item).count()
        to_create = max(0, count - existing)
        if to_create == 0:
            return
        objs = make_items(to_create, start_index=existing + 1)
        db.bulk_save_objects(objs)
        db.commit()
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the database with items")
    parser.add_argument("--count", type=int, default=200, help="Total number of items desired")
    parser.add_argument(
        "--reset", action="store_true", help="Delete existing items before seeding"
    )
    args = parser.parse_args()
    seed(count=args.count, reset=args.reset)


if __name__ == "__main__":
    main()

