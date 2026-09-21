# 🏪 Kirana Smart

Smart shop management for kirana/pasal stores in Nepal and India.

A mobile-first Progressive Web App (PWA) designed so simple that a shop owner with almost no computer knowledge can use it after only a few minutes.

## 🌐 Live Demo (verified working)

The project is fully deployed and running end-to-end:

| Component | URL |
|-----------|-----|
| **Frontend (PWA)** | https://harmless-beep.github.io/kirana-smart-assistant/ |
| **Backend API** | https://kirana-smart-assistant.onrender.com |
| **API Docs (Swagger UI)** | https://kirana-smart-assistant.onrender.com/docs |

> ⚠️ The backend runs on Render's **free tier**, so the first request after a period of inactivity can take ~30–50s (cold start). The frontend is built to automatically retry, so just wait a moment on first load.

The free tier cannot be kept permanently awake without paying for hosting. To
make that delay less visible, the app now wakes the API in the background as
soon as the shell opens, uses an 8-second request timeout, and falls back to
its offline local store while the service is waking up. No paid API or
monitoring service is required.

## ✨ Features

- **Digital Khata** — Customer credit management with timeline view
- **Shop Tools** — fast checks for low stock, expiring products, overdue credit, and today's totals
- **Product Search** — Find products by brand, color, size, or partial name
- **Quick Sales** — Complete sales in 2 taps
- **Inventory Management** — Products with images, barcodes, expiry tracking
- **Dashboard** — Today's sales, profit, alerts at a glance
- **Reports** — Daily, weekly, monthly with PDF/Excel export
- **Barcode Support** — Generate and scan barcodes
- **Notifications** — Low stock, expiring products, unpaid credits
- **PWA** — Works offline on Android phones (localStorage fallback)
- **Dark Mode** — Easy on the eyes at night
- **Data persistence** — All shops, products, customers, and sales are saved to PostgreSQL and survive logout / app restart

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS (PWA via Vite Plugin PWA + Workbox) |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Render Postgres / Supabase compatible) |
| Auth | JWT (`python-jose` + `passlib[bcrypt]`) |
| Frontend Hosting | GitHub Pages (auto-deploy via GitHub Actions) |
| Backend Hosting | Render (auto-deploy from this repo) |

## 🚀 Quick Start

### Option 1: Docker (Recommended for local)

```bash
git clone https://github.com/harmless-beep/kirana-smart-assistant.git
cd kirana-smart-assistant
docker-compose up
```

Open http://localhost:8000

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:8000/docs

## 🔧 Environment Variables

Copy `.env.example` to `.env` in the backend directory. For the live deployment these are set in the Render dashboard (Environment section).

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET_KEY` | JWT signing secret — use a long random string (see below) | dev fallback |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes | `10080` (7 days) |
| `CORS_ORIGINS` | Comma-separated allowed origins | localhost + `https://harmless-beep.github.io` |

Generate a strong `JWT_SECRET_KEY` with:
```bash
openssl rand -base64 64
```

> In production, **always** set `JWT_SECRET_KEY` to a unique random value. If it is left unset, the backend falls back to an insecure development secret.

## 🧰 Shop Tools

The app no longer depends on an AI assistant. The Tools screen gives shop
owners practical, instant actions: today's sales and profit, low-stock items,
expiring products, overdue customer credit, new sale, add product, add customer,
and sales history. These checks also work with the local offline data store.

## 📁 Project Structure

```
kirana-smart-assistant/
├── frontend/              # React PWA
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── context/       # Auth & Theme context
│   │   ├── api/           # API client (with offline fallback)
│   │   └── App.jsx        # Router & layout
│   └── public/            # PWA manifest, icons
├── backend/               # FastAPI server
│   ├── routes/            # API route handlers
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   ├── main.py            # App entry point
│   └── database.py        # DB connection
├── database/              # SQL schemas
├── docs/                  # Documentation
├── .github/workflows/     # GitHub Pages auto-deploy
├── docker-compose.yml     # Docker setup
├── render.yaml            # Render auto-config
└── README.md              # This file
```

## 📚 API Documentation

When the backend is running, visit:
- **Swagger UI**: `/docs` (live: https://kirana-smart-assistant.onrender.com/docs)
- **ReDoc**: `/redoc`

Main endpoint groups: `/api/auth`, `/api/products`, `/api/customers`, `/api/sales`, `/api/dashboard`, `/api/reports`, `/api/barcode`, `/api/notifications`, `/api/settings`, `/health`.

## 🚢 Deployment

### Install it as an actual app

The frontend is an installable PWA. Open the deployed GitHub Pages URL in
Chrome or Edge, then choose **Install app** (desktop) or **Add to Home screen**
(Android). The manifest uses a relative start URL so the installed app opens
correctly from the repository path, and the app continues to work with its
local offline fallback when the backend is asleep or unavailable.

### Frontend → GitHub Pages (current method)

The repo includes `.github/workflows/deploy.yml`, which builds the frontend and publishes it to GitHub Pages on every push to `master`. The workflow sets `VITE_API_URL` to the Render backend automatically.

1. Push to the `master` branch.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Wait for the "Deploy to GitHub Pages" workflow run (~40s).
4. Live at `https://<user>.github.io/kirana-smart-assistant/`.

No Vercel account required. (A Vercel alternative is documented in `docs/DEPLOYMENT.md`.)

### Backend → Render

1. Push to GitHub.
2. render.com → **New Web Service** → connect this repo.
3. Use `render.yaml` for auto-configuration (build `pip install -r backend/requirements.txt`, start `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`).
4. Set `DATABASE_URL` and `JWT_SECRET_KEY` in the Environment section.
5. Deploy — live at `https://kirana-smart-assistant.onrender.com`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full details, the Oracle Cloud Docker path, and troubleshooting.

## 📄 License

MIT License

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.
