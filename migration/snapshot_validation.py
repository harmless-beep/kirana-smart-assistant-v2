"""Pure validation and transformation helpers for PostgreSQL snapshots."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from urllib.parse import urlsplit


COLLECTIONS = {
    "products": "products",
    "categories": "categories",
    "customers": "customers",
    "credit_entries": "credit_entries",
    "sales": "sales",
    "sale_items": "sale_items",
    "notifications": "notifications",
    "settings": "settings",
}
SNAPSHOT_TABLES = ("users", *COLLECTIONS.keys(), "product_images")
OPTIONAL_SOURCE_TABLES = {"product_images"}
# `kirana` is a legacy, empty table (only id/created_at); the exporter checks
# that it stays empty before treating it as schema metadata rather than data.
INTERNAL_SOURCE_TABLES = {"schema_version", "alembic_version", "kirana"}


def validate_source_tables(database_tables):
    actual = set(database_tables)
    unexpected = actual - set(SNAPSHOT_TABLES) - INTERNAL_SOURCE_TABLES
    if unexpected:
        raise ValueError("Database has tables that are not mapped for migration: " + ", ".join(sorted(unexpected)))
    missing = set(SNAPSHOT_TABLES) - actual - OPTIONAL_SOURCE_TABLES
    if missing:
        raise ValueError("Database is missing required application tables: " + ", ".join(sorted(missing)))
    return sorted(actual)


def iso_datetime(value: datetime) -> str:
    """Serialize aware datetimes in UTC for stable Firestore range queries."""
    if value.utcoffset() is not None:
        value = value.astimezone(timezone.utc)
    return value.isoformat()


def normalize_product_image_path(image_path):
    """Drop references to images served by the legacy API on Spark."""
    if not isinstance(image_path, str) or not image_path:
        return image_path, False
    if image_path.lower().startswith("data:"):
        return None, True
    parsed = urlsplit(image_path)
    legacy_api_route = parsed.path.startswith("/api/products/images/")
    legacy_relative_route = (
        not parsed.netloc
        and parsed.path.startswith(("/images/", "/uploads/"))
    )
    legacy_render_route = (
        (parsed.hostname or "").lower().endswith(".onrender.com")
        and parsed.path.startswith(("/images/", "/uploads/"))
    )
    if legacy_api_route or legacy_relative_route or legacy_render_route:
        return None, True
    return image_path, False


def snapshot_digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def verify_snapshot_checksum(raw: bytes, checksum_text: str, filename: str) -> str:
    line = checksum_text.rstrip("\r\n")
    actual = snapshot_digest(raw)
    if (
        len(line) < 67
        or line[:64].lower() != actual
        or line[64:66] not in ("  ", " *")
        or line[66:] != filename
    ):
        raise ValueError("Snapshot checksum is missing, mismatched, or names another file")
    return actual


def validate_snapshot_shape(payload: dict) -> None:
    if payload.get("format") != "kirana-postgres-v1":
        raise ValueError("Unsupported or invalid migration snapshot format")
    source_inventory = payload.get("source_table_inventory")
    if not isinstance(source_inventory, list) or any(not isinstance(name, str) for name in source_inventory):
        raise ValueError("Snapshot is missing its source table inventory")
    if len(source_inventory) != len(set(source_inventory)):
        raise ValueError("Snapshot source table inventory contains duplicates")
    validate_source_tables(source_inventory)
    tables = payload.get("tables")
    if not isinstance(tables, dict):
        raise ValueError("Snapshot is missing its tables map")
    missing_tables = set(SNAPSHOT_TABLES) - set(tables)
    if missing_tables:
        raise ValueError("Snapshot is missing required tables: " + ", ".join(sorted(missing_tables)))
    unexpected_tables = set(tables) - set(SNAPSHOT_TABLES)
    if unexpected_tables:
        raise ValueError("Snapshot contains unmapped tables: " + ", ".join(sorted(unexpected_tables)))
    for table in SNAPSHOT_TABLES:
        rows = tables[table]
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError(f"Snapshot table {table} must be a list of records")
    row_counts = payload.get("row_counts")
    if not isinstance(row_counts, dict):
        raise ValueError("Snapshot row_counts must be an object")
    missing_counts = set(SNAPSHOT_TABLES) - set(row_counts)
    if missing_counts:
        raise ValueError("Snapshot is missing required row counts: " + ", ".join(sorted(missing_counts)))
    unexpected_counts = set(row_counts) - set(SNAPSHOT_TABLES)
    if unexpected_counts:
        raise ValueError("Snapshot contains counts for unmapped tables: " + ", ".join(sorted(unexpected_counts)))
    for table in SNAPSHOT_TABLES:
        count = row_counts[table]
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise ValueError(f"Snapshot row count for {table} must be a non-negative integer")
        if count != len(tables[table]):
            raise ValueError(f"Snapshot row count mismatch for {table}")
    if not tables.get("users"):
        raise ValueError("Refusing to import an empty account snapshot")
    for table in (*COLLECTIONS.keys(), "product_images"):
        ids = [str(row.get("id")) for row in tables[table]]
        if any(value == "None" for value in ids) or len(ids) != len(set(ids)):
            raise ValueError(f"Snapshot table {table} contains missing or duplicate IDs")


def resolve_and_validate_owners(tables: dict) -> dict:
    users = tables.get("users", [])
    products = tables.get("products", [])
    customers = tables.get("customers", [])
    sales = tables.get("sales", [])
    sale_items = tables.get("sale_items", [])
    user_ids = {int(row["id"]) for row in users}
    if len(user_ids) != len(users):
        raise ValueError("Source snapshot contains duplicate account IDs")
    phones = [str(row.get("phone") or "").strip() for row in users]
    if any(not phone for phone in phones):
        raise ValueError("Every legacy account must have a phone number")
    if len(phones) != len(set(phones)):
        raise ValueError("Duplicate phone values prevent safe account mapping")
    for user in users:
        password_hash = str(user.get("password_hash") or "")
        if not password_hash.startswith(("$2a$", "$2b$", "$2y$")):
            raise ValueError(f"Legacy user {user.get('id')} has no supported bcrypt password hash")

    product_owners = {str(row["id"]): int(row["user_id"]) for row in products}
    customer_owners = {str(row["id"]): int(row["user_id"]) for row in customers}
    sale_ids = {str(row["id"]) for row in sales}
    customers_by_id = {str(row["id"]): row for row in customers}
    owners_by_sale = {}
    for item in sale_items:
        sale_id = str(item.get("sale_id"))
        if sale_id not in sale_ids:
            raise ValueError(f"Sale item {item.get('id')} references a missing sale")
        product_id = item.get("product_id")
        owner = product_owners.get(str(product_id)) if product_id is not None else None
        if product_id is not None and owner is None:
            raise ValueError(f"Sale item {item.get('id')} references a missing product")
        if owner is not None:
            owners_by_sale.setdefault(sale_id, set()).add(owner)

    for sale in sales:
        customer_id = sale.get("customer_id")
        customer_owner = customer_owners.get(str(customer_id)) if customer_id is not None else None
        if customer_id is not None and customer_owner is None:
            raise ValueError(f"Sale {sale['id']} references a missing customer")
        if customer_owner is not None:
            customer = customers_by_id[str(customer_id)]
            sale.setdefault("customer_name", customer.get("name"))
            sale.setdefault("customer_phone", customer.get("phone"))
        if sale.get("user_id") is None:
            candidates = set(owners_by_sale.get(str(sale["id"]), set()))
            if customer_owner is not None:
                candidates.add(customer_owner)
            if len(candidates) != 1:
                raise ValueError(f"Cannot safely determine owner for legacy sale {sale['id']}; old data remains untouched")
            sale["user_id"] = candidates.pop()

    sale_owners = {str(row["id"]): int(row["user_id"]) for row in sales}
    for table in COLLECTIONS:
        for row in tables.get(table, []):
            owner_id = row.get("user_id")
            if owner_id is None and table == "credit_entries":
                owner_id = customer_owners.get(str(row.get("customer_id")))
                if owner_id is None:
                    raise ValueError(f"Credit entry {row.get('id')} references a missing customer")
            elif owner_id is None and table == "sale_items":
                owner_id = sale_owners.get(str(row.get("sale_id")))
            if owner_id is None or int(owner_id) not in user_ids:
                raise ValueError(f"Cannot determine a valid owner for {table} row {row.get('id')}")
            if table == "credit_entries" and customer_owners.get(str(row.get("customer_id"))) != int(owner_id):
                raise ValueError(f"Credit entry {row.get('id')} references a customer from another shop")
            if table == "sales" and row.get("customer_id") is not None:
                if customer_owners.get(str(row["customer_id"])) != int(owner_id):
                    raise ValueError(f"Sale {row.get('id')} references a customer from another shop")
            if table == "sale_items" and row.get("product_id") is not None:
                if product_owners.get(str(row["product_id"])) != int(owner_id):
                    raise ValueError(f"Sale item {row.get('id')} references a product from another shop")
    return {"users": users, "user_ids": user_ids, "product_owners": product_owners,
            "customer_owners": customer_owners, "sale_owners": sale_owners}
