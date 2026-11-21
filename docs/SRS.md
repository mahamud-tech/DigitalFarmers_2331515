# Software Requirements Specification (SRS)
**Project Title:** DigitalFarmers  
**Version:** 1.0  
**Target Releases:** MVP (Mid-Term) & Beta (Final)  

---

## 1. System Overview
DigitalFarmers is a decoupled client-server web application built with a **React + TypeScript** single-page frontend and a **FastAPI (Python)** RESTful backend connected to **Supabase (PostgreSQL)**. In local development, Vite proxies `/api/*` requests to FastAPI (`localhost:8000`); in production, Vercel routes `/api/*` to the FastAPI serverless entrypoint and `/*` to the static Vite bundle.

---

## 2. Functional Requirements

### 2.1 Crop Listings Management (Core Domain)
| Req ID | Requirement Description | Release |
| :--- | :--- | :--- |
| **FR-01** | The system shall allow creating a new crop listing via `POST /api/crops` with validated `farmer_name`, `crop_name`, `category`, `quantity_kg > 0`, `price_per_kg > 0`, `location`, and `status`. | **MVP** |
| **FR-02** | The system shall retrieve and display a list of all crop listings via `GET /api/crops`. | **MVP** |
| **FR-03** | The system shall retrieve and display a single crop listing by integer `id` via `GET /api/crops/{crop_id}`, returning HTTP `404` if not found. | **MVP** |
| **FR-04** | The system shall allow updating one or more fields of an existing crop listing via `PUT /api/crops/{crop_id}`, updating `updated_at` and returning HTTP `404` if not found. | **MVP** |
| **FR-05** | The system shall allow deleting an existing crop listing via `DELETE /api/crops/{crop_id}`, returning HTTP `404` if not found. | **MVP** |
| **FR-06** | The frontend shall provide interactive forms, single-item detail inspection, inline edit state, and delete actions without full page reloads. | **MVP** |

### 2.2 Authentication, RBAC & User Dashboard
| Req ID | Requirement Description | Release |
| :--- | :--- | :--- |
| **FR-07** | The system shall provide user registration and login endpoints issuing signed Bearer JWT tokens. | **Beta** |
| **FR-08** | The system shall enforce Role-Based Access Control (`farmer`, `buyer`, `admin`) and FastAPI security scopes on protected endpoints. | **Beta** |
| **FR-09** | The system shall restrict `PUT /api/crops/{crop_id}` and `DELETE /api/crops/{crop_id}` so farmers can only modify their own listings (unless the user has `admin` scope). | **Beta** |
| **FR-10** | The frontend shall provide a User Profile Dashboard displaying user profile details, role badge, and user-owned crop listings. | **Beta** |

---

## 3. Non-Functional Requirements
| Req ID | Category | Specification | Release |
| :--- | :--- | :--- | :--- |
| **NFR-01** | **Input Validation** | All API payloads shall be strictly validated using Pydantic v2 models, automatically returning HTTP `422 Unprocessable Entity` on invalid types or negative values. | **MVP** |
| **NFR-02** | **Type Safety** | Frontend components and API responses shall use strict TypeScript interfaces (`strict: true` in `tsconfig.json`). | **MVP** |
| **NFR-03** | **API Performance** | Standard local REST CRUD operations shall respond within 300 ms under normal single-user/demo load. | **MVP** |
| **NFR-04** | **Security & Secrets** | Database credentials (`SUPABASE_URL`, `SUPABASE_KEY`) and JWT secrets shall be stored exclusively in environment variables (`.env` / Vercel Env) and excluded from Git via `.gitignore`. | **MVP** & **Beta** |
| **NFR-05** | **Authorization** | Protected Beta endpoints shall validate JWT signatures and OAuth2 scopes before executing database mutations. | **Beta** |
| **NFR-06** | **Availability** | The Beta release shall deploy cleanly on Vercel with `/api/health` returning `200 OK`. | **Beta** |

---

## 4. External Interface Requirements
- **REST API Interface:** JSON over HTTP (`Content-Type: application/json`) under `/api/*`, documented automatically via OpenAPI/Swagger UI at `/docs`.
- **Database Interface:** PostgreSQL hosted on Supabase accessed via HTTPS PostgREST / SQL driver using environment-configured keys.