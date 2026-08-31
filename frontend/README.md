# Kirana Smart Assistant — Frontend

React 19 + Vite 8 + Tailwind CSS 4 progressive web app for kirana/pasal shop management.

## Stack

- **React 19** with React Router v7
- **Vite 8** with HMR
- **Tailwind CSS 4** via Vite plugin
- **Axios** for API calls with offline fallback
- **Lucide React** for icons
- **PWA** via Vite Plugin PWA + Workbox

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run lint     # oxlint
```

## Key Directories

```
src/
├── api/          # API client with offline fallback + sync queue
├── components/   # Modal, Card, BottomNav, SearchBar, etc.
├── context/      # AuthContext, ThemeContext, LanguageContext
├── hooks/        # usePolling
├── pages/        # Dashboard, Products, Sales, Khata, Reports, Assistant, etc.
└── App.jsx       # Router & layout
```
