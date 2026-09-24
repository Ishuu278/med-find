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

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "medfind-dev-secret-change-in-prod")

DB_PATH = "medfind.db"
WEIGHTS_PATH = "model_weights.json"
DEFAULT_LAT = 20.2961
DEFAULT_LON = 85.8245

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
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
        delta = datetime.utcnow() - dt
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
            "medicine": row["medicine"],
            "strength": row["strength"],
            "form": row["form"],
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
        return jsonify({
            "logged_in": True,
            "pharmacy_id": session["pharmacy_id"],
            "name": session["pharmacy_name"],
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
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        "UPDATE inventory SET quantity = ?, last_updated = ? WHERE pharmacy_id = ? AND medicine_id = ?",
        (quantity, now, pharmacy_id, medicine_id),
    )
    db.commit()

    return jsonify({"success": True, "quantity": quantity, "last_updated": now})


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
    # Use first word of medicine name (as per backend contract)
    medicine_key = medicine.split()[0]

    cur = db.execute(
        "INSERT INTO reservations (pharmacy_id, medicine_name, quantity, status) VALUES (?, ?, ?, 'pending')",
        (pharmacy_id, medicine_key, quantity),
    )
    db.commit()
    request_id = f"RES-{cur.lastrowid:06d}"

    return jsonify({
        "request_id": request_id,
        "status": "pending",
        "message": f"Your reservation for {quantity}x {medicine} at this pharmacy has been placed. The pharmacy has 30 minutes to confirm.",
    })


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("Database not found. Run seed.py first.")
    app.run(debug=True, host="0.0.0.0", port=5000)
