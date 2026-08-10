# SOP: Master Control Admin System Specifications

## 1. Executive Summary
The Master Control Admin System in `admin.html` provides 100% administrative control over all website content, section feature flags, carousels, card stack, site-wide configuration settings, and inquiry lead tracking.

## 2. Authentication & Access Control
- `admin.html` is protected behind a zero-trust glassmorphic login modal `#adminLoginModal`.
- Access requires valid authentication against `.env` credentials (`ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`).
- Upon login, a session token is stored in `localStorage.setItem('awara_admin_token', token)`.
- All administrative HTTP requests carry `Authorization: Bearer <token>`.
- A prominent "Logout" button in the top navbar destroys active session state.

## 3. Database Schema Extensions

### A. Extended `public.trips` Section Feature Flags
- `is_featured_reels` (boolean, default true): Toggles appearance in **From Reels to Real Carousel**.
- `is_featured_stack` (boolean, default true): Toggles appearance in **Featured Flip Cards Stack**.
- `is_featured_lemonade` (boolean, default true): Toggles appearance in **Lemonade Budget Section**.
- `featured_order` (integer, default 0): Sorting order rank.

### B. Table `public.site_config`
```sql
CREATE TABLE IF NOT EXISTS public.site_config (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

Default Keys:
- `site_phone`: `+91- 9103910523`
- `whatsapp_number`: `+91-9103910523`
- `announcement_bar`: `✨ Escape the ordinary — Explore handpicked Himalayan group trips!`
- `hero_headline`: `Awara Banjara`
- `hero_subtitle`: `Curated Himalayan Escapes, Motorbike Expeditions & Offbeat Group Trips`

## 4. UI Dashboard Structure (`admin.html`)
1. **Section 1: Full Itinerary Maker & Section Feature Toggles:**
   - 24 Detail Macros + Checkboxes for `Featured in Reels Carousel`, `Featured in Flip Cards Stack`, `Featured in Lemonade Budget`.
2. **Section 2: Site-Wide Hero & Announcement Manager:**
   - Real-time form to update announcement text, phone number, and hero subtitle in `site_config`.
3. **Section 3: Content Table with Instant Feature Toggles:**
   - Active trips table displaying title, duration, price, category, section status badges, and instant edit/delete controls.

