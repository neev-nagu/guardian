#!/usr/bin/env python3
"""
Linear regression forecast for monthly revenue and expenses.
Input: JSON {historical: [{month, revenue, expenses}], forecast_months: N}
Output: JSON {forecast: [{month, revenue, expenses, net, is_forecast, confidence}]}
"""
import sys
import json
import numpy as np
from datetime import datetime, timedelta
from calendar import monthrange


def next_month(ym_str):
    """Given 'YYYY-MM', return the next month as 'YYYY-MM'."""
    y, m = int(ym_str[:4]), int(ym_str[5:7])
    m += 1
    if m > 12:
        m = 1
        y += 1
    return f"{y:04d}-{m:02d}"


def linear_forecast(values, n_future):
    """
    Fit a linear regression on values and return n_future predicted values.
    Returns (predictions, lower_bound, upper_bound).
    """
    n = len(values)
    if n == 0:
        return [0.0] * n_future, [0.0] * n_future, [0.0] * n_future

    x = np.arange(n, dtype=float)
    y = np.array(values, dtype=float)

    if n == 1:
        slope, intercept = 0.0, y[0]
        std_err = 0.0
    else:
        # Least-squares fit
        A = np.vstack([x, np.ones(n)]).T
        result = np.linalg.lstsq(A, y, rcond=None)
        slope, intercept = result[0]
        residuals = y - (slope * x + intercept)
        std_err = np.std(residuals) if len(residuals) > 1 else 0.0

    x_future = np.arange(n, n + n_future, dtype=float)
    preds = slope * x_future + intercept

    # 90% confidence interval (~1.645 sigma)
    margin = std_err * 1.645
    lower = preds - margin
    upper = preds + margin

    # Floor at 0 (can't have negative revenue/expenses in most cases)
    preds = np.maximum(preds, 0)
    lower = np.maximum(lower, 0)

    return preds.tolist(), lower.tolist(), upper.tolist()


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    data = json.loads(sys.argv[1])
    historical = data.get("historical", [])
    forecast_months = int(data.get("forecast_months", 6))

    if not historical:
        print(json.dumps({"forecast": [], "historical": [], "error": "No historical data"}))
        return

    months = [h["month"] for h in historical]
    revenues = [h.get("revenue", 0) for h in historical]
    expenses = [h.get("expenses", 0) for h in historical]

    rev_pred, rev_lo, rev_hi = linear_forecast(revenues, forecast_months)
    exp_pred, exp_lo, exp_hi = linear_forecast(expenses, forecast_months)

    # Calculate R² for confidence display
    def r_squared(actual, predicted_fn, slope, intercept):
        if len(actual) < 2:
            return 1.0
        n = len(actual)
        x = np.arange(n, dtype=float)
        y = np.array(actual, dtype=float)
        y_pred = slope * x + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        return float(1 - ss_res / ss_tot) if ss_tot > 0 else 1.0

    # Build output: historical (actual) + forecast
    output_historical = []
    for i, h in enumerate(historical):
        output_historical.append({
            "month": h["month"],
            "revenue": round(h.get("revenue", 0), 2),
            "expenses": round(h.get("expenses", 0), 2),
            "net": round((h.get("revenue", 0) - h.get("expenses", 0)), 2),
            "is_forecast": False,
        })

    last_month = months[-1] if months else datetime.now().strftime("%Y-%m")
    forecast = []
    for i in range(forecast_months):
        last_month = next_month(last_month)
        rev = round(max(rev_pred[i], 0), 2)
        exp = round(max(exp_pred[i], 0), 2)
        forecast.append({
            "month": last_month,
            "revenue": rev,
            "expenses": exp,
            "net": round(rev - exp, 2),
            "revenue_lo": round(max(rev_lo[i], 0), 2),
            "revenue_hi": round(rev_hi[i], 2),
            "expenses_lo": round(max(exp_lo[i], 0), 2),
            "expenses_hi": round(exp_hi[i], 2),
            "is_forecast": True,
        })

    print(json.dumps({
        "historical": output_historical,
        "forecast": forecast,
        "model_info": {
            "method": "linear_regression",
            "training_months": len(historical),
            "forecast_months": forecast_months,
        }
    }))


if __name__ == "__main__":
    main()
