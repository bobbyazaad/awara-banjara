# SOP: Dynamic Section Hydration & Site Config Specification

## 1. Overview
All frontend sections on `index.html`, `tour-packages.html`, and `trip-detail.html` dynamically adapt based on administrative settings fetched from Supabase.

## 2. Dynamic Rules
1. **Reels Carousel (`#reels-carousel`):**
   - Renders trips where `is_featured_reels !== false`.
   - Sorted by `featured_order` ascending, then `created_at` descending.
2. **Featured Card Stack (`#featuredCardStack`):**
   - Renders top 4 trips where `is_featured_stack !== false`.
   - Managed via `CardStackManager` in `assets/js/card-stack.js`.
3. **Lemonade Budget Section (`#lemonade-budget-carousel`):**
   - Renders trips where price is <= ₹14,999 OR `is_featured_lemonade === true`.
4. **Site Config Loader (`assets/js/site-config-loader.js`):**
   - Queries `public.site_config` table on load.
   - Automatically populates `.header-contact span`, `.announcement-bar`, and hero subtitles across all HTML pages.
