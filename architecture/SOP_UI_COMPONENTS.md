# SOP: UI Component Architecture & Design System

## 1. Visual Aesthetics & Design System
- **Color Palette:**
  - Obsidian Dark Accent: `#14140f`
  - Premium Muted Gray: `#666666`
  - Crisp White: `#ffffff`
  - Soft Light Background: `#f6f6f1`
- **Typography:**
  - Headings & Badges: High-contrast sans-serif with strong font weight (`700`).
- **Interactive Micro-Animations:**
  - Card Stack: 3D hardware-accelerated position transforms (`cubic-bezier(0.25, 1, 0.5, 1)`).
  - Hover Lift: Subtle 4px vertical translation on trip card hover.

## 2. Key Component Guidelines
1. **Featured Card Stack (`#featuredCardStack`):**
   - Controlled by `CardStackManager` in `assets/js/card-stack.js`.
   - Uses Event Delegation to guarantee click/tap flip interactions never break.
2. **Master Dynamic Itinerary (`trip-detail.html`):**
   - Clean placeholders until Supabase data loads (`loadTripDetails()`).
   - Ensures no flashing of static template content.
3. **Admin Panel (`admin.html`):**
   - Full 24-macro form with real-time image URL preview, preset selector, and editing state.
