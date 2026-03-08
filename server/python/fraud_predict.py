#!/usr/bin/env python3
"""
Fraud prediction using the trained Random Forest model (fraud_model.pkl).
Usage: python fraud_predict.py '<json_string>'
Input JSON keys map to invoice/supplier/behavior/department fields.
Output: JSON { "prediction": 0|1, "probability": 0.0-1.0, "is_fraud": bool }
"""
import sys
import json
import os
import warnings
warnings.filterwarnings('ignore')

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'fraud_model.pkl')

FEATURE_ORDER = [
    "invoice_amount", "currency", "payment_terms", "invoice_type",
    "submission_hour", "image_path", "supplier_invoice_count_30d",
    "supplier_avg_amount_90d", "invoice_amount_zscore", "duplicate_invoice_flag",
    "split_invoice_flag", "late_night_submission_flag", "supplier_country",
    "supplier_age_days", "supplier_risk_score", "blacklisted_flag",
    "avg_invoice_amount", "region", "annual_budget", "invoice_date_year",
    "invoice_date_month", "invoice_date_day", "invoice_date_weekday"
]

# Encoding maps (mirror the training label encoding)
CURRENCY_MAP = {"USD": 0, "EUR": 1, "GBP": 2, "CAD": 3, "AUD": 4, "JPY": 5, "CNY": 6}
PAYMENT_TERMS_MAP = {"net30": 0, "net60": 1, "net90": 2, "immediate": 3, "cod": 4}
INVOICE_TYPE_MAP = {"standard": 0, "pro_forma": 1, "commercial": 2, "credit": 3, "debit": 4}
COUNTRY_MAP = {"US": 0, "GB": 1, "CA": 2, "AU": 3, "DE": 4, "FR": 5, "CN": 6, "IN": 7}
REGION_MAP = {"north_america": 0, "europe": 1, "asia_pacific": 2, "latin_america": 3, "middle_east": 4, "africa": 5}


def preprocess(data):
    import pandas as pd

    # Parse invoice_date
    if "invoice_date" in data:
        try:
            dt = pd.to_datetime(data["invoice_date"], errors="coerce")
            if pd.notnull(dt):
                data["invoice_date_year"] = int(dt.year)
                data["invoice_date_month"] = int(dt.month)
                data["invoice_date_day"] = int(dt.day)
                data["invoice_date_weekday"] = int(dt.weekday())
            else:
                data.setdefault("invoice_date_year", 2024)
                data.setdefault("invoice_date_month", 1)
                data.setdefault("invoice_date_day", 1)
                data.setdefault("invoice_date_weekday", 0)
        except Exception:
            pass

    # Encode string categoricals
    if "currency" in data and isinstance(data["currency"], str):
        data["currency"] = CURRENCY_MAP.get(data["currency"].upper(), 0)
    if "payment_terms" in data and isinstance(data["payment_terms"], str):
        data["payment_terms"] = PAYMENT_TERMS_MAP.get(data["payment_terms"].lower(), 0)
    if "invoice_type" in data and isinstance(data["invoice_type"], str):
        data["invoice_type"] = INVOICE_TYPE_MAP.get(data["invoice_type"].lower(), 0)
    if "supplier_country" in data and isinstance(data["supplier_country"], str):
        data["supplier_country"] = COUNTRY_MAP.get(data["supplier_country"].upper(), 0)
    if "region" in data and isinstance(data["region"], str):
        data["region"] = REGION_MAP.get(data["region"].lower(), 0)

    # Booleans to int
    for key in list(data.keys()):
        if isinstance(data[key], bool):
            data[key] = int(data[key])

    # Fill missing features with 0
    for feat in FEATURE_ORDER:
        if feat not in data:
            data[feat] = 0

    X = pd.DataFrame([data])[FEATURE_ORDER]
    return X


def predict(input_data):
    try:
        import joblib
    except ImportError:
        return {"error": "joblib not installed"}

    if not os.path.exists(MODEL_PATH):
        return {"error": f"Model not found at {MODEL_PATH}"}

    try:
        model = joblib.load(MODEL_PATH)
    except Exception as e:
        return {"error": f"Failed to load model: {e}"}

    try:
        X = preprocess(input_data)
        pred = int(model.predict(X)[0])
        prob = float(model.predict_proba(X)[0][1])

        return {
            "prediction": pred,
            "probability": round(prob, 4),
            "is_fraud": pred == 1
        }
    except Exception as e:
        return {"error": f"Prediction failed: {e}"}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: fraud_predict.py json_string"}))
        sys.exit(1)

    try:
        data = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    result = predict(data)
    print(json.dumps(result))
