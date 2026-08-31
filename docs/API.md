# API Documentation

Base URL: `http://localhost:8000`

## Authentication

All protected endpoints require a JWT token in the header:

```
Authorization: Bearer <your-token>
```

Get a token via login/register endpoints.

---

## Auth Endpoints

### Register
```
POST /api/auth/register
Body: { "name": "string", "phone": "string", "password": "string", "shop_name": "string" }
Response: { "access_token": "string", "token_type": "bearer" }
```

### Login
```
POST /api/auth/login
Body: { "phone": "string", "password": "string" }
Response: { "access_token": "string", "token_type": "bearer" }
```

### Get Current User
```
GET /api/auth/me
Response: { "id": 1, "name": "string", "phone": "string", "shop_name": "string" }
```

---

## Product Endpoints

### List Products
```
GET /api/products?search=query&category=Groceries
Response: [{ "id": 1, "name": "Wai Wai", "category": "Groceries", ... }]
```

### Get Product
```
GET /api/products/{id}
Response: { "id": 1, "name": "Wai Wai", ... }
```

### Create Product
```
POST /api/products
Body: { "name": "string", "category": "string", "buying_price": 10, "selling_price": 15, "quantity": 100 }
Response: { "id": 1, ... }
```

### Update Product
```
PUT /api/products/{id}
Body: { "name": "string", ... }
Response: { "id": 1, ... }
```

### Delete Product
```
DELETE /api/products/{id}
Response: 204 No Content
```

### Search Products
```
GET /api/products/search?q=noodles
Response: [{ "id": 1, "name": "Wai Wai Noodles", ... }]
```

### Low Stock Products
```
GET /api/products/low-stock
Response: [{ "id": 1, "name": "Coke", "quantity": 2, "low_stock_limit": 10 }]
```

### Expiring Products
```
GET /api/products/expiring
Response: [{ "id": 1, "name": "Milk", "expiry_date": "2026-07-20" }]
```

---

## Sales Endpoints

### List Sales
```
GET /api/sales?start=2026-07-01&end=2026-07-13
Response: [{ "id": 1, "total_amount": 500, "profit": 100, ... }]
```

### Create Sale
```
POST /api/sales
Body: {
  "customer_id": 1,
  "payment_method": "cash",
  "items": [{ "product_id": 1, "quantity": 2 }]
}
Response: { "id": 1, "total_amount": 30, "profit": 10, ... }
```

### Today's Summary
```
GET /api/sales/today
Response: { "total_sales": 5000, "total_profit": 1200, "order_count": 15 }
```

### Weekly Summary
```
GET /api/sales/weekly
Response: [{ "date": "2026-07-07", "total": 4500 }, ...]
```

### Top Products
```
GET /api/sales/top-products
Response: [{ "product_id": 1, "name": "Wai Wai", "total_sold": 50 }]
```

---

## Customer (Khata) Endpoints

### List Customers
```
GET /api/customers?search=ram
Response: [{ "id": 1, "name": "Ram", "phone": "9841000000", "pending_credit": 1500 }]
```

### Create Customer
```
POST /api/customers
Body: { "name": "string", "phone": "string", "address": "string" }
Response: { "id": 1, ... }
```

### Get Customer
```
GET /api/customers/{id}
Response: { "id": 1, "name": "Ram", "phone": "9841000000", "pending_credit": 1500 }
```

### Credit History
```
GET /api/customers/{id}/credits
Response: [{ "id": 1, "amount": 500, "paid": 0, "remaining": 500, "type": "credit", "date": "..." }]
```

### Add Credit
```
POST /api/customers/{id}/credits
Body: { "amount": 500, "notes": "Rice and oil" }
Response: { "id": 1, ... }
```

### Add Payment
```
POST /api/customers/{id}/payments
Body: { "amount": 300, "notes": "Partial payment" }
Response: { "id": 1, ... }
```

### Overdue Customers
```
GET /api/customers/overdue
Response: [{ "id": 1, "name": "Ram", "pending_credit": 1500 }]
```

---

## Dashboard Endpoints

### Today's Summary
```
GET /api/dashboard
Response: {
  "today_sales": 5000,
  "today_profit": 1200,
  "low_stock_count": 5,
  "pending_credit": 8500
}
```

### Weekly Stats
```
GET /api/dashboard/weekly
Response: [{ "date": "2026-07-07", "sales": 4500, "profit": 900 }, ...]
```

---

## Reports Endpoints

### Daily Report
```
GET /api/reports/daily?date=2026-07-13
Response: { "date": "2026-07-13", "sales": 5000, "profit": 1200, "items_sold": 45 }
```

### Export Excel
```
GET /api/reports/export/excel
Response: Excel file download
```

### Export PDF
```
GET /api/reports/export/pdf
Response: PDF file download
```

---

## Notifications

### List Notifications
```
GET /api/notifications
Response: [{ "id": 1, "title": "Low Stock", "message": "Coke is running low", "type": "low_stock", "is_read": false }]
```

### Mark as Read
```
PUT /api/notifications/{id}/read
Response: 200 OK
```

### Check for Alerts
```
POST /api/notifications/check
Response: { "new_notifications": 3 }
```

---

## Barcode Endpoints

### Generate Barcode
```
GET /api/barcode/{product_id}
Response: PNG image of barcode
```

### Scan Barcode
```
POST /api/barcode/scan
Body: { "barcode": "6291041500213" }
Response: { "id": 1, "name": "Coca Cola", "price": 20, "quantity": 50 }
```

---

## Assistant

### Chat
```
POST /api/assistant/chat
Body: { "message": "How much profit today?" }
Response: { "response": "Today you made Rs. 5000 in sales with Rs. 1200 profit. Great day!" }
```

---

## Settings

### Get Settings
```
GET /api/settings
Response: { "shop_name": "Ram's Kirana", "language": "en", "dark_mode": false }
```

### Update Settings
```
PUT /api/settings
Body: { "shop_name": "Ram's Kirana", "dark_mode": true }
Response: { "shop_name": "Ram's Kirana", "dark_mode": true }
```

---

## Error Responses

```json
{
  "detail": "Product not found"
}
```

Status codes:
- `400` — Bad request
- `401` — Unauthorized
- `404` — Not found
- `422` — Validation error
- `500` — Server error
