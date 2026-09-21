-- ============================================================================
-- Kirana Smart Assistant - Complete PostgreSQL Schema
-- For Supabase / PostgreSQL 14+
-- ============================================================================

-- Enums
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE entry_type AS ENUM ('credit', 'payment');
CREATE TYPE payment_method AS ENUM ('cash', 'esewa', 'khalti', 'card', 'bank_transfer', 'other');
CREATE TYPE notification_type AS ENUM ('low_stock', 'expiring', 'credit_due', 'general', 'sale');

-- ============================================================================
-- Users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    shop_name   VARCHAR(200),
    role        user_role NOT NULL DEFAULT 'owner',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);

-- ============================================================================
-- Categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    icon    VARCHAR(50),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_name ON categories(name);

-- ============================================================================
-- Products
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(100),
    brand           VARCHAR(100),
    buying_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
    selling_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantity        INTEGER NOT NULL DEFAULT 0,
    shelf_number    VARCHAR(20),
    barcode         VARCHAR(50) UNIQUE,
    expiry_date     DATE,
    image_path      VARCHAR(500),
    low_stock_limit INTEGER NOT NULL DEFAULT 10,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_barcode ON products(barcode);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Customers
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    phone      VARCHAR(20),
    address    VARCHAR(300),
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============================================================================
-- Credit Entries (Khata)
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_entries (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount      NUMERIC(12,2) NOT NULL,
    paid        NUMERIC(12,2) NOT NULL DEFAULT 0,
    remaining   NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes       TEXT,
    entry_type  entry_type NOT NULL DEFAULT 'credit',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_entries_customer_id ON credit_entries(customer_id);
CREATE INDEX idx_credit_entries_remaining ON credit_entries(remaining);

-- ============================================================================
-- Sales
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    profit          NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method  payment_method NOT NULL DEFAULT 'cash',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);

-- ============================================================================
-- Sale Items
-- ============================================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id          SERIAL PRIMARY KEY,
    sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity    INTEGER NOT NULL,
    unit_price  NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);

-- ============================================================================
-- Notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    message     TEXT NOT NULL,
    type        notification_type NOT NULL DEFAULT 'general',
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============================================================================
-- Settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id      SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key     VARCHAR(100) NOT NULL,
    value   TEXT
);

CREATE INDEX idx_settings_user_id ON settings(user_id);
CREATE UNIQUE INDEX idx_settings_user_key ON settings(user_id, key);

-- ============================================================================
-- Useful Views
-- ============================================================================

-- View: Customer outstanding balance
CREATE OR REPLACE VIEW v_customer_balance AS
SELECT
    c.id AS customer_id,
    c.name AS customer_name,
    c.phone,
    COALESCE(SUM(ce.remaining), 0) AS total_pending
FROM customers c
LEFT JOIN credit_entries ce ON ce.customer_id = c.id AND ce.remaining > 0 AND ce.entry_type = 'credit'
GROUP BY c.id, c.name, c.phone;

-- View: Low stock products
CREATE OR REPLACE VIEW v_low_stock AS
SELECT *
FROM products
WHERE quantity <= low_stock_limit;

-- View: Today's sales summary
CREATE OR REPLACE VIEW v_today_sales AS
SELECT
    COUNT(DISTINCT s.id) AS sale_count,
    COALESCE(SUM(s.total_amount), 0) AS total_sales,
    COALESCE(SUM(s.profit), 0) AS total_profit
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
JOIN products p ON si.product_id = p.id
WHERE s.created_at >= (CURRENT_DATE AT TIME ZONE 'UTC')
  AND s.created_at < ((CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'UTC');
