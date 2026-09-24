-- MedFind Database Schema

CREATE TABLE IF NOT EXISTS pharmacies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    password_hash TEXT NOT NULL,
    is_open INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    strength TEXT NOT NULL,
    form TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(id),
    UNIQUE(pharmacy_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id INTEGER NOT NULL,
    medicine_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id)
);
