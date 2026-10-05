"""Export every Kirana PostgreSQL table to a private JSON migration snapshot.

Usage (PowerShell):
  $env:DATABASE_URL = '<Render external PostgreSQL URL>'
  python migration/export_postgres.py C:/secure/path/kirana-snapshot.json

The URL and row contents are never printed. Keep the snapshot outside Git: it
contains customer records, password hashes, and product image bytes.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import tempfile
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor
from snapshot_validation import iso_datetime, validate_source_tables

TABLES = (
    "users",
    "products",
    "categories",
    "customers",
    "credit_entries",
    "sales",
    "sale_items",
    "notifications",
    "settings",
    "product_images",
)


def encode(value):
    if isinstance(value, datetime):
        return iso_datetime(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"__bytes_b64": base64.b64encode(bytes(value)).decode("ascii")}
    return value


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Set DATABASE_URL in this shell, then retry.", file=sys.stderr)
        return 2
    if len(sys.argv) != 2:
        print("Usage: python migration/export_postgres.py <private-output.json>", file=sys.stderr)
        return 2

    output = Path(sys.argv[1]).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    snapshot = {
        "format": "kirana-postgres-v1",
        "tables": {},
        "row_counts": {},
        "table_columns": {},
    }

    # Export inside a read-only repeatable-read transaction so rows and counts
    # represent one consistent point in time without changing the old DB.
    with psycopg2.connect(database_url, connect_timeout=30) as connection:
        connection.set_session(readonly=True, isolation_level="REPEATABLE READ")
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), CURRENT_TIMESTAMP")
            database_name, captured_at = cursor.fetchone()
            cursor.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
            )
            source_tables = validate_source_tables(row[0] for row in cursor.fetchall())
            if "kirana" in source_tables:
                cursor.execute('SELECT count(*) FROM public."kirana"')
                if cursor.fetchone()[0] != 0:
                    raise ValueError("The legacy kirana table is no longer empty; map its rows before exporting")
            snapshot["source_database"] = database_name
            snapshot["captured_at"] = captured_at.isoformat()
            snapshot["source_table_inventory"] = source_tables
        for table in TABLES:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT to_regclass(%s)", (f"public.{table}",))
                if cursor.fetchone()["to_regclass"] is None:
                    snapshot["tables"][table] = []
                    snapshot["row_counts"][table] = 0
                    snapshot["table_columns"][table] = []
                    continue
                cursor.execute(f'SELECT * FROM public."{table}" ORDER BY 1')
                rows = [{key: encode(value) for key, value in row.items()} for row in cursor.fetchall()]
                snapshot["table_columns"][table] = list(rows[0]) if rows else [description.name for description in cursor.description]
            snapshot["tables"][table] = rows
            snapshot["row_counts"][table] = len(rows)

    output.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output.parent,
                                         prefix=f".{output.name}.", suffix=".tmp",
                                         delete=False) as handle:
            temp_name = handle.name
            json.dump(snapshot, handle, ensure_ascii=False, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, output)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    checksum_path = output.with_suffix(output.suffix + ".sha256")
    checksum_path.write_text(f"{digest}  {output.name}\n", encoding="ascii")
    print(f"Snapshot written: {output}")
    print("Row counts: " + json.dumps(snapshot["row_counts"], sort_keys=True))
    print(f"SHA-256: {digest}")
    print("Keep both files private and outside the repository.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
