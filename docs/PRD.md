# Product Requirements Document (PRD)
**Project Title:** DigitalFarmers — Direct Farmer-to-Buyer Crop Marketplace  
**Repository:** `https://github.com/mahamud-tech/DigitalFarmers_2331515`  
**Student ID:** 2331515  
**Tech Stack:** React (TypeScript), FastAPI (Python), Supabase (PostgreSQL), Vercel  

---

## 1. Problem Statement & Vision
Smallholder farmers in Bangladesh frequently rely on layered middlemen to sell harvested produce, reducing farm-gate profit margins while obscuring real-time supply and pricing for local buyers. **DigitalFarmers** provides a clean, lightweight digital marketplace where farmers can publish available crop harvests and buyers can browse transparent quantities, unit prices, and district locations directly.

---

## 2. Target Users & Personas
| Persona | Role | Primary Goal | Release |
| :--- | :--- | :--- | :--- |
| **Farmer** | Producer / Seller | List harvested crops with quantity (kg), price per kg (BDT), and district; update stock or mark harvests as sold. | **MVP** & **Beta** |
| **Buyer** | Wholesale / Retail Purchaser | Browse available produce listings, inspect single crop details, and place purchase inquiries/orders. | **MVP** & **Beta** |
| **Admin** | Platform Moderator | Verify farmer accounts, audit crop listings, and manage role permissions. | **Beta** |

---

## 3. Release Roadmap (MVP vs. Beta)

### Release 1: Minimum Viable Product (MVP — Mid-Term Demo)
Focuses on end-to-end core domain functionality running locally via REST APIs and persisted in Supabase:
- **[MVP]** **Create Crop Listing:** Add a new crop entry (`farmer_name`, `crop_name`, `category`, `quantity_kg`, `price_per_kg`, `location`, `status`).
- **[MVP]** **Read Crop Listings (List View):** Fetch and display all crop listings in a structured interface.
- **[MVP]** **Read Single Crop Listing (Detail View):** Inspect full metadata and timestamps of a single crop listing by ID.
- **[MVP]** **Update Crop Listing:** Edit existing crop price, available quantity, location, or availability status (`available`, `reserved`, `sold`).
- **[MVP]** **Delete Crop Listing:** Remove obsolete or erroneous crop entries from the marketplace.

### Release 2: Beta Release (Final Demo)
Extends the MVP with security, multi-user ownership, personalization, and cloud deployment:
- **[Beta]** **User Authentication:** Sign up, login, and JWT/session token verification via Supabase Auth / FastAPI dependencies.
- **[Beta]** **Role-Based Access Control (RBAC):** Distinct roles (`farmer`, `buyer`, `admin`) with enforced API security scopes (`crops:write`, `crops:read`, `admin:manage`).
- **[Beta]** **User Profile Dashboard:** Personalized dashboard showing a farmer's own active/sold listings or a buyer's saved/ordered crops.
- **[Beta]** **Production Cloud Deployment:** Full-stack deployment on Vercel with environment-configured Supabase PostgreSQL persistence.

---

## 4. User Stories & Acceptance Criteria

| ID | User Story | Acceptance Criteria | Release |
| :--- | :--- | :--- | :--- |
| **US-01** | As a farmer, I want to publish a crop listing so buyers can see my available harvest. | Submitting valid crop fields creates a record (`201 Created`) and displays it in the listing feed. | **MVP** |
| **US-02** | As a buyer, I want to view all available crop listings so I can compare prices and quantities. | Opening the app loads all crop records (`200 OK`) with crop name, farmer, quantity, price, and status. | **MVP** |
| **US-03** | As a buyer, I want to inspect a single crop listing so I can verify complete harvest details. | Selecting **View** fetches `/api/crops/{id}` (`200 OK`) and displays full details and timestamps. | **MVP** |
| **US-04** | As a farmer, I want to update my crop's price, quantity, or status when stock changes. | Editing a listing sends `PUT /api/crops/{id}` (`200 OK`) and immediately updates the UI. | **MVP** |
| **US-05** | As a farmer, I want to delete a listing posted by mistake. | Clicking **Delete** sends `DELETE /api/crops/{id}` (`200 OK`) and removes the card from the UI. | **MVP** |
| **US-06** | As a registered user, I want to log in securely so only I can modify or delete my own listings. | Unauthenticated or unauthorized `PUT`/`DELETE` requests return `401`/`403` based on RBAC scopes. | **Beta** |
| **US-07** | As a farmer or buyer, I want a role-specific profile dashboard to manage my listings and orders. | Authenticated users see filtered metrics and listings tied to their `user_id`. | **Beta** |

---

## 5. Out of Scope (To Keep Scope Realistic)
- Automated mobile banking / payment gateway processing (bKash/Nagad integration).
- Real-time GPS fleet tracking for agricultural transport trucks.
- AI crop disease image diagnosis.