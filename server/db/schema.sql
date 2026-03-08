CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    upload_date TEXT DEFAULT (datetime('now')),
    ocr_status TEXT DEFAULT 'pending',
    ocr_text TEXT,
    parsed_data TEXT,
    status TEXT DEFAULT 'uploaded'
);

CREATE TABLE IF NOT EXISTS line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    vendor TEXT,
    description TEXT,
    amount REAL,
    date TEXT,
    category TEXT,
    raw_text TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS fraud_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    line_item_id INTEGER,
    flag_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    confidence REAL,
    estimated_savings REAL DEFAULT 0,
    ai_reasoning TEXT,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (line_item_id) REFERENCES line_items(id)
);

CREATE TABLE IF NOT EXISTS negotiations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fraud_flag_id INTEGER NOT NULL,
    message_type TEXT NOT NULL,
    tone TEXT DEFAULT 'firm',
    generated_message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (fraud_flag_id) REFERENCES fraud_flags(id)
);

CREATE TABLE IF NOT EXISTS savings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fraud_flag_id INTEGER NOT NULL,
    amount_saved REAL NOT NULL,
    resolved_date TEXT DEFAULT (datetime('now')),
    notes TEXT,
    FOREIGN KEY (fraud_flag_id) REFERENCES fraud_flags(id)
);

CREATE TABLE IF NOT EXISTS ml_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    prediction INTEGER NOT NULL,
    probability REAL NOT NULL,
    is_fraud INTEGER NOT NULL DEFAULT 0,
    features_json TEXT,
    top_features_json TEXT,
    gemini_explanation TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS rule_check_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    check_type TEXT NOT NULL,
    passed INTEGER NOT NULL DEFAULT 1,
    severity TEXT DEFAULT 'info',
    details TEXT,
    extra_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS terac_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,
    flag_id INTEGER,
    quote_id TEXT,
    opportunity_id TEXT,
    name TEXT,
    task_description TEXT,
    panel_description TEXT,
    timeline_hours INTEGER,
    submission_count INTEGER,
    ui_link TEXT,
    status TEXT DEFAULT 'pending',
    total_cost REAL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (flag_id) REFERENCES fraud_flags(id)
);

CREATE TABLE IF NOT EXISTS terac_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terac_opportunity_id INTEGER NOT NULL,
    participant_id TEXT,
    data_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (terac_opportunity_id) REFERENCES terac_opportunities(id)
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    provider TEXT DEFAULT 'email',
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
