"""
Export the shop's data (products, customers, khata, sales) to Excel and PDF.

Usage:
    DATABASE_URL=<postgres-connection-string> python export_data.py [out-dir]

Writes kirana-data.xlsx and kirana-data.pdf into the given directory
(default: current directory).
"""

import os
import sys
from datetime import datetime

import psycopg2

# Column sets per sheet: (table, title, sql, columns)
EXCEL_SHEETS = [
    (
        "Products",
        "Products",
        "SELECT id, name, category, brand, buying_price, selling_price, quantity, "
        "shelf_number, barcode, expiry_date, low_stock_limit, created_at "
        "FROM products ORDER BY name",
        ["ID", "Name", "Category", "Brand", "Buying (Rs.)", "Selling (Rs.)", "Qty",
         "Shelf", "Barcode", "Expiry", "Low Stock Limit", "Created"],
    ),
    (
        "Customers",
        "Customers",
        "SELECT id, name, phone, address, created_at FROM customers ORDER BY name",
        ["ID", "Name", "Phone", "Address", "Created"],
    ),
    (
        "Khata (Credit Entries)",
        "Khata",
        "SELECT ce.id, c.name AS customer, ce.amount, ce.paid, ce.remaining, ce.notes, "
        "ce.entry_type, ce.created_at FROM credit_entries ce "
        "LEFT JOIN customers c ON c.id = ce.customer_id ORDER BY ce.created_at",
        ["ID", "Customer", "Amount (Rs.)", "Paid (Rs.)", "Remaining (Rs.)", "Notes", "Type", "Date"],
    ),
    (
        "Sales",
        "Sales",
        "SELECT id, customer_id, total_amount, profit, payment_method, created_at "
        "FROM sales ORDER BY created_at",
        ["ID", "Customer ID", "Total (Rs.)", "Profit (Rs.)", "Payment", "Date"],
    ),
    (
        "Sale Items",
        "Sale Items",
        "SELECT id, sale_id, product_id, product_name, cost_price, quantity, unit_price, "
        "total_price FROM sale_items ORDER BY sale_id, id",
        ["ID", "Sale ID", "Product ID", "Product", "Cost (Rs.)", "Qty", "Unit Price (Rs.)", "Total (Rs.)"],
    ),
    (
        "Users",
        "Users",
        "SELECT id, name, phone, shop_name, role, created_at FROM users ORDER BY id",
        ["ID", "Name", "Phone", "Shop", "Role", "Created"],
    ),
]


def fmt(value):
    if value is None:
        return ""
    if isinstance(value, (datetime,)):
        return value.strftime("%Y-%m-%d %H:%M")
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, float):
        return round(value, 2)
    return value


def fetch_rows(conn, sql):
    cur = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    cur.close()
    return rows


def export_excel(conn, out_dir):
    from openpyxl import Workbook
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    wb.remove(wb.active)

    for sheet_name, _, sql, headers in EXCEL_SHEETS:
        rows = fetch_rows(conn, sql)
        ws = wb.create_sheet(title=sheet_name[:31])
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)
        for row in rows:
            ws.append([fmt(v) for v in row])
        # Approximate column widths.
        for idx, header in enumerate(headers, start=1):
            width = max(len(str(header)), 10)
            for row in rows:
                val = row[idx - 1]
                if val is not None:
                    width = max(width, min(len(str(val)), 40))
            ws.column_dimensions[get_column_letter(idx)].width = width + 2

    path = os.path.join(out_dir, "kirana-data.xlsx")
    wb.save(path)
    print(f"Excel written: {path}")
    return path


def export_pdf(conn, out_dir):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                    Table, TableStyle)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18)
    small = ParagraphStyle("Small2", parent=styles["BodyText"], fontSize=8, leading=10)

    doc = SimpleDocTemplate(
        os.path.join(out_dir, "kirana-data.pdf"),
        pagesize=landscape(A4),
        leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=12 * mm, bottomMargin=12 * mm,
        title="Kirana Smart Assistant - Data Export",
    )
    story = [Paragraph("Kirana Smart Assistant — Data Export", title_style),
             Paragraph(f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} — "
                       f"from {os.environ.get('DATABASE_URL', '').split('@')[-1] or 'database'}", small),
             Spacer(1, 6 * mm)]

    for _, title, sql, headers in EXCEL_SHEETS:
        rows = fetch_rows(conn, sql)
        story.append(Paragraph(f"{title} ({len(rows)} rows)", styles["Heading2"]))
        data = [[Paragraph(str(h), small) for h in headers]]
        for row in rows[:200]:  # cap very long tables per page section
            data.append([Paragraph(str(fmt(v)), small) for v in row])
        if len(rows) > 200:
            data.append([Paragraph(f"... and {len(rows) - 200} more", small)])
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7c5cff")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f1ff")]),
        ]))
        story.append(table)
        story.append(Spacer(1, 6 * mm))

    path = os.path.join(out_dir, "kirana-data.pdf")
    doc.build(story)
    print(f"PDF written: {path}")
    return path


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Set DATABASE_URL and try again.")
        sys.exit(1)
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out_dir, exist_ok=True)

    conn = psycopg2.connect(url, connect_timeout=30)
    try:
        export_excel(conn, out_dir)
        export_pdf(conn, out_dir)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
