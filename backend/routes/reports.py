"""
Report routes for Kirana Smart Assistant.
Daily, weekly, monthly reports with Excel and PDF export.
"""

from datetime import datetime, timedelta, date
from typing import Optional
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.models import Product, Sale, SaleItem, User
from routes.auth import get_current_user_dep

router = APIRouter()


def _build_report_data(db: Session, user_id: int, start: datetime, end: datetime):
    """Build detailed report rows for a date range."""
    rows = (
        db.query(
            Sale.id.label("sale_id"),
            Sale.created_at.label("sale_date"),
            func.coalesce(SaleItem.product_name, Product.name, "Deleted product").label("product_name"),
            SaleItem.quantity,
            SaleItem.unit_price,
            SaleItem.total_price,
            func.coalesce(SaleItem.cost_price, Product.buying_price, 0.0).label("cost_price"),
        )
        .join(SaleItem, Sale.id == SaleItem.sale_id)
        .outerjoin(Product, SaleItem.product_id == Product.id)
        .filter(
            Sale.user_id == user_id,
            Sale.created_at >= start,
            Sale.created_at < end,
        )
        .order_by(Sale.created_at.desc())
        .all()
    )

    items = []
    total_sales = 0.0
    total_profit = 0.0

    for r in rows:
        profit = (r.unit_price - r.cost_price) * r.quantity
        items.append({
            "sale_id": r.sale_id,
            "date": r.sale_date.strftime("%Y-%m-%d %H:%M"),
            "product_name": r.product_name,
            "quantity": r.quantity,
            "unit_price": r.unit_price,
            "total": r.total_price,
            "profit": round(profit, 2),
        })
        total_sales += r.total_price
        total_profit += profit

    return {
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "total_sales": round(total_sales, 2),
        "total_profit": round(total_profit, 2),
        "item_count": len(items),
        "sale_count": len({item["sale_id"] for item in items}),
        "items": items,
    }


@router.get("/daily")
async def daily_report(
    date_param: Optional[str] = Query(None, alias="date", description="Date YYYY-MM-DD (default: today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Get a detailed report for a single day."""
    if date_param:
        try:
            target = datetime.strptime(date_param, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    else:
        target = date.today()

    start = datetime.combine(target, datetime.min.time())
    end = datetime.combine(target + timedelta(days=1), datetime.min.time())
    return _build_report_data(db, current_user.id, start, end)


@router.get("/weekly")
async def weekly_report(
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Get a report for a custom date range (default: last 7 days)."""
    today = date.today()
    try:
        sd = datetime.strptime(start, "%Y-%m-%d") if start else datetime.combine(today - timedelta(days=6), datetime.min.time())
        ed = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1) if end else datetime.combine(today + timedelta(days=1), datetime.min.time())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    return _build_report_data(db, current_user.id, sd, ed)


@router.get("/monthly")
async def monthly_report(
    month: Optional[int] = Query(None, ge=1, le=12, description="Month 1-12"),
    year: Optional[int] = Query(None, ge=2020, le=2099, description="Year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Get a report for a specific month (default: current month)."""
    today = date.today()
    m = month or today.month
    y = year or today.year

    start = datetime(y, m, 1)
    if m == 12:
        end = datetime(y + 1, 1, 1)
    else:
        end = datetime(y, m + 1, 1)

    return _build_report_data(db, current_user.id, start, end)


@router.get("/export/excel")
async def export_excel(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Export sales report as an Excel (.xlsx) file."""
    try:
        from openpyxl import Workbook
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    today = date.today()
    try:
        sd = datetime.strptime(start, "%Y-%m-%d") if start else datetime.combine(today - timedelta(days=6), datetime.min.time())
        ed = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1) if end else datetime.combine(today + timedelta(days=1), datetime.min.time())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    report = _build_report_data(db, current_user.id, sd, ed)

    wb = Workbook()
    ws = wb.active
    ws.title = "Sales Report"

    # Header
    ws.append(["Date", "Product", "Quantity", "Unit Price", "Total", "Profit"])
    ws.append([
        f"Report: {report['start_date']} to {report['end_date']}",
        "", "", "", "", "",
    ])
    ws.append([])

    for item in report["items"]:
        ws.append([
            item["date"],
            item["product_name"],
            item["quantity"],
            item["unit_price"],
            item["total"],
            item["profit"],
        ])

    ws.append([])
    ws.append(["", "", "", "TOTAL", report["total_sales"], report["total_profit"]])

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"sales_report_{report['start_date']}_to_{report['end_date']}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/pdf")
async def export_pdf(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """Export sales report as a PDF file."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed")

    today = date.today()
    try:
        sd = datetime.strptime(start, "%Y-%m-%d") if start else datetime.combine(today - timedelta(days=6), datetime.min.time())
        ed = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1) if end else datetime.combine(today + timedelta(days=1), datetime.min.time())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    report = _build_report_data(db, current_user.id, sd, ed)

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    elements.append(Paragraph(f"Kirana Sales Report", styles["Title"]))
    elements.append(Paragraph(f"{report['start_date']} to {report['end_date']}", styles["Normal"]))
    elements.append(Spacer(1, 12))

    # Summary
    elements.append(Paragraph(f"Total Sales: Rs. {report['total_sales']:,.2f}", styles["Normal"]))
    elements.append(Paragraph(f"Total Profit: Rs. {report['total_profit']:,.2f}", styles["Normal"]))
    elements.append(Paragraph(f"Transactions: {report['item_count']}", styles["Normal"]))
    elements.append(Spacer(1, 12))

    # Table
    data = [["Date", "Product", "Qty", "Price", "Total", "Profit"]]
    for item in report["items"]:
        data.append([
            item["date"][:10],
            item["product_name"][:30],
            str(item["quantity"]),
            f"{item['unit_price']:.0f}",
            f"{item['total']:.0f}",
            f"{item['profit']:.0f}",
        ])

    table = Table(data, colWidths=[70, 150, 40, 50, 60, 60])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]))
    elements.append(table)

    doc.build(elements)
    buffer.seek(0)

    filename = f"sales_report_{report['start_date']}_to_{report['end_date']}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
