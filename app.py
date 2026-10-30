"""
app.py — MedFind Flask backend.
Run: python app.py
"""

import sqlite3
import hashlib
import json
import math
import os
import uuid
from datetime import datetime, timezone
from functools import wraps

from flask import (
    Flask, request, jsonify, render_template,
    session, g, abort,
)

from chatbot import (
    process_chat_message,
    create_support_ticket,
    lookup_reservation_status
)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "medfind-dev-secret-change-in-prod")

if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/medfind.db"
else:
    DB_PATH = os.environ.get("DB_PATH", "medfind.db")

WEIGHTS_PATH = "model_weights.json"
DEFAULT_LAT = 20.2961
DEFAULT_LON = 85.8245

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def ensure_db_exists():
    if not os.path.exists(DB_PATH):
        try:
            import seed
            seed.DB_PATH = DB_PATH
            seed.seed()
        except Exception as e:
            print(f"Auto-seed error: {e}")

def get_db():
    ensure_db_exists()
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("""
            CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_code TEXT NOT NULL UNIQUE,
                user_name TEXT,
                contact TEXT,
                category TEXT NOT NULL,
                subject TEXT,
                message TEXT NOT NULL,
                status TEXT DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        g.db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_code TEXT NOT NULL UNIQUE,
                pharmacy_id INTEGER NOT NULL,
                pharmacy_name TEXT,
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                customer_address TEXT NOT NULL,
                delivery_type TEXT DEFAULT 'delivery',
                items_json TEXT NOT NULL,
                subtotal REAL NOT NULL,
                delivery_fee REAL NOT NULL DEFAULT 0,
                discount REAL NOT NULL DEFAULT 0,
                total_amount REAL NOT NULL,
                payment_method TEXT NOT NULL,
                payment_status TEXT DEFAULT 'paid',
                status TEXT DEFAULT 'placed',
                rider_name TEXT DEFAULT 'Ramesh Kumar',
                rider_phone TEXT DEFAULT '+91 98765 43210',
                delivery_otp TEXT DEFAULT '4821',
                estimated_delivery_time TEXT DEFAULT '20 mins',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id)
            )
        """)
        g.db.commit()
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


MEDICINE_PRICES = {
    "paracetamol": 25.0,
    "dolo 650": 32.0,
    "crocin": 28.0,
    "combiflam": 42.0,
    "amoxicillin": 85.0,
    "metformin": 48.0,
    "cetirizine": 22.0,
    "azithromycin": 118.0,
    "ibuprofen": 35.0,
    "omeprazole": 65.0,
    "pantoprazole": 78.0,
    "atorvastatin": 110.0,
    "aspirin": 20.0,
    "vitamin c": 40.0,
    "montelukast": 96.0,
    "amlodipine": 38.0,
    "telmisartan": 72.0,
    "levothyroxine": 135.0,
    "ciprofloxacin": 88.0,
    "doxycycline": 75.0,
    "salbutamol": 165.0,
    "clopidogrel": 92.0,
    "diclofenac": 45.0,
}


def get_medicine_price(med_name: str) -> float:
    low = (med_name or "").lower().strip()
    for key, val in MEDICINE_PRICES.items():
        if key in low:
            return float(val)
    h = sum(ord(c) for c in low)
    return float(35 + (h % 90))


def load_weights() -> dict:
    if os.path.exists(WEIGHTS_PATH):
        with open(WEIGHTS_PATH) as f:
            return json.load(f).get("weights", {})
    return {
        "availability": 0.40,
        "freshness": 0.25,
        "distance": 0.25,
        "is_open": 0.10,
    }


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Return distance in km between two lat/lon points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def minutes_since(dt_str: str) -> int:
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        delta = datetime.now(timezone.utc).replace(tzinfo=None) - dt
        return max(0, int(delta.total_seconds() / 60))
    except Exception:
        return 9999


def classify_freshness(minutes: int) -> str:
    if minutes < 30:
        return "fresh"
    if minutes < 720:   # 12 hours
        return "aging"
    return "stale"


def classify_availability(quantity: int) -> str:
    if quantity == 0:
        return "out_of_stock"
    if quantity <= 10:
        return "low_stock"
    return "in_stock"


def compute_score(availability, freshness, distance_km, is_open, weights=None) -> float:
    w = weights or load_weights()
    avail_map = {"in_stock": 1.0, "low_stock": 0.5, "out_of_stock": 0.0}
    fresh_map = {"fresh": 1.0, "aging": 0.6, "stale": 0.2}
    a = avail_map.get(availability, 0.0)
    f = fresh_map.get(freshness, 0.2)
    d = math.exp(-0.3 * max(distance_km, 0))
    o = 1.0 if is_open else 0.0
    score = w["availability"] * a + w["freshness"] * f + w["distance"] * d + w["is_open"] * o
    return round(score, 4)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "pharmacy_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Routes — Frontend
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------

@app.route("/api/search")
def api_search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])

    try:
        lat = float(request.args.get("lat", DEFAULT_LAT))
        lon = float(request.args.get("lon", DEFAULT_LON))
    except ValueError:
        lat, lon = DEFAULT_LAT, DEFAULT_LON

    db = get_db()
    weights = load_weights()

    rows = db.execute(
        """
        SELECT
            p.id          AS pharmacy_id,
            p.name        AS pharmacy,
            p.address,
            p.latitude,
            p.longitude,
            p.is_open,
            m.id          AS medicine_id,
            m.name        AS medicine,
            m.strength,
            m.form,
            i.quantity,
            i.last_updated
        FROM inventory i
        JOIN pharmacies p ON p.id = i.pharmacy_id
        JOIN medicines  m ON m.id = i.medicine_id
        WHERE LOWER(m.name) LIKE LOWER(?)
        """,
        (f"%{q}%",),
    ).fetchall()

    results = []
    for row in rows:
        mins = minutes_since(row["last_updated"])
        freshness = classify_freshness(mins)
        availability = classify_availability(row["quantity"])
        dist = haversine(lat, lon, row["latitude"], row["longitude"])
        score = compute_score(availability, freshness, dist, bool(row["is_open"]), weights)
        results.append({
            "pharmacy_id": row["pharmacy_id"],
            "pharmacy": row["pharmacy"],
            "address": row["address"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "medicine_id": row["medicine_id"],
            "medicine": row["medicine"],
            "strength": row["strength"],
            "form": row["form"],
            "price": get_medicine_price(row["medicine"]),
            "quantity": row["quantity"],
            "availability": availability,
            "freshness": freshness,
            "last_updated_minutes_ago": mins,
            "distance_km": dist,
            "is_open": bool(row["is_open"]),
            "score": score,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return jsonify(results)


@app.route("/api/pharmacies")
def api_pharmacies():
    try:
        lat = float(request.args.get("lat", DEFAULT_LAT))
        lon = float(request.args.get("lon", DEFAULT_LON))
    except (ValueError, TypeError):
        lat, lon = DEFAULT_LAT, DEFAULT_LON

    db = get_db()
    rows = db.execute("SELECT id, name, address, latitude, longitude, is_open FROM pharmacies").fetchall()
    results = []
    for r in rows:
        dist = haversine(lat, lon, r["latitude"], r["longitude"])
        results.append({
            "id": r["id"],
            "pharmacy_id": r["id"],
            "name": r["name"],
            "pharmacy": r["name"],
            "address": r["address"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "is_open": bool(r["is_open"]),
            "distance_km": dist
        })
    results.sort(key=lambda x: x["distance_km"])
    return jsonify(results)


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(force=True) or {}
    name = data.get("pharmacy_name", "").strip()
    pw = data.get("password", "")

    if not name or not pw:
        return jsonify({"error": "Name and password are required"}), 400

    db = get_db()
    row = db.execute(
        "SELECT id, name, password_hash FROM pharmacies WHERE name = ?", (name,)
    ).fetchone()

    if row is None:
        return jsonify({"error": "Pharmacy not found"}), 404

    if row["password_hash"] != hash_password(pw):
        return jsonify({"error": "Incorrect password"}), 401

    session["pharmacy_id"] = row["id"]
    session["pharmacy_name"] = row["name"]
    return jsonify({"success": True, "pharmacy_id": row["id"], "name": row["name"]})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"success": True})


@app.route("/api/session")
def api_session():
    if "pharmacy_id" in session:
        db = get_db()
        p = db.execute("SELECT id, name, is_open FROM pharmacies WHERE id = ?", (session["pharmacy_id"],)).fetchone()
        return jsonify({
            "logged_in": True,
            "pharmacy_id": session["pharmacy_id"],
            "name": session["pharmacy_name"],
            "is_open": bool(p["is_open"]) if p else True
        })
    return jsonify({"logged_in": False})


@app.route("/api/pharmacy/<int:pharmacy_id>/inventory")
@login_required
def api_inventory_get(pharmacy_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "You can only view your own inventory"}), 403

    db = get_db()
    rows = db.execute(
        """
        SELECT
            m.id   AS medicine_id,
            m.name,
            m.strength,
            m.form,
            i.quantity,
            i.last_updated
        FROM inventory i
        JOIN medicines m ON m.id = i.medicine_id
        WHERE i.pharmacy_id = ?
        ORDER BY m.name, m.strength
        """,
        (pharmacy_id,),
    ).fetchall()

    result = []
    for row in rows:
        mins = minutes_since(row["last_updated"])
        result.append({
            "medicine_id": row["medicine_id"],
            "name": row["name"],
            "strength": row["strength"],
            "form": row["form"],
            "quantity": row["quantity"],
            "freshness": classify_freshness(mins),
            "last_updated_minutes_ago": mins,
        })
    return jsonify(result)


@app.route("/api/pharmacy/<int:pharmacy_id>/inventory", methods=["POST"])
@login_required
def api_inventory_update(pharmacy_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "You can only update your own inventory"}), 403

    data = request.get_json(force=True) or {}
    medicine_id = data.get("medicine_id")
    quantity = data.get("quantity")

    if medicine_id is None or quantity is None:
        return jsonify({"error": "medicine_id and quantity are required"}), 400

    try:
        quantity = int(quantity)
        if quantity < 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "quantity must be a non-negative integer"}), 400

    db = get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        "UPDATE inventory SET quantity = ?, last_updated = ? WHERE pharmacy_id = ? AND medicine_id = ?",
        (quantity, now, pharmacy_id, medicine_id),
    )
    db.commit()

    return jsonify({"success": True, "quantity": quantity, "last_updated": now})


@app.route("/api/pharmacy/<int:pharmacy_id>/reservations")
@login_required
def api_pharmacy_reservations(pharmacy_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "Unauthorized"}), 403
    db = get_db()
    rows = db.execute(
        """
        SELECT id, medicine_name, quantity, status, created_at
        FROM reservations
        WHERE pharmacy_id = ?
        ORDER BY id DESC
        """,
        (pharmacy_id,)
    ).fetchall()
    results = []
    for r in rows:
        mins_ago = minutes_since(r["created_at"])
        rem_mins = max(0, 30 - mins_ago)
        status = r["status"]
        if status == "pending" and rem_mins == 0:
            status = "expired"
        results.append({
            "id": r["id"],
            "request_id": f"RES-{r['id']:06d}",
            "medicine_name": r["medicine_name"],
            "quantity": r["quantity"],
            "status": status,
            "created_at": r["created_at"],
            "minutes_ago": mins_ago,
            "remaining_minutes": rem_mins,
        })
    return jsonify(results)


@app.route("/api/pharmacy/<int:pharmacy_id>/reservations/<int:res_id>/status", methods=["POST"])
@login_required
def api_pharmacy_reservation_update(pharmacy_id, res_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json(force=True) or {}
    new_status = data.get("status")
    if new_status not in ["confirmed", "completed", "cancelled"]:
        return jsonify({"error": "Invalid status"}), 400

    db = get_db()
    res = db.execute("SELECT * FROM reservations WHERE id = ? AND pharmacy_id = ?", (res_id, pharmacy_id)).fetchone()
    if not res:
        return jsonify({"error": "Reservation not found"}), 404

    db.execute("UPDATE reservations SET status = ? WHERE id = ?", (new_status, res_id))

    # If completing order, deduct from inventory if item exists in inventory
    if new_status == "completed":
        med = db.execute("SELECT id FROM medicines WHERE LOWER(name) = LOWER(?)", (res["medicine_name"],)).fetchone()
        if med:
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            db.execute(
                "UPDATE inventory SET quantity = MAX(0, quantity - ?), last_updated = ? WHERE pharmacy_id = ? AND medicine_id = ?",
                (res["quantity"], now, pharmacy_id, med["id"])
            )
    db.commit()
    return jsonify({"success": True, "reservation_id": res_id, "status": new_status})


@app.route("/api/pharmacy/<int:pharmacy_id>/toggle-open", methods=["POST"])
@login_required
def api_pharmacy_toggle_open(pharmacy_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json(force=True) or {}
    db = get_db()
    p = db.execute("SELECT is_open FROM pharmacies WHERE id = ?", (pharmacy_id,)).fetchone()
    if not p:
        return jsonify({"error": "Pharmacy not found"}), 404

    if "is_open" in data:
        new_state = 1 if data["is_open"] else 0
    else:
        new_state = 0 if p["is_open"] else 1

    db.execute("UPDATE pharmacies SET is_open = ? WHERE id = ?", (new_state, pharmacy_id))
    db.commit()
    return jsonify({"success": True, "is_open": bool(new_state)})


@app.route("/api/pharmacy/<int:pharmacy_id>/mark-all-fresh", methods=["POST"])
@login_required
def api_pharmacy_mark_all_fresh(pharmacy_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "Unauthorized"}), 403
    db = get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cur = db.execute("UPDATE inventory SET last_updated = ? WHERE pharmacy_id = ?", (now, pharmacy_id))
    db.commit()
    return jsonify({"success": True, "updated_count": cur.rowcount, "last_updated": now})


@app.route("/api/pharmacy/<int:pharmacy_id>/analytics")
@login_required
def api_pharmacy_analytics(pharmacy_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "Unauthorized"}), 403
    db = get_db()

    # 1. Reservations breakdown
    res_rows = db.execute(
        "SELECT status, COUNT(*) as cnt FROM reservations WHERE pharmacy_id = ? GROUP BY status",
        (pharmacy_id,)
    ).fetchall()
    counts = {r["status"]: r["cnt"] for r in res_rows}
    total_res = sum(counts.values())
    fulfilled = counts.get("completed", 0) + counts.get("confirmed", 0)
    fulfillment_rate = round((fulfilled / total_res * 100), 1) if total_res > 0 else 100.0

    # 2. Inventory Health
    inv_rows = db.execute(
        """
        SELECT m.name, m.strength, m.form, i.quantity, i.last_updated
        FROM inventory i
        JOIN medicines m ON m.id = i.medicine_id
        WHERE i.pharmacy_id = ?
        """,
        (pharmacy_id,)
    ).fetchall()

    total_meds = len(inv_rows)
    in_stock = sum(1 for r in inv_rows if r["quantity"] > 10)
    low_stock = sum(1 for r in inv_rows if 0 < r["quantity"] <= 10)
    out_of_stock = sum(1 for r in inv_rows if r["quantity"] == 0)
    fresh_count = sum(1 for r in inv_rows if minutes_since(r["last_updated"]) < 30)
    freshness_health = round((fresh_count / total_meds * 100), 1) if total_meds > 0 else 0.0

    # 3. High Demand Medicines in Area with Restock recommendations
    DEMAND_LIST = [
        {"name": "Dolo 650", "demand_level": "Very High", "searches": 1420},
        {"name": "Paracetamol", "demand_level": "High", "searches": 1180},
        {"name": "Combiflam", "demand_level": "High", "searches": 950},
        {"name": "Pantoprazole", "demand_level": "High", "searches": 880},
        {"name": "Azithromycin", "demand_level": "Medium-High", "searches": 740},
        {"name": "Cetirizine", "demand_level": "Medium", "searches": 690},
        {"name": "Metformin", "demand_level": "Medium", "searches": 620},
        {"name": "Amoxicillin", "demand_level": "Medium", "searches": 580},
    ]

    demand_analysis = []
    for item in DEMAND_LIST:
        curr = next((r for r in inv_rows if item["name"].lower() in r["name"].lower()), None)
        curr_qty = curr["quantity"] if curr else 0
        if curr_qty == 0:
            urgency = "Critical Out of Stock"
            action = "Restock Urgently"
        elif curr_qty <= 10:
            urgency = "Low Stock Alert"
            action = "Top-up Soon"
        else:
            urgency = "Adequate Stock"
            action = "Healthy"

        demand_analysis.append({
            "name": item["name"],
            "demand_level": item["demand_level"],
            "searches_30d": item["searches"],
            "current_stock": curr_qty,
            "urgency": urgency,
            "action": action
        })

    return jsonify({
        "reservations": {
            "total": total_res,
            "pending": counts.get("pending", 0),
            "confirmed": counts.get("confirmed", 0),
            "completed": counts.get("completed", 0),
            "cancelled": counts.get("cancelled", 0),
            "fulfillment_rate": fulfillment_rate
        },
        "inventory_health": {
            "total_items": total_meds,
            "in_stock": in_stock,
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
            "freshness_health_pct": freshness_health
        },
        "demand_insights": demand_analysis
    })


@app.route("/api/pharmacy/<int:pharmacy_id>/inventory/add", methods=["POST"])
@login_required
def api_pharmacy_add_medicine(pharmacy_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json(force=True) or {}
    medicine_id = data.get("medicine_id")
    quantity = data.get("quantity", 20)

    if not medicine_id:
        return jsonify({"error": "medicine_id is required"}), 400

    db = get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        "INSERT OR REPLACE INTO inventory (pharmacy_id, medicine_id, quantity, last_updated) VALUES (?, ?, ?, ?)",
        (pharmacy_id, medicine_id, quantity, now)
    )
    db.commit()
    return jsonify({"success": True, "medicine_id": medicine_id, "quantity": quantity})


@app.route("/api/medicines/catalog")
def api_medicines_catalog():
    db = get_db()
    rows = db.execute("SELECT id, name, strength, form FROM medicines ORDER BY name, strength").fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["price"] = get_medicine_price(d["name"])
        results.append(d)
    return jsonify(results)


@app.route("/api/reserve", methods=["POST"])
def api_reserve():
    data = request.get_json(force=True) or {}
    pharmacy_id = data.get("pharmacy_id")
    medicine = data.get("medicine", "").strip()
    quantity = data.get("quantity", 1)

    if not pharmacy_id or not medicine:
        return jsonify({"error": "pharmacy_id and medicine are required"}), 400

    try:
        quantity = int(quantity)
        if quantity < 1:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "quantity must be a positive integer"}), 400

    db = get_db()
    cur = db.execute(
        "INSERT INTO reservations (pharmacy_id, medicine_name, quantity, status) VALUES (?, ?, ?, 'pending')",
        (pharmacy_id, medicine, quantity),
    )
    db.commit()
    request_id = f"RES-{cur.lastrowid:06d}"

    return jsonify({
        "request_id": request_id,
        "status": "pending",
        "message": f"Your reservation for {quantity}x {medicine} at this pharmacy has been placed. The pharmacy has 30 minutes to confirm.",
    })


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(force=True) or {}
    message = data.get("message", "").strip()
    try:
        lat = float(data.get("lat", DEFAULT_LAT))
        lon = float(data.get("lon", DEFAULT_LON))
    except (ValueError, TypeError):
        lat, lon = DEFAULT_LAT, DEFAULT_LON

    db = get_db()
    result = process_chat_message(message, user_lat=lat, user_lon=lon, db_conn=db)
    return jsonify(result)


@app.route("/api/support/ticket", methods=["POST"])
def api_support_ticket():
    data = request.get_json(force=True) or {}
    user_name = data.get("user_name", "Anonymous").strip()
    contact = data.get("contact", "").strip()
    category = data.get("category", "General Inquiry").strip()
    subject = data.get("subject", "").strip() or f"{category} Request"
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Message description is required"}), 400

    db = get_db()
    ticket_code = create_support_ticket(db, user_name, contact, category, subject, message)
    if ticket_code:
        return jsonify({
            "success": True,
            "ticket_code": ticket_code,
            "message": f"Support ticket {ticket_code} created successfully! Our team will contact you shortly."
        })
    return jsonify({"error": "Failed to create support ticket"}), 500


@app.route("/api/support/tickets", methods=["GET"])
def api_get_support_tickets():
    ticket_code = request.args.get("code")
    db = get_db()
    if ticket_code:
        row = db.execute(
            "SELECT ticket_code, user_name, contact, category, subject, message, status, created_at FROM support_tickets WHERE ticket_code = ?",
            (ticket_code.strip(),)
        ).fetchone()
        if not row:
            return jsonify({"error": "Ticket not found"}), 404
        return jsonify(dict(row))

    rows = db.execute(
        "SELECT ticket_code, user_name, contact, category, subject, status, created_at FROM support_tickets ORDER BY id DESC LIMIT 50"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/reservation/<res_code>", methods=["GET"])
def api_reservation_status(res_code):
    db = get_db()
    info = lookup_reservation_status(db, res_code)
    if not info:
        return jsonify({"error": "Reservation not found"}), 404
    return jsonify(info)


# ---------------------------------------------------------------------------
# Routes — Orders & Express Delivery (Swiggy / Blinkit Style)
# ---------------------------------------------------------------------------

@app.route("/api/orders", methods=["POST"])
def api_place_order():
    import random
    data = request.get_json(force=True) or {}
    pharmacy_id = data.get("pharmacy_id")
    customer_name = (data.get("customer_name") or "Guest Patient").strip()
    customer_phone = (data.get("customer_phone") or "").strip()
    customer_address = (data.get("customer_address") or "").strip()
    delivery_type = data.get("delivery_type", "delivery")
    items = data.get("items", [])
    payment_method = data.get("payment_method", "upi")

    if not pharmacy_id:
        return jsonify({"error": "pharmacy_id is required"}), 400
    if not items or not isinstance(items, list):
        return jsonify({"error": "At least one medicine item is required"}), 400
    if delivery_type == "delivery" and (not customer_address or not customer_phone):
        return jsonify({"error": "Delivery address and phone number are required for express delivery"}), 400

    db = get_db()
    pharmacy = db.execute("SELECT id, name, address FROM pharmacies WHERE id = ?", (pharmacy_id,)).fetchone()
    if not pharmacy:
        return jsonify({"error": "Selected pharmacy does not exist"}), 404

    # Calculate line items and totals
    subtotal = 0.0
    processed_items = []
    for it in items:
        med_name = it.get("medicine_name") or it.get("medicine") or "Medicine"
        qty = max(1, int(it.get("quantity", 1)))
        unit_price = float(it.get("unit_price") or it.get("price") or get_medicine_price(med_name))
        line_total = round(unit_price * qty, 2)
        subtotal += line_total
        processed_items.append({
            "medicine_id": it.get("medicine_id"),
            "medicine_name": med_name,
            "strength": it.get("strength", ""),
            "form": it.get("form", "Tablet"),
            "quantity": qty,
            "unit_price": unit_price,
            "line_total": line_total
        })

    subtotal = round(subtotal, 2)
    # Blinkit/Swiggy model: Free delivery over ₹199, else ₹25
    delivery_fee = 0.0 if (subtotal >= 199.0 or delivery_type == "pickup") else 25.0
    discount = float(data.get("discount", 0.0))
    packaging_fee = 4.0 if delivery_type == "delivery" else 0.0
    total_amount = max(0.0, round(subtotal + delivery_fee + packaging_fee - discount, 2))

    # Order identification & simulated rider assignment
    order_code = f"MF-ORD-{random.randint(100000, 999999)}"
    delivery_otp = f"{random.randint(1000, 9999)}"
    eta = "15–20 mins" if delivery_type == "delivery" else "Ready in 10 mins"

    riders = [
        ("Ramesh Kumar", "+91 98765 43210"),
        ("Amit Swain", "+91 97761 24680"),
        ("Deepak Mohanty", "+91 94370 81923"),
        ("Pooja Nayak", "+91 99382 17462"),
        ("Suresh Rout", "+91 91240 55678")
    ]
    rider_name, rider_phone = random.choice(riders)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # Inventory deduction
    for it in processed_items:
        m_id = it.get("medicine_id")
        if m_id:
            db.execute(
                "UPDATE inventory SET quantity = MAX(0, quantity - ?), last_updated = ? WHERE pharmacy_id = ? AND medicine_id = ?",
                (it["quantity"], now, pharmacy_id, m_id)
            )
        else:
            m = db.execute("SELECT id FROM medicines WHERE LOWER(name) = LOWER(?)", (it["medicine_name"],)).fetchone()
            if m:
                db.execute(
                    "UPDATE inventory SET quantity = MAX(0, quantity - ?), last_updated = ? WHERE pharmacy_id = ? AND medicine_id = ?",
                    (it["quantity"], now, pharmacy_id, m["id"])
                )

    cur = db.execute(
        """
        INSERT INTO orders (
            order_code, pharmacy_id, pharmacy_name, customer_name, customer_phone,
            customer_address, delivery_type, items_json, subtotal, delivery_fee,
            discount, total_amount, payment_method, payment_status, status,
            rider_name, rider_phone, delivery_otp, estimated_delivery_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed', ?, ?, ?, ?, ?)
        """,
        (
            order_code, pharmacy_id, pharmacy["name"], customer_name, customer_phone,
            customer_address, delivery_type, json.dumps(processed_items), subtotal,
            delivery_fee, discount, total_amount, payment_method,
            "paid" if payment_method in ["upi", "card"] else "pending",
            rider_name, rider_phone, delivery_otp, eta, now
        )
    )
    db.commit()

    return jsonify({
        "success": True,
        "id": cur.lastrowid,
        "order_code": order_code,
        "delivery_otp": delivery_otp,
        "status": "placed",
        "pharmacy_name": pharmacy["name"],
        "estimated_delivery_time": eta,
        "total_amount": total_amount,
        "rider_name": rider_name,
        "rider_phone": rider_phone,
        "items_count": len(processed_items),
        "message": f"Order {order_code} placed successfully! Arriving in {eta}."
    })


@app.route("/api/orders/<order_code>", methods=["GET"])
def api_get_order(order_code):
    db = get_db()
    row = db.execute("SELECT * FROM orders WHERE order_code = ?", (order_code.strip(),)).fetchone()
    if not row:
        return jsonify({"error": "Order not found"}), 404

    order = dict(row)
    try:
        order["items"] = json.loads(order["items_json"])
    except Exception:
        order["items"] = []

    order["minutes_ago"] = minutes_since(order["created_at"])
    p = db.execute("SELECT address, latitude, longitude FROM pharmacies WHERE id = ?", (order["pharmacy_id"],)).fetchone()
    if p:
        order["pharmacy_address"] = p["address"]
        order["pharmacy_lat"] = p["latitude"]
        order["pharmacy_lon"] = p["longitude"]

    return jsonify(order)


@app.route("/api/orders/<order_code>/status", methods=["POST"])
def api_update_order_status(order_code):
    data = request.get_json(force=True) or {}
    new_status = data.get("status")
    allowed = ["placed", "preparing", "out_for_delivery", "delivered", "cancelled"]
    if new_status not in allowed:
        return jsonify({"error": f"Invalid status. Must be one of {allowed}"}), 400

    db = get_db()
    order = db.execute("SELECT id FROM orders WHERE order_code = ?", (order_code.strip(),)).fetchone()
    if not order:
        return jsonify({"error": "Order not found"}), 404

    db.execute("UPDATE orders SET status = ? WHERE order_code = ?", (new_status, order_code.strip()))
    db.commit()
    return jsonify({"success": True, "order_code": order_code, "status": new_status})


@app.route("/api/orders", methods=["GET"])
def api_list_orders():
    phone = request.args.get("phone")
    db = get_db()
    if phone:
        rows = db.execute("SELECT * FROM orders WHERE customer_phone = ? ORDER BY id DESC LIMIT 30", (phone.strip(),)).fetchall()
    else:
        rows = db.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 30").fetchall()

    results = []
    for r in rows:
        d = dict(r)
        try:
            d["items"] = json.loads(d["items_json"])
        except Exception:
            d["items"] = []
        d["minutes_ago"] = minutes_since(d["created_at"])
        results.append(d)
    return jsonify(results)


@app.route("/api/pharmacy/<int:pharmacy_id>/orders")
@login_required
def api_pharmacy_orders(pharmacy_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "Unauthorized"}), 403
    db = get_db()
    rows = db.execute(
        "SELECT * FROM orders WHERE pharmacy_id = ? ORDER BY id DESC LIMIT 50",
        (pharmacy_id,)
    ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["items"] = json.loads(d["items_json"])
        except Exception:
            d["items"] = []
        d["minutes_ago"] = minutes_since(d["created_at"])
        results.append(d)
    return jsonify(results)


@app.route("/api/pharmacy/<int:pharmacy_id>/orders/<int:order_id>/status", methods=["POST"])
@login_required
def api_pharmacy_order_status_update(pharmacy_id, order_id):
    if session["pharmacy_id"] != pharmacy_id:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json(force=True) or {}
    new_status = data.get("status")
    if new_status not in ["preparing", "out_for_delivery", "delivered", "cancelled"]:
        return jsonify({"error": "Invalid status"}), 400

    db = get_db()
    db.execute("UPDATE orders SET status = ? WHERE id = ? AND pharmacy_id = ?", (new_status, order_id, pharmacy_id))
    db.commit()
    return jsonify({"success": True, "order_id": order_id, "status": new_status})



# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("Database not found. Run seed.py first.")
    app.run(debug=True, host="0.0.0.0", port=5000)
