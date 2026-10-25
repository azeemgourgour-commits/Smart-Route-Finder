# RouteWise — Smart Route Finder

A professional-looking Smart Route Finder web application built with **Python Flask**, **Leaflet**, **OpenStreetMap**, and the **OSRM routing service**. Includes a dark/light theme, geocoding, route alternatives, route comparison, fuel estimates, saved trips, and local trip history.

## Features

- Responsive dashboard UI with **dark mode / light mode** toggle (theme persists in the browser).
- Interactive OpenStreetMap powered by Leaflet.
- Search suggestions for source and destination using Nominatim geocoding.
- Route calculation and up to three available driving-route options using OSRM.
- Compare route distance, estimated duration, and estimated fuel cost.
- Optimization preference selector: balanced, fastest, shortest, or lower fuel cost.
- Use current location (browser permission required).
- Quick destination shortcuts.
- Save a route or place, and review/repeat recent searches.
- Flask REST API with validation and friendly error handling.
- Fuel estimate API and route comparison API.
- Responsive layout for desktop and mobile.

## Requirements

- Python 3.10 or newer recommended
- Internet connection for map tiles, geocoding and routing services
- Modern browser

## Run locally (Windows)

1. Extract the ZIP file.
2. Open the extracted `smart_route_finder` folder in VS Code.
3. Open the terminal in that folder.
4. Create a virtual environment:

   ```powershell
   py -m venv .venv
   .venv\Scripts\activate
   ```

5. Install dependencies:

   ```powershell
   python -m pip install -r requirements.txt
   ```

6. Start the app:

   ```powershell
   python app.py
   ```

7. Open `http://127.0.0.1:5000` in your browser.

## Run locally (macOS / Linux)

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Then open `http://127.0.0.1:5000`.

## API endpoints

### `GET /api/health`
Returns a basic service health status.

### `GET /api/geocode?q=Chandigarh`
Returns up to five matching places with name and coordinates.

### `POST /api/route`
Request JSON:

```json
{
  "origin": {"lat": 30.7333, "lon": 76.7794},
  "destination": {"lat": 30.7046, "lon": 76.7179}
}
```

Returns available route alternatives, route geometry, distance and estimated duration.

### `POST /api/fuel-estimate`
Request JSON:

```json
{
  "distance_km": 25,
  "mileage_kmpl": 18,
  "fuel_price": 100
}
```

### `POST /api/compare`
Request JSON:

```json
{
  "routes": [
    {"id": 1, "distance_km": 25, "duration_min": 40}
  ],
  "mileage_kmpl": 18,
  "fuel_price": 100,
  "toll_cost": 0
}
```

## Configuration

Optional environment variables:

- `OSRM_BASE_URL`: OSRM-compatible routing endpoint.
- `NOMINATIM_URL`: Nominatim-compatible geocoding endpoint.

An `.env.example` file is included as a reference. Environment variables are read by Python from the process environment; the app does not automatically load `.env` files.

## Project structure

```text
smart_route_finder/
├── app.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js
```

## Important limitations

- Public OSM/Nominatim and demo OSRM services have usage policies, rate limits, and no uptime guarantee. Do not use the public demo services for high-volume or commercial production workloads.
- Route duration is a routing estimate, **not live traffic prediction**.
- Toll cost is not returned by this implementation; the displayed fuel estimate excludes tolls.
- Saved places and trip history are stored in browser local storage, not in a user-account database.
- This is an educational starter project. Before public deployment, add authentication if needed, CSRF/security controls, rate limiting, monitoring, and a production WSGI server. Do not deploy Flask debug mode publicly.
- The map uses third-party CDN assets and map services, so an internet connection is required.

## Suggested future improvements

- User accounts and PostgreSQL persistence
- Live traffic and road-closure data integration
- Machine-learning ETA prediction trained on a suitable dataset
- Multi-stop route optimization with Google OR-Tools
- EV charging-aware planning
- Route safety score with sourced, validated data
- Unit tests and deployment configuration
