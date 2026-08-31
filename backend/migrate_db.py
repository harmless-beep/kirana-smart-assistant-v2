"""
Copy every table from one database to another, preserving ids so foreign
keys (sales -> products, khata entries -> customers, sale_items -> sales)
stay intact.

Typical use: move the app off Render's free Postgres (deleted after 90 days)
onto Supabase's free tier, which never expires.

Usage:
    SRC_DATABASE_URL=<render-connection-string> \\
    DST_DATABASE_URL=<supabase-connection-string> \\
    python migrate_db.py

The destination tables are created automatically. Rows are copied in
dependency order, then auto-increment sequences are reset so new inserts
never collide with copied ids. Copying an already-populated table is
skipped (safe to run more than once).

Works with PostgreSQL on both ends; the sequence reset is skipped on
SQLite so the script can also be tested locally.
"""

import os
import sys

from sqlalchemy import MetaData, Table, create_engine, select, text

# Import the app models so Base.metadata knows every table, including the
# newer ones (product_images) that may not exist in the source yet.
import models.models  # noqa: F401
from database import Base

# Dependency order matters: parents before children.
TABLES_IN_ORDER = [
    "users",
    "categories",
    "customers",
    "products",
    "credit_entries",
    "sales",
    "sale_items",
    "notifications",
    "settings",
    "product_images",
]


def table_columns(engine, table_name):
    meta = MetaData()
    table = Table(table_name, meta, autoload_with=engine)
    return table, [column.name for column in table.columns]


def copy_table(engine_src, engine_dst, table_name):
    src_table, src_columns = table_columns(engine_src, table_name)
    dst_table, dst_columns = table_columns(engine_dst, table_name)
    common = [name for name in src_columns if name in dst_columns]

    with engine_dst.connect() as conn:
        existing = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar()
    if existing:
        print(f"  - {table_name}: already has {existing} rows, skipping copy")
        return

    with engine_src.connect() as conn:
        rows = conn.execute(select(src_table)).mappings().all()
    if not rows:
        print(f"  - {table_name}: 0 rows")
        return

    if not common:
        print(f"  - {table_name}: no common columns, skipping")
        return

    payload = [{name: row[name] for name in common} for row in rows]
    # Insert in batches to stay friendly with remote connection limits.
    with engine_dst.begin() as conn:
        for i in range(0, len(payload), 500):
            conn.execute(dst_table.insert(), payload[i:i + 500])
    print(f"  - {table_name}: copied {len(rows)} rows ({len(common)} columns)")


def reset_sequences(engine, table_name):
    """Bump serial sequences so new inserts don't collide with copied ids."""
    if engine.dialect.name != "postgresql":
        return
    with engine.connect() as conn:
        sequence = conn.execute(
            text(f"SELECT pg_get_serial_sequence('{table_name}', 'id')")
        ).scalar()
    if not sequence:
        return
    with engine.begin() as conn:
        conn.execute(text(
            f"SELECT setval('{sequence}', COALESCE((SELECT MAX(id) FROM \"{table_name}\"), 1))"
        ))
    print(f"  - {table_name}: sequence reset")


def main():
    src_url = os.environ.get("SRC_DATABASE_URL")
    dst_url = os.environ.get("DST_DATABASE_URL")
    if not src_url or not dst_url:
        print("Set SRC_DATABASE_URL and DST_DATABASE_URL and try again.")
        sys.exit(1)

    engine_src = create_engine(src_url)
    engine_dst = create_engine(dst_url)

    # Create missing tables on the destination (only new tables are added;
    # existing ones are left untouched).
    Base.metadata.create_all(bind=engine_dst)

    print(f"Copying data from {engine_src.url.host or 'local'} to {engine_dst.url.host or 'local'}")
    for table_name in TABLES_IN_ORDER:
        try:
            copy_table(engine_src, engine_dst, table_name)
        except Exception as exc:  # noqa: BLE001 - report and keep going
            print(f"  - {table_name}: ERROR {exc}")
            continue
        try:
            reset_sequences(engine_dst, table_name)
        except Exception as exc:  # noqa: BLE001
            print(f"  - {table_name}: sequence reset failed: {exc}")

    print("Done. Point DATABASE_URL at the destination and redeploy.")


if __name__ == "__main__":
    main()
