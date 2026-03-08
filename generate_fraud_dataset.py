import csv
import random
from datetime import datetime, timedelta

random.seed(42)

# ── Reference data ──────────────────────────────────────────────────────────

LEGIT_VENDORS = [
    "Staples", "Amazon", "Office Depot", "Best Buy", "CDW", "Dell", "Newegg",
    "Home Depot", "Grainger", "Uline", "FedEx", "UPS", "Cintas",
    "Sysco", "US Foods", "IKEA", "Wayfair", "Adobe", "Microsoft",
    "Google Cloud", "Zoom", "Slack", "Salesforce", "DocuSign"
]

FAKE_VENDORS = [
    "Pinnacle Global Solutions", "NexGen Supply Co", "Apex Procurement LLC",
    "TrueNorth Distributors", "OmniSource Partners", "BlueLine Services Inc",
    "Premier Office Holdings", "SwiftEdge Consulting", "DataBridge Corp",
    "Summit Procurement Group"
]

DEPARTMENTS = ["Marketing", "Engineering", "Finance", "HR", "Operations", "Legal", "Sales", "IT", "Admin", "Facilities"]
PAYMENT_METHODS = ["Corporate Card", "Wire Transfer", "Check", "ACH", "Purchase Order"]
EMPLOYEES = [f"E{i}" for i in range(101, 151)]

# Items with NORMAL market prices
ITEMS = {
    "Office Supplies": [
        ("Printer Paper (Case)", 35.00), ("Blue Pens (Box)", 8.00), ("Sticky Notes (Pack)", 4.50),
        ("Binder Clips (Box)", 3.50), ("Manila Folders (100ct)", 12.00), ("Stapler", 15.00),
        ("Whiteboard Markers (Set)", 9.00), ("Desk Organizer", 22.00), ("Paper Clips (Box)", 2.50),
        ("Tape Dispenser", 7.00), ("Notebook (3-Pack)", 11.00), ("Highlighters (Set)", 6.50),
        ("Envelopes (Box)", 14.00), ("Scissors", 5.00), ("Label Maker Tape", 18.00),
    ],
    "Electronics": [
        ("USB-C Cable", 12.00), ("Wireless Mouse", 25.00), ("USB Hub", 30.00),
        ("Webcam HD", 65.00), ("External SSD 1TB", 95.00), ("Monitor Stand", 45.00),
        ("Keyboard", 55.00), ("Headset", 75.00), ("Power Strip", 18.00),
        ("HDMI Cable", 10.00), ("Laptop Charger", 60.00), ("Ethernet Cable", 8.00),
        ("USB Flash Drive 64GB", 12.00), ("Surge Protector", 28.00),
    ],
    "Furniture": [
        ("Office Chair", 350.00), ("Standing Desk", 450.00), ("Bookshelf", 180.00),
        ("Filing Cabinet", 220.00), ("Desk Lamp", 45.00), ("Monitor Arm", 120.00),
        ("Whiteboard 4x6", 150.00), ("Conference Table", 800.00), ("Side Table", 90.00),
    ],
    "Software": [
        ("Adobe Creative Cloud (Annual)", 600.00), ("Microsoft 365 License", 150.00),
        ("Zoom Pro (Annual)", 160.00), ("Slack Pro (Annual)", 96.00),
        ("Antivirus License", 40.00), ("Project Management Tool", 120.00),
        ("DocuSign License", 180.00), ("Cloud Storage 1TB", 100.00),
    ],
    "Cleaning Supplies": [
        ("Disinfectant Spray (Case)", 35.00), ("Paper Towels (Bulk)", 28.00),
        ("Trash Bags (Roll)", 15.00), ("Hand Sanitizer (Case)", 32.00),
        ("Floor Cleaner (Gallon)", 18.00), ("Glass Cleaner (Case)", 22.00),
    ],
    "Catering": [
        ("Lunch Catering (10 people)", 150.00), ("Coffee Service (Monthly)", 200.00),
        ("Snack Box (Weekly)", 75.00), ("Breakfast Platter", 120.00),
        ("Beverage Package", 60.00), ("Event Catering (25 people)", 500.00),
    ],
    "Maintenance": [
        ("HVAC Filter (Set)", 45.00), ("Light Bulbs (Case)", 30.00),
        ("Plumbing Repair Kit", 55.00), ("Paint (5 Gallon)", 120.00),
        ("Door Hardware", 35.00), ("Electrical Tape (Case)", 18.00),
    ],
    "Fees": [
        ("Shipping Fee", 12.00), ("Rush Delivery Fee", 25.00),
        ("Setup Fee", 50.00), ("Handling Fee", 8.00),
        ("Installation Fee", 75.00), ("Disposal Fee", 30.00),
    ],
}

rows = []
inv_num = 1

def inv_id():
    global inv_num
    iid = f"INV{inv_num:03d}"
    inv_num += 1
    return iid

def rand_date(start="2026-01-02", end="2026-03-01"):
    s = datetime.strptime(start, "%Y-%m-%d")
    e = datetime.strptime(end, "%Y-%m-%d")
    return (s + timedelta(days=random.randint(0, (e - s).days))).strftime("%Y-%m-%d")

def pick_items(category, count):
    return random.sample(ITEMS[category], min(count, len(ITEMS[category])))

def add_invoice(iid, vendor, date, emp, items_list, payment, dept, fraud_type):
    """items_list: list of (item_name, category, quantity, unit_price)"""
    total = sum(round(q * p, 2) for _, _, q, p in items_list)
    for item_name, cat, qty, price in items_list:
        rows.append({
            "invoice_id": iid,
            "vendor_name": vendor,
            "invoice_date": date,
            "employee_id": emp,
            "item_name": item_name,
            "category": cat,
            "quantity": qty,
            "unit_price": round(price, 2),
            "line_total": round(qty * price, 2),
            "invoice_total": round(total, 2),
            "payment_method": payment,
            "department": dept,
            "is_fraud": 1,
            "fraud_type": fraud_type,
        })

# ═══════════════════════════════════════════════════════════════════════════
# 1. OVERPRICED ITEM — 25 invoices
#    Items priced 2x-8x above normal market rate
# ═══════════════════════════════════════════════════════════════════════════
for i in range(25):
    vendor = random.choice(LEGIT_VENDORS[:12])
    cat = random.choice(["Office Supplies", "Electronics", "Cleaning Supplies", "Maintenance"])
    base_items = pick_items(cat, random.randint(2, 4))
    date = rand_date()
    emp = random.choice(EMPLOYEES)
    dept = random.choice(DEPARTMENTS)
    payment = random.choice(PAYMENT_METHODS)
    iid = inv_id()

    items = []
    overpriced_idx = random.randint(0, len(base_items) - 1)
    for j, (name, normal_price) in enumerate(base_items):
        qty = random.randint(1, 10)
        if j == overpriced_idx:
            # Overpriced: 2x to 8x markup
            multiplier = random.uniform(2.0, 8.0)
            price = round(normal_price * multiplier, 2)
        else:
            # Normal price with slight variance
            price = round(normal_price * random.uniform(0.9, 1.15), 2)
        items.append((name, cat, qty, price))

    # Sometimes add a shipping fee
    if random.random() > 0.6:
        fee_item = random.choice(ITEMS["Fees"])
        items.append((fee_item[0], "Fees", 1, round(fee_item[1] * random.uniform(0.9, 1.1), 2)))

    add_invoice(iid, vendor, date, emp, items, payment, dept, "overpriced_item")

# ═══════════════════════════════════════════════════════════════════════════
# 2. DUPLICATE INVOICE — 20 invoices (10 pairs)
#    Same/similar invoice submitted twice with slight variations
# ═══════════════════════════════════════════════════════════════════════════
for i in range(10):
    vendor = random.choice(LEGIT_VENDORS[:15])
    cat = random.choice(list(ITEMS.keys())[:5])
    base_items = pick_items(cat, random.randint(2, 4))
    date1 = rand_date()
    d1 = datetime.strptime(date1, "%Y-%m-%d")
    date2 = (d1 + timedelta(days=random.randint(0, 3))).strftime("%Y-%m-%d")
    emp = random.choice(EMPLOYEES)
    dept = random.choice(DEPARTMENTS)
    payment = random.choice(PAYMENT_METHODS)

    items = []
    for name, normal_price in base_items:
        qty = random.randint(1, 8)
        price = round(normal_price * random.uniform(0.95, 1.05), 2)
        items.append((name, cat, qty, price))

    if random.random() > 0.5:
        fee_item = random.choice(ITEMS["Fees"])
        items.append((fee_item[0], "Fees", 1, round(fee_item[1], 2)))

    iid1 = inv_id()
    iid2 = inv_id()

    add_invoice(iid1, vendor, date1, emp, items, payment, dept, "duplicate_invoice")

    # Second copy: same items, maybe tiny date shift, sometimes different employee
    emp2 = emp if random.random() > 0.3 else random.choice(EMPLOYEES)
    payment2 = payment if random.random() > 0.2 else random.choice(PAYMENT_METHODS)
    add_invoice(iid2, vendor, date2, emp2, items, payment2, dept, "duplicate_invoice")

# ═══════════════════════════════════════════════════════════════════════════
# 3. QUANTITY FRAUD — 20 invoices
#    Inflated quantities far beyond reasonable need
# ═══════════════════════════════════════════════════════════════════════════
for i in range(20):
    vendor = random.choice(LEGIT_VENDORS[:12])
    cat = random.choice(["Office Supplies", "Electronics", "Cleaning Supplies"])
    base_items = pick_items(cat, random.randint(2, 4))
    date = rand_date()
    emp = random.choice(EMPLOYEES)
    dept = random.choice(DEPARTMENTS)
    payment = random.choice(PAYMENT_METHODS)
    iid = inv_id()

    items = []
    inflated_idx = random.randint(0, len(base_items) - 1)
    for j, (name, normal_price) in enumerate(base_items):
        price = round(normal_price * random.uniform(0.95, 1.05), 2)
        if j == inflated_idx:
            # Inflated quantity: 50-500 units of something you'd normally buy 1-10 of
            qty = random.randint(50, 500)
        else:
            qty = random.randint(1, 8)
        items.append((name, cat, qty, price))

    if random.random() > 0.5:
        fee_item = random.choice(ITEMS["Fees"])
        items.append((fee_item[0], "Fees", 1, round(fee_item[1], 2)))

    add_invoice(iid, vendor, date, emp, items, payment, dept, "quantity_fraud")

# ═══════════════════════════════════════════════════════════════════════════
# 4. FAKE VENDOR — 10 invoices
#    Non-existent companies with generic names, odd patterns
# ═══════════════════════════════════════════════════════════════════════════
for i in range(10):
    vendor = FAKE_VENDORS[i]
    cat = random.choice(["Office Supplies", "Electronics", "Software", "Maintenance"])
    base_items = pick_items(cat, random.randint(2, 4))
    date = rand_date()
    emp = random.choice(EMPLOYEES[:10])  # Often same few employees
    dept = random.choice(DEPARTMENTS)
    payment = random.choice(["Wire Transfer", "Check", "ACH"])  # Fake vendors avoid corporate cards
    iid = inv_id()

    items = []
    for name, normal_price in base_items:
        qty = random.randint(1, 15)
        # Prices often rounded to suspicious even numbers
        price = round(normal_price * random.uniform(1.0, 1.5), 0)
        items.append((name, cat, qty, price))

    # Fake vendors often add vague consulting/service fees
    vague_fees = [
        ("Consulting Services", "Fees"), ("Administrative Fee", "Fees"),
        ("Professional Services", "Fees"), ("Management Fee", "Fees"),
        ("Advisory Services", "Fees"),
    ]
    fee_name, fee_cat = random.choice(vague_fees)
    fee_amount = random.choice([250, 500, 750, 1000, 1500, 2000])
    items.append((fee_name, fee_cat, 1, float(fee_amount)))

    add_invoice(iid, vendor, date, emp, items, payment, dept, "fake_vendor")

# ═══════════════════════════════════════════════════════════════════════════
# 5. VENDOR BEHAVIOR CHANGE — 15 invoices
#    Known vendor suddenly billing for unrelated categories/items
# ═══════════════════════════════════════════════════════════════════════════
BEHAVIOR_CHANGES = [
    ("Staples", "Catering"),           # office supply store doing catering
    ("Amazon", "Catering"),            # amazon doing catering
    ("Cintas", "Electronics"),         # cleaning company selling electronics
    ("FedEx", "Furniture"),            # shipping company selling furniture
    ("Grainger", "Software"),          # industrial supply selling software
    ("Home Depot", "Software"),        # hardware store selling software licenses
    ("Uline", "Catering"),            # packaging company doing catering
    ("Office Depot", "Maintenance"),   # office supplies doing maintenance
    ("Best Buy", "Cleaning Supplies"), # electronics store selling cleaning
    ("CDW", "Catering"),              # IT reseller doing catering
    ("Dell", "Office Supplies"),       # computer company selling basic supplies
    ("Newegg", "Furniture"),           # electronics retailer selling furniture
    ("UPS", "Electronics"),            # shipping company selling electronics
    ("Sysco", "Electronics"),          # food distributor selling electronics
    ("US Foods", "Software"),          # food company selling software
]

for i in range(15):
    vendor, wrong_cat = BEHAVIOR_CHANGES[i]
    base_items = pick_items(wrong_cat, random.randint(2, 4))
    date = rand_date()
    emp = random.choice(EMPLOYEES)
    dept = random.choice(DEPARTMENTS)
    payment = random.choice(PAYMENT_METHODS)
    iid = inv_id()

    items = []
    for name, normal_price in base_items:
        qty = random.randint(1, 10)
        price = round(normal_price * random.uniform(0.9, 1.3), 2)
        items.append((name, wrong_cat, qty, price))

    if random.random() > 0.5:
        fee_item = random.choice(ITEMS["Fees"])
        items.append((fee_item[0], "Fees", 1, round(fee_item[1], 2)))

    add_invoice(iid, vendor, date, emp, items, payment, dept, "vendor_behavior_change")

# ═══════════════════════════════════════════════════════════════════════════
# 6. INVOICE SPLITTING — 10 invoices (in groups of 2-3)
#    Large orders split into small invoices to stay under approval thresholds
#    All from same vendor, same date, same employee
# ═══════════════════════════════════════════════════════════════════════════
# 4 groups: 3+3+2+2 = 10 invoices
split_groups = [3, 3, 2, 2]
for group_size in split_groups:
    vendor = random.choice(LEGIT_VENDORS[:10])
    date = rand_date()
    emp = random.choice(EMPLOYEES)
    dept = random.choice(DEPARTMENTS)
    payment = random.choice(PAYMENT_METHODS)
    cat = random.choice(["Office Supplies", "Electronics", "Cleaning Supplies", "Maintenance"])

    # Generate a pool of items that would normally be one big order
    all_items_pool = pick_items(cat, min(group_size * 3, len(ITEMS[cat])))
    if len(all_items_pool) < group_size * 2:
        # Supplement with items from another category
        extra_cat = random.choice(["Office Supplies", "Fees"])
        all_items_pool += pick_items(extra_cat, 3)

    random.shuffle(all_items_pool)

    # Split items across invoices — each invoice kept under ~$500
    chunk_size = max(2, len(all_items_pool) // group_size)
    for g in range(group_size):
        iid = inv_id()
        start = g * chunk_size
        end = start + chunk_size if g < group_size - 1 else len(all_items_pool)
        chunk = all_items_pool[start:end]

        items = []
        for name, normal_price in chunk:
            qty = random.randint(1, 5)
            price = round(normal_price * random.uniform(0.95, 1.05), 2)
            items.append((name, cat if (name, normal_price) in ITEMS[cat] else "Fees", qty, price))

        # Keep each split invoice under approval threshold (~$450-$490)
        while sum(q * p for _, _, q, p in items) > 490:
            # Reduce a quantity
            idx = random.randint(0, len(items) - 1)
            n, c, q, p = items[idx]
            if q > 1:
                items[idx] = (n, c, q - 1, p)

        add_invoice(iid, vendor, date, emp, items, payment, dept, "invoice_splitting")


# ═══════════════════════════════════════════════════════════════════════════
# Write CSV
# ═══════════════════════════════════════════════════════════════════════════
output_path = "/Users/neev/Desktop/guardian/fraud_dataset.csv"
fields = [
    "invoice_id", "vendor_name", "invoice_date", "employee_id",
    "item_name", "category", "quantity", "unit_price", "line_total",
    "invoice_total", "payment_method", "department", "is_fraud", "fraud_type"
]

with open(output_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)

# ── Summary stats ───────────────────────────────────────────────────────────
unique_invoices = set(r["invoice_id"] for r in rows)
fraud_counts = {}
for r in rows:
    key = (r["invoice_id"], r["fraud_type"])
    fraud_counts[key] = True

type_counts = {}
for (iid, ft) in fraud_counts:
    type_counts[ft] = type_counts.get(ft, 0) + 1

print(f"Total rows: {len(rows)}")
print(f"Unique invoices: {len(unique_invoices)}")
print(f"\nFraud type distribution:")
for ft, count in sorted(type_counts.items(), key=lambda x: -x[1]):
    print(f"  {ft}: {count} invoices ({count}%)")
print(f"\nSaved to: {output_path}")
