# Deployment Guide

> **Current live deployment (verified working):**
> - Frontend: https://harmless-beep.github.io/kirana-smart-assistant/
> - Backend:  https://kirana-smart-assistant.onrender.com
> - Docs:     https://kirana-smart-assistant.onrender.com/docs
>
> Frontend auto-deploys to GitHub Pages on every push to `master`.
> Backend auto-deploys to Render on every push to `master`.

---

## 1. Deploy Frontend to GitHub Pages (current method)

The repository ships with `.github/workflows/deploy.yml` that builds the React app and publishes it to GitHub Pages automatically. It bakes in `VITE_API_URL` pointing at the Render backend.

### Steps

1. **Push to GitHub** (branch `master`).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Wait for the **Deploy to GitHub Pages** workflow run to finish (≈40s).
4. Your app is live at `https://<user>.github.io/kirana-smart-assistant/`.

No Vercel account is needed.

### (Alternative) Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → "Add New Project" → import this GitHub repo.
2. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variables**: add `VITE_API_URL` = `https://kirana-smart-assistant.onrender.com`
4. Deploy.

---

## 2. Deploy Backend to Render

### Steps

1. **Create Web Service**
   - Go to [render.com](https://render.com) → **New** → **Web Service**
   - Connect this GitHub repository

2. **Configure**
   - **Name**: `kirana-smart-assistant`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Environment Variables**
   - `DATABASE_URL`: your PostgreSQL connection string
   - `JWT_SECRET_KEY`: a long random string (`openssl rand -base64 64`)
   - `CORS_ORIGINS`: your frontend URL, e.g. `https://harmless-beep.github.io`
   - `PERPLEXITY_API_KEY`: *(optional)* enables the AI assistant

4. **Deploy** → live at `https://kirana-smart-assistant.onrender.com`

---

## 3. Database Setup (Render Postgres or Supabase)

### Render Postgres (simplest)
1. render.com → **New** → **PostgreSQL**
2. After creation, copy the **Internal Database URL** (or External)
3. Set it as `DATABASE_URL` in the web service Environment
4. Tables are created automatically on first launch (SQLAlchemy `create_all`)

### Supabase (alternative)
1. [supabase.com](https://supabase.com) → New Project
2. Settings → Database → copy the connection string (URI), replace `[YOUR-PASSWORD]`
3. Paste as `DATABASE_URL` in Render
4. (Optional) run `database/schema.sql` in the Supabase SQL Editor

---

## 4. Enable the AI Smart Assistant (Perplexity)

The assistant is **off by default** and returns a "not configured yet" message until a key is provided.

1. Create an API key at https://console.perplexity.ai
2. In the Render dashboard → service → **Environment** → add `PERPLEXITY_API_KEY`
3. (Optional) set `PERPLEXITY_MODEL` (default `sonar`)
4. **Save, rebuild, and deploy**
5. The assistant now answers using live AI grounded in your shop data.

---

## 5. Environment Variables Summary

| Variable | Where to Set | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | Render | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Render | JWT signing secret (random string — **required in production**) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Render | Token lifetime (default `10080` = 7 days) |
| `CORS_ORIGINS` | Render | Comma-separated frontend URL(s) |
| `PERPLEXITY_API_KEY` | Render | **Optional** — enables the AI assistant |
| `PERPLEXITY_MODEL` | Render | Perplexity model (default `sonar`) |
| `VITE_API_URL` | GitHub Pages / Vercel | Backend API URL |

---

## 6. Production Deployment on Oracle Cloud (optional)

For a server you fully control (no cold starts, free-tier VM), see [`DEPLOY-ORACLE.md`](DEPLOY-ORACLE.md). It covers Docker install, `docker-compose.yml`, Nginx, and Let's Encrypt SSL.

---

## 7. SSL/HTTPS Notes

- GitHub Pages automatically provides SSL for the frontend.
- Render automatically provides SSL for the backend.
- (Oracle path) SSL is configured via Let's Encrypt in `DEPLOY-ORACLE.md`.
- No manual cert work needed for the managed hosts.

---

## Troubleshooting

### CORS Errors
- Make sure `CORS_ORIGINS` includes your frontend URL (with `https://`).
- For local dev it should include `http://localhost:5173`.

### Database Connection Fails
- Verify `DATABASE_URL` is correct and the DB is reachable from Render.
- Render Postgres is reachable by default; Supabase requires the connection string with the real password.

### Cold Start Delay (free tier)
- The first request after inactivity takes ~30–50s. The frontend retries automatically; just wait.
- For production, upgrade the Render instance or use the Oracle Cloud Docker path.

### AI Assistant Says "Not Configured"
- `PERPLEXITY_API_KEY` is not set (or empty) in the backend environment. Add it and redeploy.

### Build Fails
- Ensure all dependencies are in `backend/requirements.txt`.
- Render uses Python 3.x; the `requirements.txt` is intentionally unpinned for wheel compatibility.
