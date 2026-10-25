from flask import Flask, render_template, request, jsonify
from math import radians, sin, cos, sqrt, atan2
import requests
import os

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

OSRM_BASE = os.environ.get("OSRM_BASE_URL", "https://router.project-osrm.org")
NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
HEADERS = {"User-Agent": "SmartRouteFinder/1.0 (educational project)"}


def haversine_km(a, b):
    """Approximate straight-line distance between [lat, lon] coordinates."""
    lat1, lon1 = map(radians, a)
    lat2, lon2 = map(radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * atan2(sqrt(h), sqrt(1 - h))


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "Smart Route Finder API"})


@app.get("/api/geocode")
def geocode():
    query = request.args.get("q", "").strip()
    if len(query) < 2:
        return jsonify({"error": "Please enter at least 2 characters."}), 400
    try:
        response = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "jsonv2", "limit": 5},
            headers=HEADERS,
            timeout=12,
        )
        response.raise_for_status()
        data = response.json()
        return jsonify([
            {
                "name": item.get("display_name", query),
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
            }
            for item in data
        ])
    except requests.RequestException:
        return jsonify({"error": "Geocoding service is unavailable. Try again shortly."}), 502


@app.post("/api/route")
def route():
    body = request.get_json(silent=True) or {}
    try:
        origin = [float(body["origin"]["lat"]), float(body["origin"]["lon"])]
        destination = [float(body["destination"]["lat"]), float(body["destination"]["lon"])]
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Origin and destination coordinates are required."}), 400

    # OSRM expects longitude,latitude coordinate pairs.
    coords = f'{origin[1]},{origin[0]};{destination[1]},{destination[0]}'
    url = f"{OSRM_BASE.rstrip('/')}/route/v1/driving/{coords}"
    try:
        response = requests.get(
            url,
            params={"overview": "full", "geometries": "geojson", "alternatives": "true", "steps": "false"},
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("code") != "Ok" or not payload.get("routes"):
            return jsonify({"error": "No driving route found between these locations."}), 404

        routes = []
        for index, item in enumerate(payload["routes"][:3]):
            distance_km = item["distance"] / 1000
            duration_min = item["duration"] / 60
            routes.append({
                "id": index + 1,
                "distance_km": round(distance_km, 2),
                "duration_min": round(duration_min),
                "geometry": item["geometry"]["coordinates"],
                "summary": "Recommended route" if index == 0 else f"Alternative {index}",
            })
        return jsonify({"routes": routes, "source": "OSRM", "notice": "Times and routes are estimates and may not reflect live traffic."})
    except requests.RequestException:
        return jsonify({"error": "Routing service is unavailable. Check your internet connection and try again."}), 502


@app.post("/api/fuel-estimate")
def fuel_estimate():
    body = request.get_json(silent=True) or {}
    try:
        distance = float(body.get("distance_km", 0))
        mileage = float(body.get("mileage_kmpl", 0))
        price = float(body.get("fuel_price", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Distance, mileage and fuel price must be numbers."}), 400

    if distance < 0 or mileage <= 0 or price < 0:
        return jsonify({"error": "Distance and fuel price must be non-negative; mileage must be greater than zero."}), 400
    litres = distance / mileage
    return jsonify({
        "fuel_litres": round(litres, 2),
        "fuel_cost": round(litres * price, 2),
        "distance_km": round(distance, 2),
    })


@app.post("/api/compare")
def compare():
    body = request.get_json(silent=True) or {}
    routes = body.get("routes", [])
    try:
        mileage = max(float(body.get("mileage_kmpl", 15)), 0.1)
        fuel_price = max(float(body.get("fuel_price", 100)), 0)
        toll_cost = max(float(body.get("toll_cost", 0)), 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Cost inputs must be valid numbers."}), 400

    results = []
    for route_item in routes[:3]:
        distance = float(route_item.get("distance_km", 0))
        duration = float(route_item.get("duration_min", 0))
        fuel = (distance / mileage) * fuel_price
        results.append({
            "id": route_item.get("id"),
            "distance_km": round(distance, 2),
            "duration_min": round(duration),
            "estimated_fuel_cost": round(fuel, 2),
            "estimated_total_cost": round(fuel + toll_cost, 2),
        })
    return jsonify({"comparison": results, "disclaimer": "Fuel and toll figures are estimates; actual costs vary by vehicle and route."})


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
