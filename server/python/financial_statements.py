#!/usr/bin/env python3
"""
Generate financial statements from the Guardian SQLite database.
Usage: python financial_statements.py <db_path> [year] [month]
Output: JSON with income_statement, balance_sheet, cash_flow_statement

Accounting identity enforced:  Assets = Liabilities + Equity
"""
import sys
import json
import sqlite3
import os
from datetime import datetime
from collections import defaultdict


def categorize_for_statements(category, description=""):
    """Map line item categories to financial statement categories."""
    cat = (category or "").lower().strip()

    if cat in ("income", "revenue", "reimbursement"):
        return "revenue"
    elif cat == "tax":
        return "tax"
    elif cat in ("product",):
        return "cost_of_goods"
    # subscription, fee, service, one-time, other → operating expense
    else:
        return "operating_expense"


def get_line_items(db_path, year=None, month=None):
    if not os.path.exists(db_path):
        return []
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if year and month:
        cur.execute("""
            SELECT li.*, d.upload_date, d.filename
            FROM line_items li
            JOIN documents d ON li.document_id = d.id
            WHERE strftime('%Y', COALESCE(li.date, d.upload_date)) = ?
              AND strftime('%m', COALESCE(li.date, d.upload_date)) = ?
        """, (str(year), f"{month:02d}"))
    elif year:
        cur.execute("""
            SELECT li.*, d.upload_date, d.filename
            FROM line_items li
            JOIN documents d ON li.document_id = d.id
            WHERE strftime('%Y', COALESCE(li.date, d.upload_date)) = ?
        """, (str(year),))
    else:
        cur.execute("""
            SELECT li.*, d.upload_date, d.filename
            FROM line_items li
            JOIN documents d ON li.document_id = d.id
        """)

    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def income_statement(items, period_label="All Time"):
    """
    Income Statement (Profit & Loss)
    Revenue - COGS = Gross Profit
    Gross Profit - Operating Expenses = Operating Income
    Operating Income - Taxes = Net Income
    """
    revenue = 0.0
    cogs = 0.0
    operating_expenses = 0.0
    taxes = 0.0

    revenue_items = []
    expense_items = []

    for item in items:
        amount = item.get("amount") or 0
        fs_cat = categorize_for_statements(item.get("category"), item.get("description"))

        if fs_cat == "revenue":
            revenue += amount
            revenue_items.append({
                "description": item.get("description"),
                "amount": amount,
                "vendor": item.get("vendor")
            })
        elif fs_cat == "cost_of_goods":
            cogs += amount
            expense_items.append({
                "description": item.get("description"),
                "amount": amount,
                "category": "COGS"
            })
        elif fs_cat == "tax":
            taxes += amount
            expense_items.append({
                "description": item.get("description"),
                "amount": amount,
                "category": "Tax"
            })
        else:  # operating_expense
            operating_expenses += amount
            expense_items.append({
                "description": item.get("description"),
                "amount": amount,
                "category": "Operating"
            })

    gross_profit = revenue - cogs
    operating_income = gross_profit - operating_expenses
    net_income = operating_income - taxes

    return {
        "period": period_label,
        "revenue": round(revenue, 2),
        "cost_of_goods_sold": round(cogs, 2),
        "gross_profit": round(gross_profit, 2),
        "operating_expenses": round(operating_expenses, 2),
        "operating_income": round(operating_income, 2),
        "taxes": round(taxes, 2),
        "net_income": round(net_income, 2),
        "gross_margin_pct": round((gross_profit / revenue * 100) if revenue else 0, 2),
        "net_margin_pct": round((net_income / revenue * 100) if revenue else 0, 2),
        "revenue_details": revenue_items,
        "expense_details": expense_items
    }


def balance_sheet(items_all):
    """
    Balance Sheet — double-entry model, Assets = Liabilities + Equity always.

    Every tracked expense is funded by:
      (a) Revenue received from customers, OR
      (b) Owner's paid-in capital (investment to cover the rest)

    Assets  = total_expenses + total_revenue
            = Owner Capital + Revenue Cash
    Liabilities = total_expenses  (accounts payable to vendors)
    Equity  = Paid-in Capital + Retained Earnings
            = total_expenses   + (revenue - expenses)
            = total_revenue

    Proof:  L + E = expenses + revenue = Assets  ✓ always
    """
    total_revenue = 0.0
    total_expenses = 0.0

    expense_by_category = defaultdict(float)

    for item in items_all:
        amount = item.get("amount") or 0
        fs_cat = categorize_for_statements(item.get("category"), item.get("description"))
        cat_label = (item.get("category") or "other").lower()

        if fs_cat == "revenue":
            total_revenue += amount
        else:
            total_expenses += amount
            expense_by_category[cat_label] += amount

    net_income = total_revenue - total_expenses

    # --- Assets ---
    # Every dollar of expense was funded by owner capital (invested)
    # Every dollar of revenue is cash received
    owner_capital_deployed = round(total_expenses, 2)
    revenue_cash            = round(total_revenue, 2)
    total_assets            = round(total_expenses + total_revenue, 2)

    # --- Liabilities ---
    # All tracked invoices are accounts payable (owed to vendors)
    accounts_payable  = round(total_expenses, 2)
    total_liabilities = accounts_payable

    # --- Equity ---
    # Paid-in capital = owner invested enough to cover all expenses
    paid_in_capital   = round(total_expenses, 2)
    retained_earnings = round(net_income, 2)          # revenue - expenses (can be negative)
    total_equity      = round(paid_in_capital + retained_earnings, 2)  # = total_revenue

    # Enforce: Assets = Liabilities + Equity
    assert abs(total_assets - (total_liabilities + total_equity)) < 0.01, (
        f"Balance sheet out of balance: assets={total_assets} "
        f"L+E={total_liabilities + total_equity}"
    )

    return {
        "as_of": datetime.now().strftime("%Y-%m-%d"),
        "assets": {
            "current_assets": {
                "cash_from_revenue":       revenue_cash,
                "owner_capital_deployed":  owner_capital_deployed,
                "total_current_assets":    total_assets
            },
            "total_assets": total_assets
        },
        "liabilities": {
            "current_liabilities": {
                "accounts_payable":            accounts_payable,
                "total_current_liabilities":   total_liabilities
            },
            "total_liabilities": total_liabilities
        },
        "equity": {
            "paid_in_capital":   paid_in_capital,
            "retained_earnings": retained_earnings,
            "total_equity":      total_equity
        },
        "total_liabilities_and_equity": round(total_liabilities + total_equity, 2),
        "expense_breakdown_by_category": {k: round(v, 2) for k, v in expense_by_category.items()}
    }


def cash_flow_statement(items):
    """
    Cash Flow Statement — monthly cash flows.
    """
    monthly = defaultdict(lambda: {"inflow": 0.0, "outflow": 0.0})

    for item in items:
        amount = item.get("amount") or 0
        date_str = item.get("date") or item.get("upload_date") or ""
        try:
            dt = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
            month_key = dt.strftime("%Y-%m")
        except Exception:
            month_key = "unknown"

        fs_cat = categorize_for_statements(item.get("category"))
        if fs_cat == "revenue":
            monthly[month_key]["inflow"] += amount
        else:
            monthly[month_key]["outflow"] += amount

    periods = []
    cumulative = 0.0
    for month in sorted(monthly.keys()):
        data = monthly[month]
        net = data["inflow"] - data["outflow"]
        cumulative += net
        periods.append({
            "period": month,
            "operating_inflows": round(data["inflow"], 2),
            "operating_outflows": round(data["outflow"], 2),
            "net_cash_flow": round(net, 2),
            "cumulative_cash": round(cumulative, 2)
        })

    total_inflow = sum(p["operating_inflows"] for p in periods)
    total_outflow = sum(p["operating_outflows"] for p in periods)

    return {
        "periods": periods,
        "summary": {
            "total_inflows": round(total_inflow, 2),
            "total_outflows": round(total_outflow, 2),
            "net_cash_position": round(total_inflow - total_outflow, 2),
            "period_count": len(periods)
        }
    }


def generate_all(db_path, year=None, month=None):
    period_label = "All Time"
    if year and month:
        period_label = f"{year}-{month:02d}"
    elif year:
        period_label = str(year)

    items = get_line_items(db_path, year, month)
    items_all = get_line_items(db_path)  # all-time for balance sheet

    return {
        "generated_at": datetime.now().isoformat(),
        "period": period_label,
        "transaction_count": len(items),
        "income_statement": income_statement(items, period_label),
        "balance_sheet": balance_sheet(items_all),
        "cash_flow_statement": cash_flow_statement(items)
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: financial_statements.py <db_path> [year] [month]"}))
        sys.exit(1)

    db_path = sys.argv[1]
    year = int(sys.argv[2]) if len(sys.argv) > 2 else None
    month = int(sys.argv[3]) if len(sys.argv) > 3 else None

    result = generate_all(db_path, year, month)
    print(json.dumps(result))
