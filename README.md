# SauraRoute

[![Project Status: Step 9 Implemented & Verified](https://img.shields.io/badge/status-Step%209%20Verified-blue.svg)](#current-project-status)

* **Team Name:** Team Saura
* **Problem Statement Reference:** SIH26002
* **Problem Statement Title:** AI-Based Smart Logistics and Accessibility Intelligence Platform for North Eastern Region (NER)
* **Hackathon:** Smart India Hackathon 2026 (SIH 2026)

---

## Current Project Status
> [!NOTE]
> **Status: Step 9 — Road Accessibility Intelligence & Active-Route Alerts (implemented & verified).**

The core logistics intelligence platform, hazard-aware route optimization, and accessibility layers are implemented and verified.

| Component | Status |
|---|---|
| Foundation / project scaffolding | Completed |
| Data discovery & GIS research | Completed |
| API service (Node.js + TypeScript + Express) | Implemented — verified via HTTP |
| PostGIS schema & migrations | Implemented — in-memory fallback active when PostgreSQL unavailable |
| Weather integration (Open-Meteo) | Implemented — verified via HTTP |
| Incident API (create/list/status + GeoJSON) | Implemented — verified via HTTP |
| Vehicle API + telemetry simulator | Implemented — verified via HTTP |
| Web dashboard (React + Vite + MapLibre) | Implemented — build and lint passing |
| OSM / GraphHopper routing | Implemented — baseline routing (Step 5) |
| Risk Intelligence Engine | Implemented — multi-factor $[0, 100]$ scoring (Step 6) |
| ML prediction service | Implemented — advisory Random Forest classifier (Step 7) |
| Hazard-aware route optimization & rerouting | Implemented — candidate-route evaluation within 1.35× detour limit (Step 8) |
| Road accessibility & corridor tracking | Implemented — OPEN / RESTRICTED / CLOSED corridor states with closure-aware routing (Step 9) |
| Active-route alert engine | Implemented — deterministic on-read generation of road closures and restrictions (Step 9) |
| Automated test suites | 107 passing backend tests (54 API + 13 routing + 40 accessibility) + 8 Python ML unit tests |
| API & web production builds | Passing |
| Authentication | Planned (later step) |
| Mobile field app | Planned (later step) |

> [!NOTE]
> **Architectural Honesty:**
> 1. **Candidate-Route Optimization:** SauraRoute evaluates multiple candidate routes returned by GraphHopper and applies accessibility filtering and risk optimization in the application layer. GraphHopper edge weights are not dynamically altered at runtime.
> 2. **Prototype Proximity Heuristic:** Corridor intersection detection uses an equirectangular point-to-segment distance algorithm with a 250m tolerance threshold. This is a geometric proximity heuristic, not authoritative road-topology intersection.
> 3. **Database Fallback:** The API service operates seamlessly with an in-memory fallback store when PostgreSQL/PostGIS is unavailable.

---

## Problem Statement Summary
The North Eastern Region (NER) of India faces unique geographical, meteorological, and infrastructural challenges that severely disrupt supply chains and logistics operations. Landslides, heavy rainfall, flooding, rugged terrains, and limited transport connectivity make route planning highly unpredictable. There is a critical need for an intelligent logistics platform that leverages AI/ML and geospatial data to recommend optimal, safe, and accessible routes in real time, factoring in weather changes, terrains, incidents, and road blockages.

---

## High-Level Solution
**SauraRoute** is an AI-Based Smart Logistics and Accessibility Intelligence Platform designed specifically for the NER. It integrates:
1. **GIS & Map Visualizations:** Displays road conditions, terrains, historical landslide zones, and interactive accessibility overlays using MapLibre GL JS.
2. **AI-Based Risk Prediction:** Evaluates route vulnerability using weather, terrain slope, active incidents, historical hotspots, and Random Forest ML models.
3. **Route Optimization & Rerouting:** Evaluates GraphHopper alternative candidate routes to avoid high hazard zones and closed road corridors.
4. **Road Accessibility & Alert Intelligence:** Tracks corridor statuses (`OPEN`, `RESTRICTED`, `CLOSED`) and computes active road closure alerts.
5. **Interactive Operations Dashboard:** Enables logistics planners to monitor fleets, review incident reports, and examine region-wide risk analyses.

---

## Quick Start (Fresh Machine Setup)

Fresh Windows clones can be initialized and started with **two commands**:

```powershell
# 1. Prepare runtime assets, directories, and package dependencies:
.\setup.ps1

# 2. Start GraphHopper (:8989), API (:3000), and Web UI (:5173):
.\start.ps1

# 3. Optional: Run health check & endpoint verification:
.\check.ps1
```

For detailed configuration instructions and manual execution steps, see [docs/engineering-setup.md](file:///c:/Users/Admin/Desktop/SIH/team-saura-sih26002/docs/engineering-setup.md).

---

## Technology Stack
* **Frontend (Web):** React, TypeScript, TailwindCSS, MapLibre GL JS, Vite
* **Backend API Service:** Node.js, TypeScript, Express, PostGIS / PostgreSQL (`pg`)
* **Routing Engine:** GraphHopper 10.2 (Java 17) with North-East India OSM road network
* **Machine Learning Service:** Python 3.12, Scikit-learn, Joblib, NumPy
* **Database & GIS:** PostgreSQL with PostGIS extension (with complete in-memory fallback)

---

## Repository Structure
```text
team-saura-sih26002/
├── apps/
│   ├── web/                # React + MapLibre Operations Dashboard
│   └── mobile/             # Planned Field Reporting App
├── services/
│   ├── api/                # Express + TypeScript REST API Service
│   ├── ml/                 # Python Machine Learning & DEM Slope Service
│   └── routing/            # Local GraphHopper 10.2 Service
├── packages/
│   └── shared/             # Shared types and constants
├── data/
│   ├── raw/                # Raw datasets (OSM PBF, DEM GeoTIFF)
│   ├── processed/          # Processed data (historical landslides catalog)
│   └── README.md           # Dataset descriptions and licensing notes
├── docs/
│   ├── problem-understanding.md   # Domain research and user needs
│   ├── architecture.md            # System architecture and data flow diagram
│   ├── api-contract.md            # REST API endpoints and data contracts
│   ├── engineering-setup.md       # Setup, execution, and verification guide
│   ├── database-design.md         # Schema entities, fields, and relationships
│   ├── data-strategy.md           # Data requirements and fallback strategies
│   └── decisions.md               # Architectural Decision Log (ADL)
├── .env.example            # Example environment configurations
├── .gitignore              # Ignored files, local environment secrets, caches
├── docker-compose.yml      # Multi-container local orchestration configuration
└── README.md               # Main project documentation (this file)
```

---

## Development Principles
1. **Security & Privacy First:** No real API keys, environment credentials, or proprietary files are committed to the repository.
2. **Data Honesty:** We clearly distinguish simulated, placeholder, and actual data. No simulated data is presented as live production feeds.
3. **Modular Monorepo:** Applications and services are organized in dedicated workspaces with clear boundaries.
4. **Architectural Accuracy:** Documentation strictly reflects implemented capabilities rather than unbuilt designs.
