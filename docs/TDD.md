# Technical Design Document (TDD)
**Project Title:** DigitalFarmers  
**Repository:** `https://github.com/mahamud-tech/DigitalFarmers_2331515`  

---

## 1. System Architecture

```text
+-----------------------------------+
|   React 19 + TypeScript (Vite)    |
|  - CropForm (Create / Update)     |
|  - CropList (Read List / Delete)  |
|  - CropDetail (Read Single)       |
|  - ProfileDashboard [Beta]        |
+-----------------+-----------------+
                  | HTTP / JSON (/api/*)
                  v
+-----------------------------------+
|       FastAPI Backend (Python)    |
|  - Pydantic Request/Response DTOs |
|  - REST Routers (/api/crops)      |
|  - JWT & RBAC Scopes [Beta]       |
+-----------------+-----------------+
                  | HTTPS / REST / SQL
                  v
+-----------------------------------+
|      Supabase (PostgreSQL)        |
|  - public.crop_listings [MVP]     |
|  - public.farmers / users [Beta]  |
+-----------------------------------+