# Deploy to Fly.io + Supabase

Zero-cost scaling: Supabase (free PostgreSQL) + Fly.io (free tier VM).

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project**
3. Name it `kirana-smart-assistant`
4. Set a strong database password (save it!)
5. Choose region: **Southeast Asia (Mumbai)** — closest to Nepal/India
6. Wait for project to spin up (~2 minutes)
7. Go to **Settings → Database → Connection string → URI**
8. Copy the `postgresql://` URL

It looks like:
```
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

## Step 2: Install Fly.io CLI

```bash
# macOS / Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

## Step 3: Authenticate & Launch

```bash
cd kirana-smart-assistant

# Login (opens browser)
fly auth login

# Launch the app (creates fly.toml — ours is already there)
fly launch

# Set secrets (never commit these!)
fly secrets set DATABASE_URL="postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
fly secrets set JWT_SECRET_KEY="$(openssl rand -base64 64)"
fly secrets set CORS_ORIGINS="https://harmless-beep.github.io"

# Deploy!
fly deploy
```

## Step 4: Verify

```bash
# Health check
curl https://kirana-smart-assistant.fly.dev/health

# API docs
open https://kirana-smart-assistant.fly.dev/docs
```

## Step 5: Update Frontend

Update the frontend's API client to point to the new backend URL.

In `frontend/src/api/client.js`, the base URL should be:
```
https://kirana-smart-assistant.fly.dev
```

If using GitHub Pages with Vite, set `VITE_API_URL` in the build:
```bash
VITE_API_URL=https://kirana-smart-assistant.fly.dev npm run build
```

Or add it to `.env.production`:
```
VITE_API_URL=https://kirana-smart-assistant.fly.dev
```

## Free Tier Limits

| Resource | Free Tier | Enough for |
|---|---|---|
| **Supabase** | 500MB DB, 500GB bandwidth | ~5,000 shops |
| **Fly.io** | 3 shared-cpu VMs, 3GB storage | ~1,000 concurrent users |
| **Always on?** | auto_stop/auto_start — sleeps after 5min idle | Wakes in <1s on request |

## Optional: Keep Always-On

If you don't want any sleep at all:

```bash
fly scale count 1 --max 1
fly machines update --autostop=false --autostart=true <machine-id>
```

But the auto-sleep saves resources and still wakes fast (~1-2s).

## Troubleshooting

**"Connection refused"**
- Check `DATABASE_URL` is set: `fly secrets list`
- Make sure Supabase project is active (not paused)

**"SSL required"**
- Supabase requires SSL — SQLAlchemy handles this automatically with `?sslmode=require` in the URL

**CORS errors**
- Make sure `CORS_ORIGINS` includes your frontend URL
- Default includes `https://harmless-beep.github.io`
