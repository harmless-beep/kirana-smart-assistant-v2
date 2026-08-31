# 🏪 Kirana Smart Assistant

> The all-in-one shop hub for kirana/pasal stores — inventory, sales, digital khata, and an AI assistant that knows your shop.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-%F0%9F%9A%80-green?style=for-the-badge)](https://harmless-beep.github.io/kirana-smart-assistant-v2/)
[![API Docs](https://img.shields.io/badge/API%20Docs-Swagger-blue?style=for-the-badge)](https://kirana-smart-assistant.onrender.com/docs)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Built for small shops in Nepal & India — so simple that a shop owner with almost no computer experience can use it after a few minutes. Runs on your phone, tablet, or computer as a mobile-first PWA.

---

## ✨ Features

| Feature | What it does |
|---|---|
| 📦 **Inventory** | Add, edit, search & track products with categories and stock levels |
| 💰 **Quick Sales** | Ring up a sale in seconds — auto-updates stock and profit |
| 📒 **Digital Khata** | Track customer credit/debit (udhar) — see who owes you and when |
| 🤖 **AI Assistant** | Ask "what's running low?" or "how much profit today?" in English or Nepali — answers from your real shop data |
| 🏷️ **Barcodes** | Scan shelf barcodes to find products instantly |
| 📊 **Dashboard** | Today's sales, profit, and recent activity at a glance |
| 📄 **Reports** | Export sales/profit reports as PDF or Excel |
| 🔔 **Notifications** | Alerts for low stock and unpaid dues |
| 🌙 **Dark Mode** | Easy on the eyes, works in low light |
| 📱 **PWA** | Install on your phone like an app, works offline |
| 👆 **Pull-to-Refresh** | Pull down on Products and Khata pages to refresh data |
| 📳 **Haptic Feedback** | Subtle vibration on button presses for a native feel |

---

## 🚀 Quick Start

### Option 1: Docker (one command)

```bash
git clone https://github.com/harmless-beep/kirana-smart-assistant.git
cd kirana-smart-assistant
docker-compose up
```

Then open **http://localhost:8000** — done. 🎉

### Option 2: Manual setup

**Backend:**
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
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

Open **http://localhost:5173** for the app, **http://localhost:8000/docs** for the API.

> ⚠️ **No database? No problem.** Leave `DATABASE_URL` empty and it falls back to a local SQLite file — zero setup for trying it out.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` in the backend directory, then fill in what you need:

| Variable | Required? | What it's for |
|---|---|---|
| `DATABASE_URL` | Optional | PostgreSQL connection string. Empty = SQLite fallback |
| `JWT_SECRET_KEY` | **Yes (prod)** | Signing key for logins. Generate: `openssl rand -base64 64` |
| `AI_API_KEY` | Optional | AI assistant (DeepSeek endpoint, or Gemini/OpenCode Zen) |

> 🔒 **Security:** Never commit a real `.env` file — it's gitignored. In production, set these in your hosting dashboard instead.

---

## 🤖 AI Assistant (optional)

The Smart Assistant answers questions like *"what's expiring soon?"* or *"how should I price rice?"* using your shop's actual data. It works in English and Nepali.

- **Without a key:** works in a basic offline mode with keyword matching
- **With a key:** full AI answers powered by DeepSeek

To enable: set `AI_API_KEY` in your environment, restart the backend.

---

## 🧱 Tech Stack

**Frontend:** React 19 · Vite 8 · Tailwind CSS 4 · React Router · PWA
**Backend:** FastAPI · SQLAlchemy · PostgreSQL · SQLite fallback · JWT Auth
**AI:** DeepSeek (custom endpoint) · Gemini / OpenCode Zen (fallback)
**Reports:** PDF + Excel export
**Deploy:** Docker · GitHub Actions · Render · GitHub Pages

---

## 📁 Project Structure

```
kirana-smart-assistant/
├── frontend/          # React PWA
│   ├── src/
│   │   ├── components/  # Reusable UI (BottomNav, Modal, Button, etc.)
│   │   ├── pages/       # App pages (Home, Sales, Products, Khata, etc.)
│   │   ├── context/     # Auth & theme
│   │   ├── hooks/       # Custom hooks (usePullToRefresh, usePolling)
│   │   ├── utils/       # Helpers (haptics, etc.)
│   │   └── api/         # API client (offline fallback)
│   └── public/          # PWA manifest & icons
├── backend/           # FastAPI server
│   ├── routes/        # API endpoints
│   ├── models/        # Database models
│   ├── schemas/       # Validation
│   └── main.py        # Entry point
├── database/          # SQL schema
├── docs/              # Guides & screenshots
└── docker-compose.yml # One-command setup
```

---

## 📚 API Docs

Interactive Swagger UI when the backend is running: **/docs**

Main endpoints: `/api/auth`, `/api/products`, `/api/customers`, `/api/sales`, `/api/dashboard`, `/api/reports`, `/api/assistant`, `/api/barcode`, `/api/notifications`, `/api/settings`

---

## 🚢 Deployment

- **Frontend** → GitHub Pages (auto-deploy on push, workflow included)
- **Backend** → Render (free tier web service `kirana-smart-assistant`, manual deploy)
- **Everything** → Docker (any VPS, `docker-compose.yml` included)

Full step-by-step: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · Oracle Cloud: [DEPLOY-ORACLE.md](DEPLOY-ORACLE.md)

---

## 🤝 Contributing

Contributions welcome! Open an issue or submit a PR.

## 📄 License

MIT — use it, learn from it, build on it.
