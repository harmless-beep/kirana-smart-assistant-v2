-- ============================================================================
-- Kirana Smart Assistant - Seed Data
-- Realistic Nepali/Indian grocery products with NPR/INR pricing
-- ============================================================================

-- ============================================================================
-- Sample User
-- ============================================================================
INSERT INTO users (name, phone, password_hash, shop_name, role)
VALUES (
    'Ram Shrestha',
    '9841000001',
    '$2b$12$LJ3m4ys3Lz0wqV9rGqY9Y.1XK9z5X8X2X7X5X3X1X9X7X5X3X1X9',  -- placeholder hash
    'Shrestha Kirana Store',
    'owner'
);

-- Get the user ID (assumes this is user 1)
-- In Supabase, use: SELECT id FROM users WHERE phone = '9841000001';

-- ============================================================================
-- Categories
-- ============================================================================
INSERT INTO categories (name, icon, user_id) VALUES
    ('Groceries', '🛒', 1),
    ('Beverages', '🥤', 1),
    ('Snacks', '🍪', 1),
    ('Dairy', '🥛', 1),
    ('Cleaning', '🧹', 1),
    ('Personal Care', '🧴', 1),
    ('Instant Food', '🍜', 1),
    ('Spices & Masala', '🌶️', 1),
    ('Bread & Bakery', '🍞', 1),
    ('Frozen', '🧊', 1);

-- ============================================================================
-- Products (10+ realistic Nepali/Indian grocery items)
-- ============================================================================
INSERT INTO products (name, category, brand, buying_price, selling_price, quantity, shelf_number, barcode, expiry_date, low_stock_limit, user_id) VALUES
    -- Instant Noodles
    ('Wai Wai Instant Noodles 70g', 'Instant Food', 'Wai Wai', 15.00, 20.00, 120, 'A1', '6921234567001', '2026-12-15', 20, 1),
    ('Wai Wai Chicken Noodles 70g', 'Instant Food', 'Wai Wai', 15.00, 20.00, 80, 'A1', '6921234567002', '2026-11-30', 20, 1),
    ('Rum Pung Instant Noodles 60g', 'Instant Food', 'Rum Pung', 10.00, 15.00, 5, 'A1', '6921234567003', '2026-10-20', 15, 1),

    -- Beverages
    ('Coca-Cola 500ml', 'Beverages', 'Coca-Cola', 30.00, 40.00, 48, 'B1', '5449000000996', '2027-03-01', 12, 1),
    ('Fanta Orange 500ml', 'Beverages', 'Coca-Cola', 30.00, 40.00, 36, 'B1', '5449000000997', '2027-03-01', 12, 1),
    ('Sprite 500ml', 'Beverages', 'Coca-Cola', 30.00, 40.00, 42, 'B1', '5449000000998', '2027-03-01', 12, 1),
    ('Mountain Dew 500ml', 'Beverages', 'PepsiCo', 30.00, 40.00, 24, 'B1', '5449000000999', '2027-02-15', 12, 1),
    ('Real Mango Juice 1L', 'Beverages', 'Dabur', 70.00, 90.00, 18, 'B2', '8901042011111', '2026-09-30', 8, 1),

    -- Biscuits & Snacks
    ('Britannia Good Day 250g', 'Snacks', 'Britannia', 40.00, 55.00, 60, 'C1', '8901058001111', '2026-08-20', 15, 1),
    ('Parle-G 80g', 'Snacks', 'Parle', 10.00, 12.00, 200, 'C1', '8901058002222', '2026-09-15', 30, 1),
    ('Haldiram Aloo Bhujia 200g', 'Snacks', 'Haldiram', 45.00, 60.00, 25, 'C2', '8901058003333', '2026-11-10', 10, 1),
    ('Kurkure Masala Munch 90g', 'Snacks', 'PepsiCo', 20.00, 25.00, 40, 'C1', '8901058004444', '2026-10-25', 15, 1),

    -- Dairy
    ('Amul Butter 100g', 'Dairy', 'Amul', 45.00, 55.00, 15, 'D1', '8901058005555', '2026-07-20', 8, 1),
    ('Amul Cheese 200g', 'Dairy', 'Amul', 80.00, 100.00, 8, 'D1', '8901058006666', '2026-07-15', 5, 1),
    ('Nepal Dairy Milk 500ml', 'Dairy', 'Nepal Dairy', 55.00, 65.00, 30, 'D2', '6921234567100', '2026-07-10', 10, 1),
    ('Yomurt 400g', 'Dairy', 'Chitwan', 35.00, 45.00, 20, 'D2', '6921234567101', '2026-07-05', 8, 1),

    -- Cleaning
    ('Surf Excel 500g', 'Cleaning', 'HUL', 55.00, 70.00, 25, 'E1', '8901058007777', '2027-06-01', 10, 1),
    ('Vim Dishwash Liquid 500ml', 'Cleaning', 'HUL', 80.00, 99.00, 12, 'E1', '8901058008888', '2027-05-15', 6, 1),
    ('Harpic Power Plus 500ml', 'Cleaning', 'Reckitt', 75.00, 95.00, 10, 'E2', '8901058009999', '2027-04-01', 5, 1),
    ('Nirma Wash 1kg', 'Cleaning', 'Nirma', 40.00, 50.00, 35, 'E1', '8901058010000', '2027-03-20', 10, 1),

    -- Personal Care
    ('Patanjali Soap 75g', 'Personal Care', 'Patanjali', 25.00, 35.00, 50, 'F1', '8901058011111', '2027-12-01', 15, 1),
    ('Colgate MaxFresh 150g', 'Personal Care', 'Colgate', 75.00, 95.00, 30, 'F1', '8901058012222', '2027-11-15', 10, 1),
    ('Head & Shoulders 180ml', 'Personal Care', 'P&G', 120.00, 150.00, 15, 'F2', '8901058013333', '2027-10-01', 8, 1),
    ('Dove Soap 100g', 'Personal Care', 'HUL', 50.00, 65.00, 22, 'F1', '8901058014444', '2027-09-20', 10, 1),

    -- Spices & Masala
    ('Everest Masala 50g', 'Spices & Masala', 'Everest', 30.00, 40.00, 40, 'G1', '8901058015555', '2027-08-01', 12, 1),
    ('MDH Chana Masala 100g', 'Spices & Masala', 'MDH', 55.00, 70.00, 20, 'G1', '8901058016666', '2027-07-15', 8, 1),
    ('Tata Salt 1kg', 'Groceries', 'Tata', 22.00, 28.00, 80, 'A2', '8901058017777', '2028-01-01', 20, 1),

    -- Bread
    ('English Oven Bread 400g', 'Bread & Bakery', 'English Oven', 30.00, 40.00, 12, 'H1', '8901058018888', '2026-07-12', 10, 1),
    ('Sugarcane Bread 400g', 'Bread & Bakery', 'Sugarcane', 25.00, 35.00, 8, 'H1', '8901058019999', '2026-07-11', 10, 1);

-- ============================================================================
-- Customers
-- ============================================================================
INSERT INTO customers (name, phone, address, user_id) VALUES
    ('Sita Devi', '9841111111', 'Baneshwor, Kathmandu', 1),
    ('Hari Prasad', '9841222222', 'New Road, Kathmandu', 1),
    ('Gita Sharma', '9841333333', 'Lalitpur, Nepal', 1),
    ('Krishna Tamang', '9841444444', 'Bhaktapur, Nepal', 1),
    ('Laxmi Gurung', '9841555555', 'Pokhara, Nepal', 1);

-- ============================================================================
-- Credit Entries (Khata)
-- ============================================================================
INSERT INTO credit_entries (customer_id, amount, paid, remaining, notes, entry_type, created_at) VALUES
    -- Sita Devi: Rs 850 credit, paid 500, remaining 350
    (1, 850.00, 500.00, 350.00, 'Monthly grocery credit - Baisakh', 'credit', '2026-04-15 10:00:00+05:45'),
    (1, 500.00, 500.00, 0.00, 'Payment received - mid month', 'payment', '2026-04-20 14:00:00+05:45'),
    (1, 420.00, 100.00, 320.00, 'Weekly groceries - Jestha', 'credit', '2026-05-05 09:30:00+05:45'),
    (1, 250.00, 230.00, 20.00, 'Additional items', 'credit', '2026-05-18 11:00:00+05:45'),

    -- Hari Prasad: Rs 1200 credit, paid 700, remaining 500
    (2, 1200.00, 700.00, 500.00, 'Monthly groceries - Baisakh', 'credit', '2026-04-10 08:00:00+05:45'),
    (2, 700.00, 700.00, 0.00, 'Partial payment', 'payment', '2026-04-25 16:00:00+05:45'),
    (2, 500.00, 0.00, 500.00, 'Festival supplies - Dashain advance', 'credit', '2026-05-01 10:00:00+05:45'),

    -- Gita Sharma: Rs 350 credit, fully paid
    (3, 350.00, 350.00, 0.00, 'Monthly essentials', 'credit', '2026-04-08 09:00:00+05:45'),
    (3, 350.00, 350.00, 0.00, 'Payment received', 'payment', '2026-04-18 12:00:00+05:45'),

    -- Krishna Tamang: Rs 600 credit, paid 200, remaining 400
    (4, 600.00, 200.00, 400.00, 'Grocery order - phone order', 'credit', '2026-05-02 15:00:00+05:45'),
    (4, 200.00, 200.00, 0.00, 'Cash payment at shop', 'payment', '2026-05-10 10:30:00+05:45'),

    -- Laxmi Gurung: Rs 900 credit, paid 400, remaining 500
    (5, 900.00, 400.00, 500.00, 'Bulk purchase - shop supplies', 'credit', '2026-04-22 11:00:00+05:45'),
    (5, 400.00, 400.00, 0.00, 'Bank transfer received', 'payment', '2026-05-05 09:00:00+05:45');

-- ============================================================================
-- Sales (sample data for last few days)
-- ============================================================================
INSERT INTO sales (customer_id, total_amount, profit, payment_method, created_at) VALUES
    (NULL, 320.00, 80.00, 'cash', '2026-07-13 08:30:00+05:45'),
    (1, 550.00, 120.00, 'cash', '2026-07-13 09:15:00+05:45'),
    (NULL, 180.00, 45.00, 'esewa', '2026-07-13 10:00:00+05:45'),
    (2, 750.00, 180.00, 'cash', '2026-07-13 11:30:00+05:45'),
    (NULL, 95.00, 25.00, 'cash', '2026-07-12 08:45:00+05:45'),
    (3, 420.00, 95.00, 'khalti', '2026-07-12 10:20:00+05:45'),
    (NULL, 250.00, 60.00, 'cash', '2026-07-12 14:00:00+05:45'),
    (4, 680.00, 150.00, 'cash', '2026-07-11 09:00:00+05:45'),
    (NULL, 150.00, 35.00, 'esewa', '2026-07-11 11:15:00+05:45'),
    (5, 890.00, 200.00, 'bank_transfer', '2026-07-11 15:30:00+05:45'),
    (NULL, 200.00, 50.00, 'cash', '2026-07-10 08:00:00+05:45'),
    (1, 380.00, 85.00, 'cash', '2026-07-10 10:45:00+05:45'),
    (NULL, 120.00, 30.00, 'khalti', '2026-07-10 13:20:00+05:45'),
    (2, 560.00, 130.00, 'cash', '2026-07-09 09:30:00+05:45'),
    (NULL, 75.00, 20.00, 'cash', '2026-07-09 12:00:00+05:45');

-- ============================================================================
-- Sale Items (linking sales to products)
-- ============================================================================

-- Sale 1: Rs 320 - noodles + coke + biscuits
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (1, 1, 5, 20.00, 100.00),   -- Wai Wai x5
    (1, 4, 3, 40.00, 120.00),   -- Coca-Cola x3
    (1, 9, 2, 55.00, 110.00);   -- Good Day x2

-- Sale 2: Rs 550 - butter + cheese + cleaning
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (2, 13, 2, 55.00, 110.00),  -- Amul Butter x2
    (2, 14, 1, 100.00, 100.00), -- Amul Cheese x1
    (2, 17, 2, 99.00, 198.00),  -- Vim x2
    (2, 21, 2, 35.00, 70.00);   -- Patanjali Soap x2

-- Sale 3: Rs 180 - snacks
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (3, 11, 3, 60.00, 180.00);  -- Haldiram Bhujia x3

-- Sale 4: Rs 750 - big order
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (4, 4, 6, 40.00, 240.00),   -- Coca-Cola x6
    (4, 9, 4, 55.00, 220.00),   -- Good Day x4
    (4, 17, 2, 99.00, 198.00),  -- Vim x2
    (4, 27, 2, 46.00, 92.00);   -- Everest Masala x2

-- Sale 5: Rs 95 - quick buy
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (5, 10, 3, 12.00, 36.00),   -- Parle-G x3
    (5, 4, 1, 40.00, 40.00),    -- Coke x1
    (5, 19, 1, 28.00, 28.00);   -- Tata Salt x1  (total 104, adjust)

-- Update sale 5 total to match items
UPDATE sales SET total_amount = 104.00, profit = 28.00 WHERE id = 5;

-- Sale 6: Rs 420 - Gita Sharma
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (6, 21, 4, 35.00, 140.00),  -- Patanjali Soap x4
    (6, 22, 2, 95.00, 190.00),  -- Colgate x2
    (6, 25, 1, 65.00, 65.00);   -- Dove Soap x1
UPDATE sales SET total_amount = 395.00, profit = 89.00 WHERE id = 6;

-- Sale 7: Rs 250 - cash sale
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (7, 1, 5, 20.00, 100.00),   -- Wai Wai x5
    (7, 11, 1, 60.00, 60.00),   -- Haldiram x1
    (7, 10, 2, 12.00, 24.00),   -- Parle-G x2
    (7, 27, 1, 40.00, 40.00);   -- Tata Salt x1  (total 224, adjust)
UPDATE sales SET total_amount = 224.00, profit = 52.00 WHERE id = 7;

-- Sale 8: Rs 680 - Krishna Tamang
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (8, 4, 4, 40.00, 160.00),   -- Coke x4
    (8, 5, 3, 40.00, 120.00),   -- Fanta x3
    (8, 13, 2, 55.00, 110.00),  -- Amul Butter x2
    (8, 16, 3, 65.00, 195.00),  -- Nepal Dairy Milk x3
    (8, 27, 1, 40.00, 40.00);   -- Everest Masala x1
UPDATE sales SET total_amount = 625.00, profit = 140.00 WHERE id = 8;

-- Sale 9: Rs 150
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (9, 10, 5, 12.00, 60.00),   -- Parle-G x5
    (9, 12, 2, 25.00, 50.00),   -- Kurkure x2
    (9, 1, 2, 20.00, 40.00);    -- Wai Wai x2

-- Sale 10: Rs 890 - Laxmi bulk
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES
    (10, 17, 4, 99.00, 396.00), -- Vim x4
    (10, 19, 2, 95.00, 190.00), -- Harpic x2
    (10, 22, 2, 95.00, 190.00), -- Colgate x2
    (10, 27, 2, 40.00, 80.00);  -- Tata Salt x2  (total 856, adjust)
UPDATE sales SET total_amount = 856.00, profit = 190.00 WHERE id = 10;

-- ============================================================================
-- Notifications (sample)
-- ============================================================================
INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES
    (1, 'Low stock: Rum Pung Noodles', 'Rum Pung Instant Noodles has only 5 units left (limit: 15). Consider reordering.', 'low_stock', FALSE, '2026-07-13 08:00:00+05:45'),
    (1, 'Expiring: Nepal Dairy Milk', 'Nepal Dairy Milk expires in 3 days (2026-07-10). Consider discounting.', 'expiring', FALSE, '2026-07-10 08:00:00+05:45'),
    (1, 'Expiring: Yomurt', 'Yomurt expires in 0 days (2026-07-05). Consider discounting or removing.', 'expiring', TRUE, '2026-07-05 08:00:00+05:45'),
    (1, 'Credit due: Hari Prasad', 'Hari Prasad has Rs. 500.00 pending. Follow up for payment.', 'credit_due', FALSE, '2026-07-13 08:00:00+05:45'),
    (1, 'Credit due: Krishna Tamang', 'Krishna Tamang has Rs. 400.00 pending. Follow up for payment.', 'credit_due', FALSE, '2026-07-13 08:00:00+05:45');

-- ============================================================================
-- Settings (sample defaults)
-- ============================================================================
INSERT INTO settings (user_id, key, value) VALUES
    (1, 'currency', 'NPR'),
    (1, 'shop_name', 'Shrestha Kirana Store'),
    (1, 'low_stock_alert', 'true'),
    (1, 'expiry_alert_days', '30'),
    (1, 'receipt_footer', 'Thank you for shopping at Shrestha Kirana Store!'),
    (1, 'tax_rate', '0'),
    (1, 'default_payment_method', 'cash');
