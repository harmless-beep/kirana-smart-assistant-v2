"""Standard-library tests for migration snapshot integrity checks."""

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from datetime import datetime, timedelta, timezone

from snapshot_validation import (
    SNAPSHOT_TABLES,
    iso_datetime,
    normalize_product_image_path,
    resolve_and_validate_owners,
    snapshot_digest,
    validate_snapshot_shape,
    validate_source_tables,
    verify_snapshot_checksum,
)


def valid_tables():
    return {
        "users": [{"id": 1, "phone": "9800000000", "password_hash": "$2b$12$example"}],
        "products": [{"id": 3, "user_id": 1, "barcode": "123"}],
        "categories": [],
        "customers": [{"id": 4, "user_id": 1}],
        "credit_entries": [{"id": 8, "customer_id": 4, "amount": 20, "remaining": 20}],
        "sales": [{"id": 5, "user_id": None, "customer_id": 4}],
        "sale_items": [{"id": 6, "sale_id": 5, "product_id": 3}],
        "notifications": [],
        "settings": [],
        "product_images": [{"id": 9, "data": {"__bytes_b64": "AA=="}}],
    }


def snapshot_payload(tables=None, row_counts=None):
    tables = valid_tables() if tables is None else tables
    counts = {table: len(tables[table]) for table in SNAPSHOT_TABLES}
    if row_counts:
        counts.update(row_counts)
    return {
        "format": "kirana-postgres-v1",
        "source_table_inventory": list(SNAPSHOT_TABLES),
        "tables": tables,
        "row_counts": counts,
    }


class SnapshotValidationTests(unittest.TestCase):
    def test_valid_snapshot_infers_legacy_sale_owner(self):
        tables = valid_tables()
        validate_snapshot_shape(snapshot_payload(tables))
        result = resolve_and_validate_owners(tables)
        self.assertEqual(result["sale_owners"]["5"], 1)
        self.assertEqual(tables["sales"][0]["user_id"], 1)

    def test_rejects_empty_account_snapshot(self):
        with self.assertRaisesRegex(ValueError, "empty account"):
            tables = valid_tables()
            tables["users"] = []
            validate_snapshot_shape(snapshot_payload(tables))

    def test_rejects_duplicate_ids(self):
        tables = valid_tables()
        tables["products"].append({"id": 3, "user_id": 1})
        with self.assertRaisesRegex(ValueError, "duplicate IDs"):
            validate_snapshot_shape(snapshot_payload(tables))

    def test_rejects_duplicate_product_image_ids(self):
        tables = valid_tables()
        tables["product_images"].append({"id": 9, "data": {"__bytes_b64": "AQ=="}})
        with self.assertRaisesRegex(ValueError, "product_images.*duplicate IDs"):
            validate_snapshot_shape(snapshot_payload(tables))

    def test_rejects_snapshot_row_count_mismatch(self):
        with self.assertRaisesRegex(ValueError, "row count mismatch"):
            validate_snapshot_shape({
                "format": "kirana-postgres-v1",
                "source_table_inventory": list(SNAPSHOT_TABLES),
                "tables": valid_tables(),
                "row_counts": {**snapshot_payload()["row_counts"], "products": 2},
            })

    def test_rejects_missing_source_inventory(self):
        payload = snapshot_payload()
        del payload["source_table_inventory"]
        with self.assertRaisesRegex(ValueError, "source table inventory"):
            validate_snapshot_shape(payload)

    def test_rejects_unmapped_source_inventory_table(self):
        payload = snapshot_payload()
        payload["source_table_inventory"].append("audit_log")
        with self.assertRaisesRegex(ValueError, "not mapped for migration"):
            validate_snapshot_shape(payload)

    def test_accepts_known_empty_legacy_kirana_table_in_inventory(self):
        payload = snapshot_payload()
        payload["source_table_inventory"].append("kirana")
        validate_snapshot_shape(payload)

    def test_rejects_missing_source_table(self):
        tables = valid_tables()
        counts = {table: len(tables[table]) for table in SNAPSHOT_TABLES}
        del tables["notifications"]
        with self.assertRaisesRegex(ValueError, "missing required tables"):
            validate_snapshot_shape({
                "format": "kirana-postgres-v1",
                "source_table_inventory": list(SNAPSHOT_TABLES),
                "tables": tables,
                "row_counts": counts,
            })

    def test_rejects_missing_row_count(self):
        counts = snapshot_payload()["row_counts"]
        del counts["settings"]
        with self.assertRaisesRegex(ValueError, "missing required row counts"):
            validate_snapshot_shape({
                "format": "kirana-postgres-v1",
                "source_table_inventory": list(SNAPSHOT_TABLES),
                "tables": valid_tables(),
                "row_counts": counts,
            })

    def test_rejects_snapshot_table_that_is_not_mapped(self):
        tables = valid_tables()
        tables["audit_log"] = []
        with self.assertRaisesRegex(ValueError, "unmapped tables"):
            validate_snapshot_shape(snapshot_payload(tables))

    def test_rejects_count_for_table_that_is_not_mapped(self):
        payload = snapshot_payload()
        payload["row_counts"]["audit_log"] = 0
        with self.assertRaisesRegex(ValueError, "counts for unmapped tables"):
            validate_snapshot_shape(payload)

    def test_accepts_known_source_tables_and_internal_schema_table(self):
        inventory = validate_source_tables((*SNAPSHOT_TABLES, "schema_version"))
        self.assertIn("schema_version", inventory)

    def test_rejects_unmapped_live_database_table(self):
        with self.assertRaisesRegex(ValueError, "not mapped for migration"):
            validate_source_tables((*SNAPSHOT_TABLES, "audit_log"))

    def test_rejects_missing_required_live_database_table(self):
        with self.assertRaisesRegex(ValueError, "missing required application tables"):
            validate_source_tables(set(SNAPSHOT_TABLES) - {"sales"})

    def test_rejects_duplicate_phone_numbers(self):
        tables = valid_tables()
        tables["users"].append({"id": 2, "phone": "9800000000", "password_hash": "$2b$12$example"})
        tables["sales"] = []
        with self.assertRaisesRegex(ValueError, "Duplicate phone"):
            resolve_and_validate_owners(tables)

    def test_rejects_orphaned_credit_entry(self):
        tables = valid_tables()
        tables["credit_entries"][0]["customer_id"] = 999
        with self.assertRaisesRegex(ValueError, "missing customer"):
            resolve_and_validate_owners(tables)

    def test_rejects_ambiguous_owner_for_legacy_sale(self):
        tables = valid_tables()
        tables["users"].append({"id": 2, "phone": "9800000001", "password_hash": "$2b$12$example"})
        tables["products"].append({"id": 7, "user_id": 2})
        tables["sale_items"].append({"id": 11, "sale_id": 5, "product_id": 7})
        with self.assertRaisesRegex(ValueError, "Cannot safely determine owner"):
            resolve_and_validate_owners(tables)

    def test_rejects_sale_linked_to_another_shops_customer(self):
        tables = valid_tables()
        tables["users"].append({"id": 2, "phone": "9800000001", "password_hash": "$2b$12$example"})
        tables["sales"][0]["user_id"] = 2
        with self.assertRaisesRegex(ValueError, "customer from another shop"):
            resolve_and_validate_owners(tables)

    def test_removes_legacy_render_image_api_paths(self):
        self.assertEqual(
            normalize_product_image_path("/api/products/images/42"),
            (None, True),
        )
        self.assertEqual(
            normalize_product_image_path("data:image/png;base64,AA=="),
            (None, True),
        )

    def test_preserves_external_product_image_url(self):
        path = "https://cdn.example.test/products/rice.png"
        self.assertEqual(normalize_product_image_path(path), (path, False))

    def test_verifies_snapshot_checksum_and_filename(self):
        raw = b'{"format":"kirana-postgres-v1"}'
        checksum = f"{snapshot_digest(raw)}  my snapshot.json\n"
        self.assertEqual(verify_snapshot_checksum(raw, checksum, "my snapshot.json"), snapshot_digest(raw))
        with self.assertRaisesRegex(ValueError, "checksum"):
            verify_snapshot_checksum(raw + b" ", checksum, "my snapshot.json")
        with self.assertRaisesRegex(ValueError, "checksum"):
            verify_snapshot_checksum(raw, checksum, "renamed.json")

    def test_normalizes_aware_datetimes_to_utc(self):
        kathmandu = timezone(timedelta(hours=5, minutes=45))
        value = datetime(2025, 1, 1, 0, 0, tzinfo=kathmandu)
        self.assertEqual(iso_datetime(value), "2024-12-31T18:15:00+00:00")

    def test_preserves_naive_datetime_representation(self):
        value = datetime(2025, 1, 1, 0, 0)
        self.assertEqual(iso_datetime(value), "2025-01-01T00:00:00")


if __name__ == "__main__":
    unittest.main()
