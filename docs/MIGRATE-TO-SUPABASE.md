# Move off Render's 90-day Postgres → Supabase (free, never expires)

Render's free PostgreSQL database is **deleted ~90 days after it is created**.
This guide moves the app's data to Supabase's free tier (500 MB Postgres,
no expiry) and points the live backend at it. ~10 minutes, no cost.

## 1. Create the Supabase project

1. Go to https://supabase.com → **Start your project** (free plan).
2. **New project**:
   - Name: anything, e.g. `kirana`
   - Database password: choose a strong one and **save it** (you need it below)
   - Region: pick the closest (Singapore works well for Nepal/India)
3. Wait ~1–2 minutes for the project to provision.

## 2. Get the connection string

In the project dashboard: **Settings → Database → Connection string** →
copy the **URI** (not the PSQL one). It looks like:

```
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
```

- Use the **session pooler (port 5432)** — not the transaction pooler (6543).
- Append `?sslmode=require` at the end (Supabase requires SSL).

Full example:

```
postgresql://postgres.abcdefghijklmnopqrst:MyStrongPassword123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### ⚠️ Important: use the pooler, and use the RIGHT region

- **Never use the direct `db.<ref>.supabase.co` host** in Render — it is
  IPv6-only and Render has no IPv6 route (deploy fails with
  `Network is unreachable`). Always use the `aws-0-<REGION>.pooler.supabase.com`
  host (IPv4).
- The `<REGION>` in the pooler host **must match where the project was actually
  created** — it is often NOT the region you intended. If the pooler replies
  `FATAL: (ENOTFOUND)`, the region is wrong.
- To find the real region: in your project **Settings → Database → Connection
  string**, the dashboard shows `host: db.<ref>.supabase.co` — resolve it
  (`nslookup db.<ref>.supabase.co`) and map the IPv6 prefix to a region using
  AWS's published ranges, or simply try each region's pooler host until one
  accepts the connection. (This project's actual region turned out to be
  **Tokyo `aws-0-ap-northeast-1`**.)

## 3. Copy the existing data (one command)

The repo ships `backend/migrate_db.py` — it creates the tables on the
destination and copies every row **preserving ids**, so all foreign keys
(sales → products, khata → customers) stay intact, then resets the
auto-increment sequences. It is safe to run more than once.

From `backend/`:

```bash
SRC_DATABASE_URL="<render DATABASE_URL from your Render service Environment>" \
DST_DATABASE_URL="<supabase connection string from step 2>" \
venv/Scripts/python migrate_db.py
```

You'll see one line per table, e.g. `products: copied 43 rows (16 columns)`.

## 4. Point the live backend at Supabase

1. Render dashboard → your service → **Environment**.
2. Set `DATABASE_URL` to the Supabase connection string (step 2).
3. **Save changes → deploy** (manual deploy is fine).

The backend creates/migrates tables automatically on startup — everything
is additive, so nothing is lost. The old Render database can then be
deleted (or kept until its 90-day expiry) once the app is confirmed
working on Supabase.

## 5. Verify

- Open the live app, log in, and confirm products/sales/khata are intact.
- Add a test product with a photo — photos are stored in the DB, so they
  now survive redeploys too.
- Check the Render logs for `Application startup complete` with no errors.

## Rollback

To go back, just set `DATABASE_URL` to the Render value again and redeploy.
(Don't delete the Render database until you're sure Supabase works.)
