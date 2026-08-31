import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import inspect, text

from database import engine, Base
from routes import api_router

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

STATIC_DIR = Path("static")


def apply_compatibility_migrations():
    """Apply additive migrations only when the schema is actually behind.

    A small ``schema_version`` table tracks the last migration version that
    has been applied.  When the database is already up-to-date the entire
    function returns in a fraction of a second, which keeps Render cold
    starts fast.
    """
    CURRENT_VERSION = 3  # bump when adding a new migration block

    inspector = inspect(engine)

    # --- ensure the version tracking table exists ---
    if "schema_version" not in inspector.get_table_names():
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS schema_version ("
                "  id    INTEGER PRIMARY KEY DEFAULT 1,"
                "  level INTEGER NOT NULL DEFAULT 0"
                ")"
            ))
            conn.execute(text("INSERT INTO schema_version (id, level) VALUES (1, 0) ON CONFLICT DO NOTHING"))
        # reflect again so inspector knows about the new table
        inspector = inspect(engine)

    with engine.connect() as conn:
        row = conn.execute(text("SELECT level FROM schema_version WHERE id = 1")).fetchone()
        applied = row[0] if row else 0

    if applied >= CURRENT_VERSION:
        return  # already up-to-date — skip everything

    # --- migrations (only run when needed) ---
    if applied < 1 and "products" in inspector.get_table_names():
        product_columns = {column["name"] for column in inspector.get_columns("products")}
        with engine.begin() as connection:
            if "description" not in product_columns:
                connection.execute(text("ALTER TABLE products ADD COLUMN description TEXT"))
            if engine.dialect.name == "postgresql":
                connection.execute(text("ALTER TABLE products ALTER COLUMN image_path TYPE TEXT"))

    if applied < 2 and "sales" in inspector.get_table_names():
        sale_columns = {column["name"] for column in inspector.get_columns("sales")}
        with engine.begin() as connection:
            if "user_id" not in sale_columns:
                if engine.dialect.name == "postgresql":
                    connection.execute(text("ALTER TABLE sales ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"))
                else:
                    connection.execute(text("ALTER TABLE sales ADD COLUMN user_id INTEGER"))
            connection.execute(text("""
                UPDATE sales SET user_id = (
                    SELECT products.user_id
                    FROM sale_items JOIN products ON products.id = sale_items.product_id
                    WHERE sale_items.sale_id = sales.id LIMIT 1
                ) WHERE user_id IS NULL
            """))

    if applied < 2 and "sale_items" in inspector.get_table_names():
        item_columns = {column["name"] for column in inspector.get_columns("sale_items")}
        with engine.begin() as connection:
            if "product_name" not in item_columns:
                connection.execute(text("ALTER TABLE sale_items ADD COLUMN product_name VARCHAR(200)"))
                if engine.dialect.name == "postgresql":
                    connection.execute(text("""
                        UPDATE sale_items SET product_name = products.name
                        FROM products WHERE products.id = sale_items.product_id
                    """))
                else:
                    connection.execute(text("""
                        UPDATE sale_items SET product_name = (
                            SELECT products.name FROM products WHERE products.id = sale_items.product_id
                        )
                    """))
            if "cost_price" not in item_columns:
                connection.execute(text("ALTER TABLE sale_items ADD COLUMN cost_price FLOAT"))
                if engine.dialect.name == "postgresql":
                    connection.execute(text("""
                        UPDATE sale_items SET cost_price = products.buying_price
                        FROM products WHERE products.id = sale_items.product_id
                    """))
                else:
                    connection.execute(text("""
                        UPDATE sale_items SET cost_price = (
                            SELECT products.buying_price FROM products WHERE products.id = sale_items.product_id
                        )
                    """))

    if applied < 3 and engine.dialect.name == "postgresql":
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
            connection.execute(text("ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'credit'"))

    # --- mark as fully applied ---
    with engine.begin() as conn:
        conn.execute(text(f"UPDATE schema_version SET level = {CURRENT_VERSION} WHERE id = 1"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    apply_compatibility_migrations()
    yield


app = FastAPI(
    title="Kirana Smart Assistant API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Accept either spelling so docker-compose (CORS_ORIGINS) and the
# documented name (CORS_ORIGINS) both work.
_raw = os.getenv("CORS_ORIGINS") or os.getenv("CORS_ORIGINS") or ""
_default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
    "https://harmless-beep.github.io",
]
CORS_ORIGINS = [o.strip() for o in _raw.split(",") if o.strip()] or _default_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/warmup")
async def warmup():
    """Lightweight endpoint for keep-alive pings — no DB hit."""
    return {"ok": True}


if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
