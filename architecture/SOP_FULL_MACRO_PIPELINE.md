# SOP: Master 33-Macro Trip Pipeline & Supabase Schema Specifications

## 1. Executive Summary
This Standard Operating Procedure specifies the 33-macro database schema in Supabase table `public.trips`, the administrative CRUD controls in `admin.html`, and the DOM hydration mapping for `trip-detail.html`.

## 2. Master 33-Macro Field Specifications

| Column Name | DB Type | Category / Purpose | Admin Field ID | DOM Target Selector (`trip-detail.html`) |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | Primary Key | `editTripId` | URL parameter `?id=ID` |
| `title` | `text` | Trip Title | `tripTitle` | `.trip-title, h1` |
| `category` | `text` | Tour Category | `tripCategory` | Category Filters & Badges |
| `duration` | `text` | Duration Badge | `tripDuration` | `.meta-duration` |
| `price` | `text` | Starting Price | `tripPrice` | `.header-price, .price` |
| `route` | `text` | Route Subtitle | `tripRoute` | `.trip-subtitle` |
| `tags` | `text` | Feature Badges | `tripTags` | `.trip-tags` |
| `image_url` | `text` | Card Cover Photo | `tripImage` | Card & Stack Thumbnails |
| `link` | `text` | Detail Page URL | `tripLink` | Default `trip-detail.html` |
| `bento_img_1` | `text` | Hero Large Left | `bentoImg1` | `#bentoImg1` |
| `bento_img_2` | `text` | Top Middle | `bentoImg2` | `#bentoImg2` |
| `bento_img_3` | `text` | Bottom Middle | `bentoImg3` | `#bentoImg3` |
| `bento_img_4` | `text` | Top Right | `bentoImg4` | `#bentoImg4` |
| `bento_img_5` | `text` | Bottom Right | `bentoImg5` | `#bentoImg5` |
| `about_text` | `text` | Overview Paragraph | `aboutText` | `#aboutTextParagraph` |
| `itinerary` | `jsonb` | Day-by-Day Schedule | `itineraryText` | `#itineraryAccordionContainer` |
| `inclusions` | `jsonb` | Inclusions List | `inclusionsText` | `#inclusionsList` |
| `exclusions` | `jsonb` | Exclusions List | `exclusionsText` | `#exclusionsList` |
| `package_options` | `jsonb` | Room/Tier Pricing | `packageOptionsText` | `#packageOptionsContainer` |
| `sub_package_options` | `text` | Add-On Bike/Vehicle | `subPackageOptionsText`| `#subPackagesContainer` |
| `departure_dates` | `jsonb` | Departure Batches | `departureDatesText` | `#departureDatesTableBody` |
| `faqs` | `jsonb` | FAQs Accordion | `faqsText` | `#faqsAccordionContainer` |
| `reviews` | `jsonb` | Reviews & Ratings | `reviewsText` | `#reviewsGrid` |
| `reserve_banner_title`| `text` | Reserve Banner Header| `reserveBannerTitle` | `#reserveBannerTitle` |
| `reserve_banner_sub`  | `text` | Reserve Banner Sub  | `reserveBannerSub`   | `#reserveBannerSub` |
| `custom_quote_title`  | `text` | Private Trip Header | `customQuoteTitle`   | `#customQuoteTitle` |
| `custom_quote_sub`    | `text` | Private Trip Sub    | `customQuoteSub`     | `#customQuoteSub` |
| `whatsapp_number`     | `text` | WhatsApp Contact    | `whatsappNumber`     | `#shareWhatsAppBtn, .wa-btn` |
| `is_featured_reels`   | `boolean`| Reels Feature Flag | `featReels` | Home Reels Carousel |
| `is_featured_stack`   | `boolean`| Flip Stack Flag   | `featStack` | Home 3D Flip Stack |
| `is_featured_lemonade` | `boolean`| Lemonade Budget Flag| `featLemonade` | Home Lemonade Section |
| `featured_order`      | `integer`| Display Sort Rank   | `featuredOrder` | Card Display Order |

## 3. Data Flow & Sync Rules
1. **UPSERT:** `admin.html` parses form fields into JSON/text and executes `supabaseClient.from('trips').upsert([fullPayload])`.
2. **FALLBACK:** Local backup cache key `trip_custom_<ID>` stores full payload to ensure zero offline loss.
3. **HYDRATION:** `trip-detail-loader.js` reads `?id=ID`, fetches matching Supabase row, and populates all 33 macro DOM targets.
