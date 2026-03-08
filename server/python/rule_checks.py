#!/usr/bin/env python3
"""
Rule-based fraud checks including Benford's Law analysis.
Usage: python rule_checks.py '<json_string>'
Input JSON:
{
  "document": { "total": 0, "subtotal": 0, "tax": 0, "vendor": "", "date": "", "document_type": "" },
  "line_items": [{ "amount": 0, "description": "", "vendor": "", "date": "" }],
  "historical_amounts": [0.0, ...]
}
Output: JSON array of check results
"""
import sys
import json
import re
from collections import Counter
from datetime import datetime


# ---------------------------------------------------------------------------
# Benford's Law
# ---------------------------------------------------------------------------
BENFORD_EXPECTED = {
    1: 0.30103, 2: 0.17609, 3: 0.12494, 4: 0.09691,
    5: 0.07918, 6: 0.06695, 7: 0.05799, 8: 0.05115, 9: 0.04576
}

def get_leading_digit(n):
    if n <= 0:
        return None
    s = f"{abs(n):.10f}".replace('.', '').lstrip('0')
    return int(s[0]) if s else None

def benford_analysis(amounts):
    digits = [get_leading_digit(a) for a in amounts if a and a > 0]
    digits = [d for d in digits if d is not None]

    if len(digits) < 10:
        return {
            "check": "benford_law",
            "passed": True,
            "severity": "info",
            "details": f"Only {len(digits)} valid amounts — Benford's requires at least 10 data points.",
            "chi_square": None,
            "leading_digit_dist": {},
            "expected_dist": BENFORD_EXPECTED
        }

    n = len(digits)
    observed = Counter(digits)

    chi_sq = 0.0
    digit_report = {}
    for d in range(1, 10):
        obs = observed.get(d, 0)
        exp = BENFORD_EXPECTED[d] * n
        chi_sq += ((obs - exp) ** 2) / exp if exp > 0 else 0
        digit_report[str(d)] = {
            "observed": obs,
            "observed_pct": round(obs / n * 100, 2),
            "expected_pct": round(BENFORD_EXPECTED[d] * 100, 2)
        }

    CRITICAL_VALUE = 15.507  # p=0.05, df=8
    passed = chi_sq <= CRITICAL_VALUE

    return {
        "check": "benford_law",
        "passed": passed,
        "severity": "high" if not passed else "info",
        "chi_square": round(chi_sq, 4),
        "critical_value": CRITICAL_VALUE,
        "sample_size": n,
        "details": (
            f"Benford's Law chi-square: {chi_sq:.2f} (critical: {CRITICAL_VALUE}). "
            + ("ANOMALY DETECTED — digit distribution deviates significantly from natural patterns, suggesting possible fabricated amounts."
               if not passed else
               "Digit distribution follows natural Benford's Law pattern.")
        ),
        "leading_digit_dist": digit_report,
        "expected_dist": {str(k): round(v * 100, 2) for k, v in BENFORD_EXPECTED.items()}
    }


# ---------------------------------------------------------------------------
# Math / totals check — validates subtotal, tax, total chain
# ---------------------------------------------------------------------------
def math_check(document, line_items):
    """
    Validates:
      1. Line items sum ≈ subtotal (if provided) or total
      2. subtotal + tax ≈ total (if all three present)
      3. Flags the exact discrepancy amount
    """
    total   = document.get("total")
    subtotal = document.get("subtotal")
    tax_amt  = document.get("tax")

    amounts = [item.get("amount") or 0 for item in line_items if item.get("amount") is not None]
    line_sum = round(sum(amounts), 2)

    issues = []
    details_parts = []

    tolerance = 0.02  # 2-cent rounding tolerance

    # Check 1: line items → subtotal or total
    if subtotal is not None and amounts:
        diff_sub = abs(line_sum - subtotal)
        if diff_sub > tolerance:
            issues.append({
                "check": "line_items_to_subtotal",
                "expected": subtotal,
                "got": line_sum,
                "discrepancy": round(diff_sub, 2)
            })
            details_parts.append(
                f"Line items sum ${line_sum:.2f} ≠ subtotal ${subtotal:.2f} (off by ${diff_sub:.2f})"
            )
        else:
            details_parts.append(f"Line items ${line_sum:.2f} match subtotal ${subtotal:.2f} ✓")

    elif total is not None and amounts:
        diff_tot = abs(line_sum - total)
        if diff_tot > tolerance:
            issues.append({
                "check": "line_items_to_total",
                "expected": total,
                "got": line_sum,
                "discrepancy": round(diff_tot, 2)
            })
            details_parts.append(
                f"Line items sum ${line_sum:.2f} ≠ total ${total:.2f} (off by ${diff_tot:.2f})"
            )
        else:
            details_parts.append(f"Line items ${line_sum:.2f} match total ${total:.2f} ✓")

    # Check 2: subtotal + tax → total
    if subtotal is not None and tax_amt is not None and total is not None:
        computed_total = round(subtotal + tax_amt, 2)
        diff_chain = abs(computed_total - total)
        if diff_chain > tolerance:
            issues.append({
                "check": "subtotal_plus_tax",
                "expected": total,
                "got": computed_total,
                "discrepancy": round(diff_chain, 2)
            })
            details_parts.append(
                f"Subtotal ${subtotal:.2f} + Tax ${tax_amt:.2f} = ${computed_total:.2f} ≠ stated total ${total:.2f} (off by ${diff_chain:.2f})"
            )
        else:
            details_parts.append(
                f"Subtotal ${subtotal:.2f} + Tax ${tax_amt:.2f} = ${computed_total:.2f} matches total ✓"
            )

    if not amounts and total is None:
        return {
            "check": "math_totals",
            "passed": True,
            "severity": "info",
            "details": "No amounts or totals to verify."
        }

    passed = len(issues) == 0
    max_discrepancy = max((i["discrepancy"] for i in issues), default=0)
    severity = "high" if max_discrepancy > 1 else "medium" if max_discrepancy > 0 else "info"

    return {
        "check": "math_totals",
        "passed": passed,
        "severity": severity if not passed else "info",
        "details": " | ".join(details_parts) if details_parts else "No totals to verify.",
        "line_sum": line_sum,
        "stated_total": total,
        "subtotal": subtotal,
        "tax": tax_amt,
        "discrepancy": round(max_discrepancy, 2),
        "issues": issues
    }


# ---------------------------------------------------------------------------
# Duplicate line items
# ---------------------------------------------------------------------------
def duplicate_check(line_items):
    duplicates = []
    seen = {}

    for i, item in enumerate(line_items):
        key = (
            round(item.get("amount", 0) or 0, 2),
            (item.get("description", "") or "").lower().strip()[:50]
        )
        if key in seen:
            duplicates.append({
                "item1_idx": seen[key],
                "item2_idx": i,
                "amount": key[0],
                "description": item.get("description", "")
            })
        else:
            seen[key] = i

    passed = len(duplicates) == 0
    return {
        "check": "duplicate_line_items",
        "passed": passed,
        "severity": "high" if duplicates else "info",
        "details": (
            f"Found {len(duplicates)} duplicate line item(s): " +
            "; ".join(f"'{d['description']}' (${d['amount']:.2f})" for d in duplicates)
            if duplicates else "No duplicate line items detected."
        ),
        "duplicates": duplicates
    }


# ---------------------------------------------------------------------------
# Round number check
# ---------------------------------------------------------------------------
def round_number_check(line_items):
    amounts = [item.get("amount", 0) or 0 for item in line_items if item.get("amount")]
    if not amounts:
        return {"check": "round_numbers", "passed": True, "severity": "info",
                "details": "No amounts to check."}

    round_count = sum(1 for a in amounts if a >= 1 and a % 10 == 0)
    ratio = round_count / len(amounts)
    passed = ratio < 0.7

    return {
        "check": "round_numbers",
        "passed": passed,
        "severity": "medium" if not passed else "info",
        "details": (
            f"{round_count}/{len(amounts)} amounts ({ratio*100:.0f}%) are round multiples of 10. "
            + ("Unusually high — may indicate fabricated amounts."
               if not passed else "Round number ratio is within normal range.")
        ),
        "round_ratio": round(ratio, 3)
    }


# ---------------------------------------------------------------------------
# Split invoice detection
# ---------------------------------------------------------------------------
def split_invoice_check(document, line_items):
    amounts = [item.get("amount", 0) or 0 for item in line_items if item.get("amount")]
    if len(amounts) < 3:
        return {"check": "split_invoice", "passed": True, "severity": "info",
                "details": "Not enough line items to assess split invoice pattern."}

    total = document.get("total") or sum(amounts)
    thresholds = [500, 1000, 5000, 10000]
    near_threshold = sum(
        1 for a in amounts
        if any(t * 0.85 <= a <= t * 0.99 for t in thresholds)
    )
    ratio = near_threshold / len(amounts)

    clustering = False
    if len(amounts) >= 5:
        sorted_a = sorted(amounts)
        spread = (sorted_a[-1] - sorted_a[0]) / sorted_a[-1] if sorted_a[-1] > 0 else 0
        clustering = spread < 0.1

    passed = ratio < 0.5 and not clustering
    flags = []
    if ratio >= 0.5:
        flags.append(f"{near_threshold} items near approval thresholds")
    if clustering:
        flags.append("multiple items with suspiciously similar amounts")

    avg = sum(amounts) / len(amounts)
    return {
        "check": "split_invoice",
        "passed": passed,
        "severity": "medium" if not passed else "info",
        "details": (
            f"Potential invoice splitting: {', '.join(flags)}."
            if flags else
            f"{len(amounts)} line items, average ${avg:.2f}. No split invoice pattern detected."
        ),
        "item_count": len(amounts),
        "near_threshold_ratio": round(ratio, 3)
    }


# ---------------------------------------------------------------------------
# Vendor name anomaly
# ---------------------------------------------------------------------------
def vendor_anomaly_check(line_items):
    flagged = []
    for item in line_items:
        vendor = (item.get("vendor") or "").strip()
        if not vendor or len(vendor) < 2:
            continue
        if re.match(r'^\d+$', vendor):
            flagged.append(f"Numeric-only vendor name: '{vendor}'")
        elif len(vendor) <= 2:
            flagged.append(f"Unusually short vendor name: '{vendor}'")

    passed = len(flagged) == 0
    return {
        "check": "vendor_anomaly",
        "passed": passed,
        "severity": "low" if not passed else "info",
        "details": (
            "Suspicious vendor names: " + "; ".join(flagged)
            if flagged else "Vendor names appear normal."
        )
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run_all_checks(payload):
    document = payload.get("document", {})
    line_items = payload.get("line_items", [])
    historical_amounts = payload.get("historical_amounts", [])

    all_amounts = list(historical_amounts) + [
        item.get("amount", 0) for item in line_items if item.get("amount")
    ]

    return [
        math_check(document, line_items),
        duplicate_check(line_items),
        round_number_check(line_items),
        split_invoice_check(document, line_items),
        vendor_anomaly_check(line_items)
    ]


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: rule_checks.py '<json>'"}))
        sys.exit(1)

    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    results = run_all_checks(payload)
    print(json.dumps(results))
