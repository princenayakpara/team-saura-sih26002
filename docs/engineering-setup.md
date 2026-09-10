# Engineering Setup & Verification Guide

This guide describes the local development setup, environment configurations, and verification procedures for the **SauraRoute** platform.

---

## 1. Prerequisites & Version Requirements

| Dependency | Minimum Version | Tested Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Java** | `17.x` | `Temurin 17.0.18+8` | Local GraphHopper 10.2 routing engine (`services/routing`) |
| **Node.js** | `>= 20.0.0` | `v20.x+` / `v22.x` | Backend API (`services/api`) and Web Dashboard (`apps/web`) |
| **npm** | `>= 9.0.0` | `10.x+` | Package manager |
| **Python** | `>= 3.10` | `3.12.10` | Geospatial and ML terrain processing (`services/ml`) |
| **Docker / Compose** | `>= 24.0.0` | Optional for local spikes | Runs PostgreSQL + PostGIS database container |

---

## 2. Automated Setup (Recommended)

To set up and run the entire SauraRoute ecosystem on Windows from scratch in two commands:

### Step 1: Run Automated Setup Script
```powershell
.\scripts\setup.ps1
```
This script automatically:
* Verifies system tools (Java 17, Node >= 20, Python 3.10+).
* Provisions root `.env` from `.env.example`.
* Creates `data/raw`, `data/processed`, and `services/ml/models` directories.
* Downloads `graphhopper-web-10.2.jar` (~44.2 MB) from Maven Central into `data/raw/` if missing.
* Downloads `north-eastern-zone-latest.osm.pbf` (~109 MB) from Geofabrik into `data/raw/` if missing.
* Installs npm dependencies for `@sauraroute/api` and `apps/web`.
* Configures Python virtual environment and trains the baseline ML classifier.

### Step 2: Start All Services
```powershell
.\scripts\start.ps1
```
Launches:
* **GraphHopper 10.2**: `http://localhost:8989` (Admin: `http://localhost:8990/healthcheck`)
* **SauraRoute API**: `http://localhost:3000` (Health: `http://localhost:3000/api/health`)
* **Web Dashboard**: `http://localhost:5173`

### Step 3: Run Health Diagnostics
```powershell
.\scripts\check.ps1
```

### Step 4: Stop All Services
```powershell
.\scripts\stop.ps1
```

---

## 3. Manual Service Configuration & Execution

### Service A: Local GraphHopper Routing Engine (`services/routing`)
1. From the repository root (requires Java 17):
   ```powershell
   .\services\routing\start-graphhopper.ps1
   ```
   *GraphHopper runs on `http://localhost:8989`.*

### Service B: PostgreSQL + PostGIS (Docker)
1. Start the container:
   ```bash
   docker compose up -d db
   ```
2. Run database migrations and seed baseline data:
   ```bash
   cd services/api
   npm run db:migrate
   npm run db:seed
   ```

### Service C: Node.js API (`services/api`)
1. Start the development server (with auto-reload):
   ```bash
   cd services/api
   npm run dev
   # Runs on http://localhost:3000
   ```
2. Run automated test suites:
   ```bash
   cd services/api
   npm test
   npm run test:routing-optimization
   npm run test:accessibility
   ```

### Service D: Vehicle Telemetry Simulator (`services/api`)
1. In a separate terminal, start the waypoint-driven telemetry simulator:
   ```bash
   cd services/api
   npx tsx src/scripts/simulate-telematics.ts
   ```

### Service E: Web Map Dashboard (`apps/web`)
1. Start the Vite development server:
   ```bash
   cd apps/web
   npm run dev
   # Access at http://localhost:5173
   ```
2. Run web linter and production build:
   ```bash
   cd apps/web
   npm run lint
   npm run build
   ```

### Service F: Python ML / Terrain Processing (`services/ml`)
1. Activate virtual environment and run tests:
   ```bash
   cd services/ml
   .\venv\Scripts\activate      # Windows (or source venv/bin/activate on Linux/macOS)
   python src/test_slope.py
   python src/test_classifier.py
   ```

---

## 4. How to Verify Each Service

### 1. Verify Real Routing Engine & Optimization (Steps 5 & 8)
* **Health Check:** `GET http://localhost:8989/health` $\rightarrow$ `200 OK`
* **Baseline Route (Guwahati → Shillong):**
   ```bash
   curl "http://localhost:3000/api/routes?originLat=26.1445&originLon=91.7362&destinationLat=25.5788&destinationLon=91.8933"
   ```
* **Hazard-Aware Route Optimization:**
   ```bash
   curl -X POST "http://localhost:3000/api/routes/optimize" -H "Content-Type: application/json" -d "{\"origin\": {\"latitude\": 26.1445, \"longitude\": 91.7362}, \"destination\": {\"latitude\": 25.5788, \"longitude\": 91.8933}, \"routingPreference\": \"BALANCED\"}"
   ```
* **Dynamic Reroute Evaluation:**
   ```bash
   curl -X POST "http://localhost:3000/api/routes/reroute" -H "Content-Type: application/json" -d "{\"origin\": {\"latitude\": 26.1445, \"longitude\": 91.7362}, \"destination\": {\"latitude\": 25.5788, \"longitude\": 91.8933}, \"currentRoute\": {\"origin\": {\"latitude\": 26.1445, \"longitude\": 91.7362}, \"destination\": {\"latitude\": 25.5788, \"longitude\": 91.8933}, \"distanceMeters\": 95992, \"durationSeconds\": 5274, \"geometry\": {\"type\": \"LineString\", \"coordinates\": [[91.7362, 26.1445], [91.8933, 25.5788]]}, \"instructions\": []}}"
   ```

### 2. Verify Risk Intelligence Foundation (Step 6)
* **Point Risk Assessment:**
   ```bash
   curl "http://localhost:3000/api/risk/point?lat=25.9036&lon=91.8794"
   ```
* **Corridor Route Risk Assessment:**
   ```bash
   curl -X POST "http://localhost:3000/api/risk/route" -H "Content-Type: application/json" -d "{\"coordinates\": [[91.7362, 26.1445], [91.7821, 25.9810], [91.8933, 25.5788]]}"
   ```
* **Hazard Zones GeoJSON:**
   ```bash
   curl "http://localhost:3000/api/risk/zones"
   ```

### 3. Verify Road Accessibility & Active Alerts (Step 9)
* **List Accessibility Corridors (GeoJSON):**
   ```bash
   curl "http://localhost:3000/api/accessibility"
   ```
* **Create Accessibility Corridor:**
   ```bash
   curl -X POST "http://localhost:3000/api/accessibility" -H "Content-Type: application/json" -d "{\"name\": \"NH-40 Test Corridor\", \"status\": \"CLOSED\", \"reason\": \"Landslide clearance\", \"source\": \"PWD\", \"geometry\": {\"type\": \"LineString\", \"coordinates\": [[91.8012, 25.9021], [91.8345, 25.8765]]}}"
   ```
* **Update Corridor Status:**
   ```bash
   curl -X PATCH "http://localhost:3000/api/accessibility/acc_01/status" -H "Content-Type: application/json" -d "{\"status\": \"RESTRICTED\", \"reason\": \"Single lane open\"}"
   ```
* **List Computed Alerts:**
   ```bash
   curl "http://localhost:3000/api/alerts"
   ```

### 4. Verify Incidents & Vehicles (Step 4)
* **Weather Integration:** `GET http://localhost:3000/api/weather?lat=26.1445&lon=91.7362`
* **List Incidents (GeoJSON):** `GET http://localhost:3000/api/incidents`
* **List Vehicles (GeoJSON):** `GET http://localhost:3000/api/vehicles`

### 5. Verify Machine Learning Classifiers (Step 7)
* **ML API Prediction:**
   ```bash
   curl "http://localhost:3000/api/ml/predict?lat=25.9036&lon=91.8794"
   curl "http://localhost:3000/api/ml/model"
   ```

### 6. Verify Web Application (MapLibre GL JS)
1. Open `http://localhost:5173`.
2. Inspect the map:
   * **Accessibility Layers:** Green (OPEN), dashed amber (RESTRICTED), and thick red (CLOSED) corridor lines with interactive metadata popups.
   * **Active Road Alerts:** HUD alert cards displaying CRITICAL road closures and WARNING restrictions.
   * **Route Optimization:** Select origin/destination, choose preference (FASTEST / BALANCED / SAFEST), and review baseline vs selected route comparison and accessibility status.
   * **Reroute Evaluation:** Dynamic evaluation of current route risk and corridor accessibility with recommendations.
