# Private migration procedure

The migration leaves Render/PostgreSQL untouched. Do not deploy Firebase mode
to the live Pages site until import and verification checks pass.

The production-build/lint checks can run without Firebase credentials. The
snapshot, dry run, import, post-import parity verification, rules emulator
suite, and live unauthenticated access check have been completed for the
current source snapshot. Existing-account password login and signed-in shop
workflow tests still require the owner to provide a password or an isolated
test account. The rules test suite runs with `npm run test:rules` from
`frontend` and needs Java 21 plus the first-time Firebase Emulator JAR download.
The dependency-free snapshot tests run from the repository root with
`python migration/test_snapshot_validation.py` and need only the standard
library.

## Owner setup

1. Done in Firebase Console: Spark project `kirana-smart-assistant`, web app
   `Kirana Smart PWA`, Email/Password Authentication, the default Firestore
   database in production mode at `asia-south2` (Delhi), and the live GitHub
   Pages domain. The repository Firestore rules are published. Billing,
   Storage, and Cloud Functions remain disabled.
2. For the one-time import, create a temporary service-account key for Firebase
   Admin. Store it outside this repository and set
   `GOOGLE_APPLICATION_CREDENTIALS` to its full path. Keep it only for the
   import and remove it after the separate backup and parity checks. The
   completed import's temporary key and role grants have been revoked.
3. Install the one-off migration dependencies in an isolated virtual
   environment:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r migration/requirements.txt
   ```

4. Set the Render external PostgreSQL URL only in the current PowerShell
   session, then export a private snapshot outside this repository:

   ```powershell
   $env:DATABASE_URL = '<Render external PostgreSQL URL>'
   python migration/export_postgres.py "$env:TEMP/kirana-snapshot.json"
   Remove-Item Env:DATABASE_URL
   ```

5. Set the Firebase project ID and credential file path in the current shell.
   Run a dry run first; it checks Firebase for collisions and ownership but
   writes nothing:

   ```powershell
   $env:FIREBASE_PROJECT_ID = '<Firebase project ID>'
   $env:GOOGLE_APPLICATION_CREDENTIALS = '<path to temporary service account JSON>'
   python migration/import_firebase.py "$env:TEMP/kirana-snapshot.json" --dry-run
   ```

   Review row counts and resolve any reported issue before repeating without
   `--dry-run`. The importer can resume an interrupted run without replacing
   records already marked as imported from that snapshot.

The export includes personal data, password hashes, and image bytes. The
importer verifies the `.sha256` sidecar and snapshot filename before connecting
to Firebase. Keep both files private and delete them only after the migration
and a separate backup are confirmed. Never send credentials or the snapshot
in chat or commit them.

The observed PostgreSQL source also has a `kirana` table with only `id` and
`created_at`. It contained zero rows; the exporter checks this on each run and
aborts if any rows appear rather than silently dropping them. The private
snapshot records any manual owner resolution needed for legacy rows.

## App configuration

For a local preview, copy `frontend/.env.firebase.example` to
`frontend/.env.local` and fill the Firebase Web app config. Set
`VITE_BACKEND_MODE=firebase` only for that preview. GitHub Pages keeps using
Render unless the repository variable `VITE_BACKEND_MODE` is explicitly set to
`firebase`. Add the four `VITE_FIREBASE_*` values as repository variables.

Deploy Firestore rules and indexes with Firebase CLI (install it with
`npm install -g firebase-tools` if it is not already available):

```powershell
firebase deploy --project '<Firebase project ID>' --only firestore:rules,firestore:indexes
```

Changing the GitHub repository variable affects the next frontend build; the
current live site remains unchanged until a build is deployed.

## Rollback

Before Firebase accepts live writes, set `VITE_BACKEND_MODE` to `render` (or
remove it), then rebuild/redeploy the previous frontend. Keep the Render
service and original PostgreSQL database intact throughout migration and the
observation window. After Firebase accepts live writes, switching the frontend
back by itself would hide those writes. Pause app traffic and reconcile Firebase
changes back to PostgreSQL before using Render again, or keep Firebase as the
source and fix forward. Verify reconciliation before calling it a safe rollback.
