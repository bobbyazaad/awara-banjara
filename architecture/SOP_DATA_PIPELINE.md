# SOP: Data Pipeline & Supabase Schema Specifications

## 1. Data Flow Architecture
All tour itinerary data flows deterministically:
1. **Admin Panel (`admin.html`):** User submits form -> Supabase `upsert()` on `trips` table -> Saved to `localStorage` backup cache.
2. **Catalog Loaders (`trips-loader.js`):** Queries Supabase `trips` -> Render home carousels, budget sections, categorized grids, and card stack.
3. **Master Detail Page (`trip-detail-loader.js`):** Reads `?id=<ID>` from URL -> Fetches matching record from Supabase -> Dynamically populates all 24 detail macros.

## 2. Supabase `trips` Table Column Specifications
| Column Name | Type | Description |
|---|---|---|
| `id` | bigint (PK) | Auto-incrementing primary key |
| `title` | text | Unique trip title |
| `category` | text | Category key (`spiti_tours`, `bike_expeditions`, `festival_tours`, `treks`, `women_special`, `offbeat_himalayan`) |
| `duration` | text | Badge string e.g. `6 Days / 5 Nights` |
| `price` | text | Price tag e.g. `₹16,499` |
| `route` | text | Subtitle route string e.g. `Leh — Khardung La — Nubra` |
| `tags` | jsonb / text | Comma-separated tag badges |
| `image_url` | text | Main thumbnail image path/URL |
| `bento_img_1..5` | text | Bento 5-photo grid image paths |
| `about_text` | text | Overview description text |
| `itinerary` | jsonb | Array of day objects `[{ day, points }]` |
| `inclusions` | jsonb | Array of inclusion item strings |
| `exclusions` | jsonb | Array of exclusion item strings |
| `package_options` | jsonb | Array of package option objects `[{ title, price }]` |
| `sub_package_options` | text | Sub-package option details |
| `departure_dates` | jsonb | Departure batches `[{ month, dates }]` |
| `faqs` | jsonb | FAQ items `[{ question, answer }]` |
| `reviews` | jsonb | User reviews `[{ name, location, text, avatar }]` |
| `reserve_banner_title` | text | Reserve section header |
| `reserve_banner_sub` | text | Reserve section subtitle |
| `custom_quote_title` | text | Private trip section header |
| `custom_quote_sub` | text | Private trip section subtitle |
| `whatsapp_number` | text | Direct contact WhatsApp number |
