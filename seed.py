"""
seed.py — Populate MedFind database with realistic sample data.
Run once: python seed.py
"""

import sqlite3
import hashlib
import os
from datetime import datetime, timedelta, timezone
import random

DB_PATH = "medfind.db"
SCHEMA_PATH = "schema.sql"


def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn):
    with open(SCHEMA_PATH, "r") as f:
        conn.executescript(f.read())
    conn.commit()


PHARMACIES = [
    ("MedPlus Pharmacy — Master Canteen",    "Janpath, Master Canteen Square, Bhubaneswar, Odisha",            20.2680, 85.8400, "demo123"),
    ("Apollo Pharmacy — Saheed Nagar",       "Near BMC Bhawani Mall, Saheed Nagar, Bhubaneswar, Odisha",       20.2895, 85.8370, "demo123"),
    ("LifeCare Pharmacy — Kharvel Nagar",    "Near Ram Mandir, Kharvel Nagar, Bhubaneswar, Odisha",            20.2780, 85.8290, "demo123"),
    ("Sunrise Medical & Chemist",            "Unit-4, Near Capital Hospital, Bhubaneswar, Odisha",             20.2610, 85.8180, "demo123"),
    ("City Chemist & Druggist",              "Near ISKCON Temple, Nayapalli, Bhubaneswar, Odisha",             20.2945, 85.8012, "demo123"),
    ("Wellness Pharmacy — KIIT Campus",      "Infocity Road, Patia, Bhubaneswar, Odisha",                      20.3540, 85.8175, "demo123"),
    ("Kalinga Medicos — Jayadev Vihar",      "Near Pal Heights, Jayadev Vihar, Bhubaneswar, Odisha",           20.3015, 85.8185, "demo123"),
    ("Damana Health Chemist",                "Damana Square, Chandrasekharpur, Bhubaneswar, Odisha",           20.3250, 85.8190, "demo123"),
    ("AIIMS Care Pharmacy",                  "Sijua, Near AIIMS Hospital, Bhubaneswar, Odisha",                20.2310, 85.7750, "demo123"),
    ("SUM Hospital Medical Store",           "Kalinga Nagar, Near SUM Hospital, Ghatikia, Bhubaneswar, Odisha", 20.2785, 85.7620, "demo123"),
    ("Khandagiri Express Pharmacy",          "Near Khandagiri Caves, Baramunda, Bhubaneswar, Odisha",          20.2580, 85.7860, "demo123"),
    ("Esplanade Care Pharmacy",              "Cuttack Road, Near Esplanade One Mall, Rasulgarh, Bhubaneswar",  20.2910, 85.8640, "demo123"),
]

MEDICINES = [
    ("Paracetamol",   "500mg",    "Tablet"),
    ("Paracetamol",   "650mg",    "Tablet"),
    ("Dolo 650",      "650mg",    "Tablet"),
    ("Crocin",        "500mg",    "Tablet"),
    ("Combiflam",     "400mg",    "Tablet"),
    ("Amoxicillin",   "500mg",    "Capsule"),
    ("Amoxicillin",   "250mg",    "Syrup"),
    ("Metformin",     "500mg",    "Tablet"),
    ("Metformin",     "1000mg",   "Tablet"),
    ("Cetirizine",    "10mg",     "Tablet"),
    ("Azithromycin",  "500mg",    "Tablet"),
    ("Ibuprofen",     "400mg",    "Tablet"),
    ("Omeprazole",    "20mg",     "Capsule"),
    ("Pantoprazole",  "40mg",     "Tablet"),
    ("Atorvastatin",  "10mg",     "Tablet"),
    ("Aspirin",       "75mg",     "Tablet"),
    ("Vitamin C",     "500mg",    "Chewable Tablet"),
    ("Montelukast",   "10mg",     "Tablet"),
    ("Amlodipine",    "5mg",      "Tablet"),
    ("Telmisartan",   "40mg",     "Tablet"),
    ("Levothyroxine", "50mcg",    "Tablet"),
    ("Ciprofloxacin", "500mg",    "Tablet"),
    ("Doxycycline",   "100mg",    "Capsule"),
    ("Salbutamol",    "100mcg",   "Inhaler"),
    ("Clopidogrel",   "75mg",     "Tablet"),
    ("Diclofenac",    "50mg",     "Tablet"),
]


def random_last_updated():
    """Return a datetime weighted towards recent, but some stale."""
    choice = random.random()
    if choice < 0.4:
        delta = timedelta(minutes=random.randint(1, 29))
    elif choice < 0.7:
        delta = timedelta(minutes=random.randint(30, 719))
    else:
        delta = timedelta(hours=random.randint(12, 72))
    return datetime.now(timezone.utc).replace(tzinfo=None) - delta


def seed():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"Removed existing {DB_PATH}")

    conn = get_conn()
    init_db(conn)

    # Insert pharmacies
    pharmacy_ids = {}
    for name, address, lat, lon, pw in PHARMACIES:
        cur = conn.execute(
            "INSERT INTO pharmacies (name, address, latitude, longitude, password_hash, is_open) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (name, address, lat, lon, hash_password(pw), 1),
        )
        pharmacy_ids[name] = cur.lastrowid
    conn.commit()
    print(f"Inserted {len(PHARMACIES)} pharmacies.")

    # Insert medicines
    medicine_ids = []
    for med_name, strength, form in MEDICINES:
        cur = conn.execute(
            "INSERT INTO medicines (name, strength, form) VALUES (?, ?, ?)",
            (med_name, strength, form),
        )
        medicine_ids.append(cur.lastrowid)
    conn.commit()
    print(f"Inserted {len(MEDICINES)} medicines.")

    # Seed inventory — each pharmacy gets a broad sample of medicines
    inventory_rows = 0
    for p_name, p_id in pharmacy_ids.items():
        selected = random.sample(medicine_ids, k=random.randint(18, min(25, len(medicine_ids))))
        for m_id in selected:
            qty = random.choice(
                [0, 0, 5, 8, 10, 15, 20, 30, 50, 75, 100, 150, 200]
            )
            lu = random_last_updated().strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(
                "INSERT OR IGNORE INTO inventory (pharmacy_id, medicine_id, quantity, last_updated) "
                "VALUES (?, ?, ?, ?)",
                (p_id, m_id, qty, lu),
            )
            inventory_rows += 1
    conn.commit()
    print(f"Inserted {inventory_rows} inventory rows.")

    conn.close()
    print("Seed complete. Run: python app.py")


if __name__ == "__main__":
    seed()
