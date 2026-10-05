"""Import a PostgreSQL snapshot into Firebase Auth and Firestore.

Requires a temporary Firebase service-account key via
GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_PROJECT_ID. Never commit that key
or the JSON snapshot. Run --dry-run before the first actual import.

Usage:
  python migration/import_firebase.py C:/secure/path/kirana-snapshot.json --dry-run
  python migration/import_firebase.py C:/secure/path/kirana-snapshot.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote

import firebase_admin
from firebase_admin import auth, credentials, firestore
from snapshot_validation import (
    COLLECTIONS,
    normalize_product_image_path,
    resolve_and_validate_owners,
    validate_snapshot_shape,
    verify_snapshot_checksum,
)


def legacy_uid(user_id) -> str:
    return f"kirana_{int(user_id)}"


def login_email(phone: str) -> str:
    digest = hashlib.sha256(phone.encode("utf-8")).hexdigest()
    return f"phone-{digest}@login.kirana-smart.invalid"


def firestore_value(value):
    if isinstance(value, dict):
        if set(value) == {"__bytes_b64"}:
            return None
        return {key: firestore_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [firestore_value(item) for item in value]
    return value


def read_snapshot(path: Path):
    raw = path.read_bytes()
    checksum_path = path.with_suffix(path.suffix + ".sha256")
    if not checksum_path.is_file():
        raise ValueError(f"Snapshot checksum file is missing: {checksum_path.name}")
    checksum = verify_snapshot_checksum(
        raw,
        checksum_path.read_text(encoding="ascii"),
        path.name,
    )
    payload = json.loads(raw.decode("utf-8"))
    validate_snapshot_shape(payload)
    return payload, checksum


def validate(snapshot, db, project_id: str, snapshot_id: str):
    relationships = resolve_and_validate_owners(snapshot["tables"])
    users = relationships["users"]
    user_ids = relationships["user_ids"]
    product_owners = relationships["product_owners"]
    customer_owners = relationships["customer_owners"]
    sale_owners = relationships["sale_owners"]
    customers_by_id = {
        str(customer["id"]): customer
        for customer in snapshot["tables"].get("customers", [])
    }

    for table in COLLECTIONS:
        for row in snapshot["tables"].get(table, []):
            owner_id = row.get("user_id")
            if owner_id is None and table == "credit_entries":
                owner_id = customer_owners.get(str(row.get("customer_id")))
            elif owner_id is None and table == "sale_items":
                owner_id = sale_owners.get(str(row.get("sale_id")))
            if owner_id is not None and int(owner_id) not in user_ids:
                raise ValueError(f"{table} row {row.get('id')} references unknown user_id")
            if owner_id is None:
                raise ValueError(f"Cannot determine owner for {table} row {row.get('id')}")
            if table == "credit_entries" and customer_owners.get(str(row.get("customer_id"))) != int(owner_id):
                raise ValueError(f"Credit entry {row.get('id')} references a customer from another shop")
            if table == "sales" and row.get("customer_id") is not None:
                if customer_owners.get(str(row["customer_id"])) != int(owner_id):
                    raise ValueError(f"Sale {row.get('id')} references a customer from another shop")
            if table == "sale_items" and row.get("product_id") is not None:
                if product_owners.get(str(row["product_id"])) != int(owner_id):
                    raise ValueError(f"Sale item {row.get('id')} references a product from another shop")

    seen_uids = set()
    seen_emails = set()
    for user in users:
        uid = legacy_uid(user["id"])
        email = login_email(str(user["phone"]).strip())
        if uid in seen_uids or email in seen_emails:
            raise ValueError("Account UID/email collision in source snapshot")
        seen_uids.add(uid)
        seen_emails.add(email)
        try:
            existing = auth.get_user(uid)
            if existing.email != email:
                raise ValueError(f"Firebase UID collision for legacy user {user['id']}")
        except auth.UserNotFoundError:
            try:
                existing = auth.get_user_by_email(email)
                if existing.uid != uid:
                    raise ValueError(f"Firebase email collision for legacy user {user['id']}")
            except auth.UserNotFoundError:
                pass
        profile_ref = db.collection("profiles").document(uid)
        profile = profile_ref.get()
        if profile.exists and profile.to_dict().get("migration_snapshot") != snapshot_id:
            raise ValueError(f"Refusing to overwrite existing Firebase profile {uid}")

    # All writes fit Firestore's document-size cap; image bytes are deliberately
    # retained only in the private PostgreSQL snapshot on the Spark plan.
    documents = []
    for table, collection_name in COLLECTIONS.items():
        for row in snapshot["tables"].get(table, []):
            owner_id = row.get("user_id")
            if owner_id is None and table == "credit_entries":
                owner_id = customer_owners.get(str(row.get("customer_id")))
            elif owner_id is None and table == "sale_items":
                owner_id = sale_owners.get(str(row.get("sale_id")))
            if owner_id is None:
                raise ValueError(f"{table} row {row.get('id')} has no owner")
            uid = legacy_uid(owner_id)
            doc_id = str(row["id"])
            ref = db.collection("users").document(uid).collection(collection_name).document(doc_id)
            existing = ref.get()
            should_write = True
            if existing.exists:
                if existing.to_dict().get("migration_snapshot") != snapshot_id:
                    raise ValueError(f"Refusing to overwrite existing Firebase document {uid}/{collection_name}/{doc_id}")
                # Resume after interruption without replacing any document that
                # may already have been edited in the live app.
                should_write = False
            data = firestore_value(row)
            data["legacy_user_id"] = data.get("user_id")
            data["user_id"] = uid
            if table == "products":
                data["legacy_user_id"] = int(owner_id)
            if table == "products":
                image_path = data.get("image_path") or ""
                data["image_path"], image_removed = normalize_product_image_path(image_path)
                if image_removed:
                    data["image_sync"] = "kept_in_legacy_database"
            if table == "sales" and isinstance(data.get("items"), list):
                # The normal adapter expects item snapshots on sale documents;
                # also write the canonical sale_items collection below.
                data["items"] = [firestore_value(item) for item in data["items"]]
            if table == "sales" and data.get("customer_id") is not None:
                customer = customers_by_id.get(str(data["customer_id"]))
                if customer:
                    data["customer_name"] = customer.get("name")
                    data["customer_phone"] = customer.get("phone")
                else:
                    data["customer_name"] = None
                    data["customer_phone"] = None
            data["migration_snapshot"] = snapshot_id
            encoded_size = len(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
            if encoded_size > 850_000:
                raise ValueError(f"Document {uid}/{collection_name}/{doc_id} is too large for safe Firestore import")
            documents.append((ref, data, should_write))

    barcode_owner_keys = set()
    for product in snapshot["tables"].get("products", []):
        barcode_value = str(product.get("barcode") or "")
        if not barcode_value:
            continue
        uid = legacy_uid(product["user_id"])
        barcode_doc_id = quote(barcode_value, safe="-_.!~*'()")
        unique_key = (uid, barcode_doc_id)
        if unique_key in barcode_owner_keys:
            raise ValueError(f"Duplicate barcode within shop for product {product['id']}")
        barcode_owner_keys.add(unique_key)
        ref = db.collection("users").document(uid).collection("barcodes").document(barcode_doc_id)
        existing = ref.get()
        should_write = True
        if existing.exists:
            saved = existing.to_dict()
            if saved.get("migration_snapshot") != snapshot_id or str(saved.get("product_id")) != str(product["id"]):
                raise ValueError(f"Refusing to overwrite barcode reservation for product {product['id']}")
            should_write = False
        documents.append((ref, {
            "barcode": barcode_value,
            "product_id": int(product["id"]),
            "user_id": uid,
            "legacy_user_id": int(product["user_id"]),
            "migration_snapshot": snapshot_id,
        }, should_write))

    image_rows = snapshot["tables"].get("product_images", [])
    return users, documents, image_rows


def import_auth(users):
    pending = []
    for user in users:
        uid = legacy_uid(user["id"])
        email = login_email(str(user["phone"]).strip())
        try:
            existing = auth.get_user(uid)
            if existing.email == email:
                continue
            raise ValueError(f"Firebase UID collision for legacy user {user['id']}")
        except auth.UserNotFoundError:
            pass
        password_hash = user.get("password_hash")
        if not password_hash or not str(password_hash).startswith(("$2a$", "$2b$", "$2y$")):
            raise ValueError(f"Legacy user {user['id']} does not have a supported bcrypt hash")
        pending.append(auth.ImportUserRecord(
            uid=uid,
            email=email,
            display_name=str(user.get("name") or "Kirana owner"),
            password_hash=str(password_hash).encode("utf-8"),
        ))

    for start in range(0, len(pending), 1000):
        result = auth.import_users(pending[start:start + 1000], hash_alg=auth.UserImportHash.bcrypt())
        if result.failure_count:
            reasons = ", ".join(error.reason for error in result.errors[:5])
            raise RuntimeError(f"Firebase Auth imported {result.success_count}; {result.failure_count} failed: {reasons}")


def verify_import(db, users, documents, snapshot_id):
    expected = {}
    expected_documents = {}
    for user in users:
        expected[legacy_uid(user["id"])] = {
            "profile": 1,
            "counts": {name: 0 for name in {*COLLECTIONS.values(), "barcodes"}},
            "stock": 0,
            "sales": 0.0,
            "profit": 0.0,
            "credit": 0.0,
        }
    for ref, data, _should_write in documents:
        expected_documents[(ref.parent.parent.id, ref.parent.id, ref.id)] = data
        uid = ref.parent.parent.id
        group = expected[uid]
        group["counts"][ref.parent.id] += 1
        if ref.parent.id == "products":
            group["stock"] += int(data.get("quantity") or 0)
        elif ref.parent.id == "sales":
            group["sales"] += float(data.get("total_amount") or 0)
            group["profit"] += float(data.get("profit") or 0)
        elif ref.parent.id == "credit_entries" and data.get("entry_type") == "credit":
            group["credit"] += float(data.get("remaining") or 0)

    for uid, expected_group in expected.items():
        user = next(row for row in users if legacy_uid(row["id"]) == uid)
        imported_auth = auth.get_user(uid)
        if imported_auth.email != login_email(str(user["phone"]).strip()):
            raise RuntimeError(f"Authentication email verification failed for migrated account {uid}")
        profile = db.collection("profiles").document(uid).get()
        expected_profile = {
            key: firestore_value(value)
            for key, value in user.items()
            if key != "password_hash"
        }
        expected_profile["legacy_user_id"] = int(expected_profile.pop("id"))
        expected_profile["id"] = uid
        expected_profile["migration_snapshot"] = snapshot_id
        if not profile.exists or profile.to_dict() != expected_profile:
            raise RuntimeError(f"Profile verification failed for migrated account {uid}")
        for name, expected_count in expected_group["counts"].items():
            actual = list(db.collection("users").document(uid).collection(name).stream())
            actual_count = len(actual)
            if actual_count != expected_count:
                raise RuntimeError(f"Count mismatch for {uid}/{name}: expected {expected_count}, got {actual_count}")
            expected_ids = {
                ref.id for ref, _data, _write in documents
                if ref.parent.parent.id == uid and ref.parent.id == name
            }
            actual_ids = {item.id for item in actual}
            if actual_ids != expected_ids:
                raise RuntimeError(f"Document ID mismatch for {uid}/{name}")
            if any(item.to_dict().get("migration_snapshot") != snapshot_id for item in actual):
                raise RuntimeError(f"Snapshot marker mismatch in {uid}/{name}")
            for item in actual:
                expected_record = expected_documents.get((uid, name, item.id))
                if expected_record is None or item.to_dict() != expected_record:
                    raise RuntimeError(f"Field parity mismatch for {uid}/{name}/{item.id}")
            if name == "products":
                value = sum(int(item.to_dict().get("quantity") or 0) for item in actual)
                if value != expected_group["stock"]:
                    raise RuntimeError(f"Inventory quantity mismatch for account {uid}")
            elif name == "sales":
                sales_value = sum(float(item.to_dict().get("total_amount") or 0) for item in actual)
                profit_value = sum(float(item.to_dict().get("profit") or 0) for item in actual)
                if round(sales_value - expected_group["sales"], 2) or round(profit_value - expected_group["profit"], 2):
                    raise RuntimeError(f"Sales totals mismatch for account {uid}")
            elif name == "credit_entries":
                credit_value = sum(float(item.to_dict().get("remaining") or 0) for item in actual
                                   if item.to_dict().get("entry_type") == "credit")
                if round(credit_value - expected_group["credit"], 2):
                    raise RuntimeError(f"Credit balance total mismatch for account {uid}")
    print("Post-import verification passed: Auth identities, exact document IDs/counts, stock, sales, profit, credits, and snapshot markers match.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="validate source and target without writing")
    args = parser.parse_args()
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    credential_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not project_id or not credential_path:
        parser.error("Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS in this shell")
    if not Path(credential_path).is_file():
        parser.error("GOOGLE_APPLICATION_CREDENTIALS does not point to a readable service-account file")

    snapshot, snapshot_id = read_snapshot(args.snapshot)
    cred = credentials.Certificate(credential_path)
    if cred.project_id != project_id:
        parser.error("The service-account key project ID does not match FIREBASE_PROJECT_ID")
    app = firebase_admin.initialize_app(cred, {"projectId": project_id})
    db = firestore.client(app=app)
    users, documents, image_rows = validate(snapshot, db, project_id, snapshot_id)
    counts = {name: len(snapshot["tables"].get(name, [])) for name in COLLECTIONS}
    counts["profiles"] = len(users)
    counts["barcodes"] = sum(
        bool(product.get("barcode"))
        for product in snapshot["tables"].get("products", [])
    )
    print(f"Preflight passed for Firebase project {project_id}.")
    print("Source row counts: " + json.dumps(snapshot.get("row_counts", {}), sort_keys=True))
    print("Firestore document counts: " + json.dumps(counts, sort_keys=True))
    print(f"Product image rows preserved only in the private PostgreSQL snapshot: {len(image_rows)}")
    print(f"Snapshot SHA-256: {snapshot_id}")
    if args.dry_run:
        print("Dry run only; no Firebase records were written.")
        return 0

    print("Importing Firebase Authentication users…")
    import_auth(users)

    batch = db.batch()
    pending = 0
    for user in users:
        uid = legacy_uid(user["id"])
        profile = {key: firestore_value(value) for key, value in user.items() if key != "password_hash"}
        # New profiles use the Firebase UID as their public identifier. Keep
        # the old integer in legacy_user_id for reporting/audit only.
        profile["legacy_user_id"] = int(profile.pop("id"))
        profile["id"] = uid
        profile["migration_snapshot"] = snapshot_id
        profile_ref = db.collection("profiles").document(uid)
        if not profile_ref.get().exists:
            batch.set(profile_ref, profile)
            pending += 1
        if pending == 450:
            batch.commit()
            batch = db.batch()
            pending = 0
    for ref, data, should_write in documents:
        if not should_write:
            continue
        batch.set(ref, data)
        pending += 1
        if pending == 450:
            batch.commit()
            batch = db.batch()
            pending = 0
    if pending:
        batch.commit()
    verify_import(db, users, documents, snapshot_id)
    print("Import complete. Do not cut over until the verification checklist passes.")
    print("Product image bytes are retained in the private source snapshot and old PostgreSQL database; Spark cannot host them in Firebase Storage.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        # Avoid dumping source rows, credentials, or document data into logs.
        print(f"Migration stopped safely: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
