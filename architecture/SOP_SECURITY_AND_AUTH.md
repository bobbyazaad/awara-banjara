# SOP: Security, Authentication & Authorization Specifications

## 1. Executive Summary
This Standard Operating Procedure defines the security architecture, token-based authentication protocol, authorization guard matrix, and secret management standards for the Awara Banjara platform.

## 2. Authentication Protocol & Lifecycle

### 2.1 Credential & Hash Storage
- Admin credentials are stored in `.env` (never hardcoded in source code).
- Passwords are verified against SHA-256 / PBKDF2 cryptographic hashes.

### 2.2 Token Generation & Session Management
1. **Login Request:** Client submits `POST /api/auth/login` with `{ username, password }`.
2. **Verification:** Server checks credentials against `.env`.
3. **Session Token:** Upon successful validation, server generates a 64-character random hexadecimal session token (`crypto.randomBytes(32).toString('hex')`) with a 24-hour expiration timestamp.
4. **Client Persistence:** Client receives `{ success: true, token, expiresAt }` and stores the token in `localStorage.setItem('awara_admin_token', token)`.
5. **Request Authorization:** Client passes `Authorization: Bearer <token>` in HTTP headers for all protected API requests.

### 2.3 Verification & Logout
- **Session Check:** `GET /api/auth/verify` validates the token provided in `Authorization: Bearer <token>`.
- **Logout:** `POST /api/auth/logout` invalidates the token in the server's session registry and purges client storage.

## 3. API Authorization Guard Matrix

| API Endpoint | HTTP Method | Access Level | Description |
| :--- | :---: | :---: | :--- |
| `/api/auth/login` | `POST` | Public | Rate-limited login endpoint |
| `/api/auth/verify` | `GET` | Public | Session verification check |
| `/api/auth/logout` | `POST` | Admin | Session termination |
| `/api/trips` | `GET` | Public | List active trips |
| `/api/trips/:id` | `GET` | Public | Single trip detail view |
| `/api/trips` | `POST` | Admin | Create/Update trip (Requires Bearer Token) |
| `/api/trips/:id` | `PUT`/`DELETE` | Admin | Modify/Delete trip (Requires Bearer Token) |
| `/api/destinations` | `GET` | Public | List destinations |
| `/api/destinations` | `POST`/`DELETE` | Admin | Modify destinations (Requires Bearer Token) |
| `/api/reviews` | `GET` | Public | List reviews |
| `/api/reviews` | `POST`/`DELETE` | Admin | Modify reviews (Requires Bearer Token) |
| `/api/inquiries` | `POST` | Public | Customer booking lead submission |
| `/api/inquiries` | `GET`/`PUT`/`DELETE` | Admin | Access customer PII (Requires Bearer Token) |
| `/api/site-config` | `GET` | Public | Public site config |
| `/api/site-config` | `POST` | Admin | Update site config (Requires Bearer Token) |
| `/api/upload` | `POST` | Admin | Image upload (Requires Bearer Token) |
| `/api/export` / `/api/import` | `GET`/`POST` | Admin | Database backup/restore (Requires Bearer Token) |

## 4. Rate Limiting & Header Security
- **Rate Limit:** Maximum 5 login attempts per 30 seconds per IP address.
- **Security Headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
