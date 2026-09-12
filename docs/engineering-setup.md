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

## 2. Quick Automated Setup & Launch Workflow

Fresh developer clones can prepare, launch, and verify the entire SauraRoute stack with three automated scripts:

### Step 1: Automated Local Setup
Runs prerequisite checks, creates required data directories, copies `.env.example` -> `.env`, downloads and verifies GraphHopper 10.2 JAR and NER OpenStreetMap extract (`.osm.pbf`), and installs Node.js & Python dependencies:

```powershell
.\setup.ps1
```

### Step 2: Stack Launcher
Launches local GraphHopper (`:8989`), API service (`:3000`), and Web dashboard (`:5173`) in background process windows and prints active URLs:

```powershell
.\start.ps1
```

### Step 3: Health & Dependency Verification
Verifies presence and file integrity of runtime data assets and tests live HTTP endpoints:

```powershell
.\check.ps1
```

---

## 3. Environment Configuration

Copy `.env.example` to `.env` in the repository root:

```ini
# --- API Port ---
API_PORT=3000

# --- Database Configurations ---
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sauraroute_db
DB_USER=postgres
DB_PASSWORD=sauraroute_dev_2026
DB_URL=postgresql://postgres:sauraroute_dev_2026@localhost:5432/sauraroute_db

# --- GraphHopper Routing ---
GRAPHHOPPER_URL=http://localhost:8989
GRAPHHOPPER_TIMEOUT_MS=5000
GRAPHHOPPER_PROFILE=car
```

---

## 3. How to Start Each Service

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
