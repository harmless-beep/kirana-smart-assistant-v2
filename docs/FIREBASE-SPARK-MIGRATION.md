# Render to Firebase Spark migration

## Migration goals

- Remove Render from the normal request path to eliminate its cold starts.
- Keep the existing Render FastAPI service and PostgreSQL database intact as a
  rollback target and historical archive until the new deployment has proven
  stable.
- Move shop data and authentication to Firebase services available without a
  billing account: Firebase Authentication (email/password provider) and Cloud
  Firestore.
- Keep the app useful offline through its existing local store.
- Finish with repeatable checks for data parity, account isolation, core shop
  workflows, exports, and offline behavior before production cutover.

## Current readiness

The parallel Firebase implementation and private export/import tooling are
prepared in this branch. A Firebase Spark project (`kirana-smart-assistant`)
and the `Kirana Smart PWA` web app now exist. Email/Password Authentication is
enabled; the existing GitHub Pages host is authorised; and the default Standard
Cloud Firestore database is provisioned in `asia-south2` (Delhi) in production
mode. The repository's owner-scoped Firestore rules are published. The local
ignored `frontend/.env.local` points at this project for Firebase-mode builds.
The ordinary GitHub Pages workflow still defaults to Render. The original
Render service and PostgreSQL database remain active and unchanged.

The real Render PostgreSQL snapshot was captured privately in Windows Temp,
validated against its checksum, and imported into Firestore and Firebase Auth.
The importer's post-write verification passed for all six Auth identities,
exact document IDs/counts, stock totals, sales, profit, credits, and snapshot
markers. The source had an empty legacy `kirana` table, which is explicitly
checked by the exporter, and one ownerless sale; the owner approved assigning
sale #1 to account 4. All 27 product-image rows remain preserved in the source
database and private snapshot; Spark Storage is unavailable, so those photos do
not sync to Firebase. The live Firebase rules denied an unauthenticated profile
read. The emulator rules suite passed with a temporary JDK 21 and all 24
dependency-free snapshot tests pass. The Firebase-mode production build passes;
lint reports three pre-existing warnings and Vite reports a large-bundle
warning. Live sign-in with an existing password and interactive shop workflow
tests remain outstanding because no shop password was supplied. GitHub Pages
still defaults to Render; no public cutover has been made. Do not cut over until
existing-account login and isolated workflow checks pass. The one-time service
account key has been removed from Windows Temp, its project role grants have
been revoked, and the clipboard was cleared. The private snapshot and checksum
remain in Windows Temp as the local migration backup.

## Spark boundaries

Spark needs no payment details for Spark-compatible products. Cloud Firestore
has a free quota of 1 GiB stored, 50,000 document reads/day, 20,000 writes/day,
20,000 deletes/day, and 10 GiB monthly egress. These are project-wide quotas.
Firebase Cloud Functions and Cloud Storage require Blaze, so this migration
must not depend on them. Product pictures remain device-local in the PWA; the
current PostgreSQL copy stays preserved in the legacy database/export but
cannot be fetched from Firebase on Spark. Existing non-image shop data moves
to Firestore.

## Target data layout

Use a deterministic Firebase UID for imported accounts (`kirana_<old user id>`)
so every relational foreign key remains meaningful and rerunning the import is
safe. Shop data is nested under the account UID:

```
profiles/{uid}
users/{uid}/products/{old product id}
users/{uid}/categories/{old category id}
users/{uid}/customers/{old customer id}
users/{uid}/credit_entries/{old credit entry id}
users/{uid}/sales/{old sale id}
users/{uid}/sale_items/{old sale item id}
users/{uid}/notifications/{old notification id}
users/{uid}/settings/{old setting id}
```

Imported documents retain their old numeric IDs as strings and their existing
foreign key fields. New records use UUIDs to avoid multi-device ID collisions.
The adapter treats both formats as opaque IDs. Firestore Security Rules allow
a signed-in user to read or write only the namespace matching their UID.
Sales keep immutable item snapshots;
new sales and stock decrements must use a Firestore transaction so concurrent
sales cannot oversell inventory. Credit and payment updates also use
transactions.

Spark has no trusted server execution for this app. Rules can enforce shop
isolation and record shape, but they cannot make browser code a trusted cashier:
a modified signed-in client could forge sales or alter nonnegative inventory.
The app uses atomic transactions to prevent accidental overselling during
normal use. If protection against a malicious signed-in owner is required, the
Spark-only architecture is insufficient and a trusted backend is necessary.

Offline boundary: Firestore can serve cached reads and queue ordinary writes,
but workflows implemented with transactions require a live connection. That
includes sales, product create/edit/delete with barcode reservation, and credit
payments; initial authentication also requires a connection. A shop cannot
complete a Firebase sale while disconnected. Existing local records remain on
that device, but a conflict-safe queue for offline sales and later
reconciliation has not been implemented. If completing sales without internet
is a launch requirement, do not cut over until that queue exists and is tested.

## Existing account migration

The current UI accepts phone number + password. We can preserve that UI without
SMS by mapping the exact phone string to a deterministic synthetic email used
internally with Firebase's email/password provider. This does not verify phone
ownership, but preserves sign-in behavior. Existing password hashes use bcrypt;
Firebase Admin supports importing bcrypt hashes, so existing passwords can
carry over without asking every shop to reset them. The migration tool must
check for UID/email collisions and abort before overwriting unrelated Firebase
accounts. New signups use the same phone-to-internal-email mapping.

## Stages and rollback points

### 1. Inventory and baseline

- List every REST operation, response shape, database table, file/image path,
  auth behavior, and report/export behavior.
- Capture baseline counts and totals per shop from PostgreSQL.
- Keep the current Render service and database unchanged.

### 2. Build Firebase path in parallel

- Implement Firebase Auth and Firestore behind the existing `api.*` frontend
  interface, gated by explicit build configuration.
- Preserve the REST adapter as a selectable rollback mode.
- Preserve local offline mode, but never silently overwrite cloud data with
  stale local data after a Firebase failure.
- Port product/category/customer/khata/sales/dashboard/notification/settings,
  barcode lookup, and client-side PDF/Excel export behavior.
- Replace API-hosted product photo uploads with device-local pictures and a
  clear note that photos do not sync on Spark.

### 3. Prepare and validate a private migration snapshot

- Export all PostgreSQL tables, including password hashes and product image
  bytes, to a private local file excluded from Git.
- The exporter inventories public tables and stops if an application table is
  missing or an unmapped table exists; it records the checked inventory. The
  observed legacy `kirana` table contains only `id` and `created_at`, had zero
  rows, and is accepted only after the exporter confirms it remains empty.
- Record a checksum and row counts. Do not print credentials, password hashes,
  or customer data in logs.
- The importer requires the matching `.sha256` sidecar and refuses a renamed or
  altered snapshot before contacting Firebase.
- Dry-run import checks UID/email uniqueness, foreign keys, document sizes,
  and Firestore's 1 MiB document limit before writing.
- Import Firebase Auth users first, then shop documents in idempotent batches.
- Compare exact profile and document fields, per-user collection counts and IDs,
  sales totals/profits, stock quantities, and credit balances after import. Any
  mismatch blocks cutover.

### 4. Test against a separate Firebase project or isolated test accounts

- Register/login/logout and profile update; verify an imported account can
  still sign in with its old password.
- Create/edit/delete products, categories, and customers.
- Complete cash and credit sales; verify stock, sale snapshots, and balances.
- Add a credit/payment; verify outstanding balances and dashboard totals.
- Check reports, PDF/Excel downloads, low-stock/expiry/overdue alerts, barcode
  search/generation, settings, and product images on-device.
- Run `npm run test:rules` from `frontend`; the emulator suite checks owner
  isolation, unauthenticated denial, protected profile identity/role, valid
  phone and inventory changes, cross-shop writes, and invalid sales/stock.
- Verify user A cannot read or alter user B's data, including crafted document
  paths, against the configured Firebase project before production use.
- Verify cached offline reads and recovery. Sale creation is online-only in
  the current Spark adapter, so confirm the UI reports that clearly rather
  than implying that an offline sale was saved. Exercise the actual PWA on a
  phone-sized viewport and installed app.
- Check Firestore usage stays comfortably inside Spark quotas for the expected
  shop size. Bound/paginate queries and avoid full-history rereads.

### 5. Production cutover with rollback

- Export a final PostgreSQL snapshot after pausing writes briefly, import it,
  and rerun parity checks.
- Build a Firebase-configured frontend preview and run smoke checks before
  publishing it to the live GitHub Pages URL.
- Keep Render/PostgreSQL running and unchanged during an agreed observation
  window. Save the previous frontend build and API URL for rollback.
- Before Firebase accepts live writes, rollback is a frontend rebuild pointing
  at Render. After Firebase accepts live writes, switching back to Render
  alone would hide those writes; pause traffic and either reconcile the
  Firebase changes back to PostgreSQL or keep Firebase as the source while
  fixing forward. Never claim a post-cutover rollback is data-safe until the
  reconciliation has been checked.
- Do not delete or modify the PostgreSQL database during migration or the
  observation period.
- Only consider retiring Render after the user confirms the observation period
  is complete and the Firebase data snapshot has a separate backup.

## What the owner needs to provide/do

1. Done: create the Firebase Spark project, register the Web app, enable
   Email/Password Authentication, create the default Firestore database in
   production mode, and add the live GitHub Pages host to authorised domains.
   The database is in Delhi (`asia-south2`). No billing account, Storage, or
   Functions are enabled.
2. Done locally: the public Web app config is in ignored
   `frontend/.env.local`. For a future production build, set the corresponding
   GitHub repository variables listed in `migration/README.md`; keep
   `VITE_BACKEND_MODE` unset or `render` until import and production checks
   pass.
3. For the one-time import, provide the Render PostgreSQL connection string
   locally through an environment variable and create a temporary Firebase
   service-account key kept outside the repository. Never paste either secret
   into chat or commit it. Remove the temporary key after migration.
4. Be available for one supervised production cutover and the agreed
   observation period. Your account-owner actions are project setup, secret
   handling, reviewing preflight/parity output, and approving the public
   frontend switch. Routine code, migration scripting, and local checks are
   handled here. No card details are needed for the Spark architecture.

## Completion criteria

The migration is complete only when the old database remains recoverable, all
non-image data and accounts pass parity checks, major workflows pass on the
Firebase path, security rules pass cross-account denial checks, offline/PWA
behavior is verified, the production frontend no longer calls Render for
normal app operations, and rollback has been demonstrated. Product image
bytes remain preserved in the old database/export; syncing those images would
require Blaze or another storage provider.

## References

- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Firestore quotas](https://firebase.google.com/docs/firestore/pricing)
- [Import users and bcrypt hashes](https://firebase.google.com/docs/auth/admin/import-users)
- [Cloud Functions billing requirement](https://firebase.google.com/docs/functions/quotas)
- [Cloud Storage billing requirement](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
