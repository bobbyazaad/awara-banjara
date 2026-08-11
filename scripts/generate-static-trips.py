#!/usr/bin/env python3
"""
AwaraBanjara — Static Trip Pre-rendering Generator for Social & Crawler SEO
Reads all trips from the local Node/JSON database (data/trips.json) and
creates static pre-rendered HTML copies inside the `trips/` directory.
"""

import os
import re
import json

def clean_str(s):
    if not s:
        return ''
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

def slugify(text):
    if not text:
        return ''
    return re.sub(r'^-+|-+$', '', re.sub(r'[\s_-]+', '-', re.sub(r'[^\w\s-]', '', str(text).lower().strip())))

def get_category_slug(cat):
    if not cat:
        return 'group-tours'
    first_cat = cat.split(',')[0].strip()
    clean = first_cat.replace('_tours', ' tours').replace('_', ' ')
    return slugify(clean) or 'group-tours'

def fetch_trips():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_path = os.path.join(base_dir, "data", "trips.json")
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_static_files():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(base_dir, "trip-detail.html")
    output_dir = os.path.join(base_dir, "trips")

    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(template_path):
        print(f"❌ Template file not found: {template_path}")
        return

    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()

    trips = fetch_trips()
    print(f"📦 Loaded {len(trips)} trip(s) from local database. Generating static pre-rendered pages...")

    reviews_json_path = os.path.join(base_dir, "data", "reviews.json")
    all_reviews = []
    if os.path.exists(reviews_json_path):
        try:
            with open(reviews_json_path, 'r', encoding='utf-8') as rf:
                all_reviews = json.load(rf)
        except Exception:
            all_reviews = []

    generated_count = 0
    for trip in trips:
        trip_id = trip.get('id')
        title = trip.get('title', 'Himalayan Expedition')
        cat_slug = get_category_slug(trip.get('category'))
        title_slug = slugify(title) or 'expedition'

        cat_name = (trip.get('category') or '').split(',')[0].replace('_tours', ' Tours').replace('_', ' ').strip() or 'Himalayan Tours'
        seo_url = f"https://awarabanjara.in/trip-detail.html?category={cat_slug}&trip={title_slug}&id={trip_id}"
        
        about_text = trip.get('about_text', f"Join Awara Banjara for {title}. Experience high passes, group bonding, and breathtaking mountain views.")
        meta_desc = about_text[:160].replace('"', '&quot;')
        img_url = trip.get('image_url') or trip.get('bento_img_1') or "https://awarabanjara.in/assets/images/destinations/domestic/spiti.jpg"

        # Replace Title, Duration, Price, Route, About Text, Bento Grid, Itinerary in static HTML Body
        duration = trip.get('duration') or '5 Days / 4 Nights'
        price = trip.get('price') or 'On Request'
        p_str = str(price).strip()
        price_num = re.sub(r'[^\d]', '', p_str)
        if p_str == '0' or p_str.lower() == 'on request' or not price_num:
            price_display = 'On Request'
        else:
            price_display = p_str if p_str.startswith('₹') else f"₹{int(price_num):,}"

        route = trip.get('route') or 'Himalayan Circuit'
        
        # Replace HTML Macros
        page_html = template_content
        page_html = re.sub(r'<title>.*?</title>', f'<title>{title} — {cat_name} | Awara Banjara</title>', page_html, flags=re.IGNORECASE)
        page_html = re.sub(r'<link\s+rel="canonical"\s+href=".*?"\s*>', f'<link rel="canonical" href="{seo_url}">', page_html, flags=re.IGNORECASE)
        page_html = re.sub(r'<meta\s+name="description"\s+content=".*?"\s*>', f'<meta name="description" content="{meta_desc}">', page_html, flags=re.IGNORECASE)

        # Update Open Graph tags
        page_html = re.sub(r'<meta\s+property="og:title"\s+content=".*?"\s*>', f'<meta property="og:title" content="{title} — Awara Banjara">', page_html, flags=re.IGNORECASE)
        page_html = re.sub(r'<meta\s+property="og:description"\s+content=".*?"\s*>', f'<meta property="og:description" content="{meta_desc}">', page_html, flags=re.IGNORECASE)
        page_html = re.sub(r'<meta\s+property="og:url"\s+content=".*?"\s*>', f'<meta property="og:url" content="{seo_url}">', page_html, flags=re.IGNORECASE)
        page_html = re.sub(r'<meta\s+property="og:image"\s+content=".*?"\s*>', f'<meta property="og:image" content="{img_url}">', page_html, flags=re.IGNORECASE)

        # Replace HTML Macros cleanly matching class & id attributes
        page_html = re.sub(r'<h1[^>]*class="trip-title"[^>]*>.*?</h1>', f'<h1 class="trip-title" id="tripTitle">{title}</h1>', page_html, flags=re.DOTALL)
        page_html = re.sub(r'<span[^>]*class="meta-duration"[^>]*>.*?</span>', f'<span class="meta-duration" id="tripDuration">{duration}</span>', page_html, flags=re.DOTALL)
        page_html = re.sub(r'<p[^>]*class="trip-route"[^>]*>.*?</p>', f'<p class="trip-route" id="tripRoute">{route}</p>', page_html, flags=re.DOTALL)
        page_html = re.sub(r'<span[^>]*class="price-val"[^>]*>.*?</span>', f'<span class="price-val" id="tripPrice">{price_display}</span>', page_html, flags=re.DOTALL)
        
        if about_text:
            page_html = re.sub(r'<p[^>]*class="about-trip-text"[^>]*>.*?</p>', f'<p class="about-trip-text" id="aboutText">{about_text}</p>', page_html, flags=re.DOTALL)

        # Pre-render Day-by-Day Itinerary Accordion using exact acc-item CSS classes
        itin_list = trip.get('itinerary') or []
        if isinstance(itin_list, list) and len(itin_list) > 0:
            itin_blocks = []
            for idx, d in enumerate(itin_list):
                if isinstance(d, str):
                    day_num_str = f"DAY {idx + 1}"
                    header_display = f"{day_num_str}: {d}"
                    d_desc = f'<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">{d}</p>'
                elif isinstance(d, dict):
                    day_val = d.get('day')
                    if isinstance(day_val, int):
                        day_num_str = f"DAY {day_val}"
                    elif isinstance(day_val, str) and day_val.strip():
                        day_num_str = day_val.upper() if day_val.upper().startswith('DAY') else f"DAY {day_val}"
                    else:
                        day_num_str = f"DAY {idx + 1}"

                    raw_title = d.get('title') or d.get('day_title') or d.get('name') or d.get('header') or ''
                    clean_title = re.sub(r'^DAY\s*\d+:\s*', '', raw_title, flags=re.IGNORECASE).strip()
                    header_display = f"{day_num_str}: {clean_title}" if clean_title else day_num_str

                    raw_desc = d.get('details') or d.get('description') or d.get('text') or ''
                    if not raw_desc and isinstance(d.get('points'), list):
                        d_desc = '<ul style="margin:0; padding-left:20px;">' + ''.join([f'<li style="font-size:14px; line-height:1.6; color:#444; margin-bottom:4px;">{pt}</li>' for pt in d.get('points')]) + '</ul>'
                    elif raw_desc:
                        d_desc = f'<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">{raw_desc}</p>'
                    else:
                        d_desc = f'<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">{header_display}</p>'

                is_active = ' active' if idx == 0 else ''
                icon_char = '−' if idx == 0 else '+'
                
                itin_blocks.append(f'''<div class="acc-item{is_active}">
  <button class="acc-trigger">
    <span class="acc-day-title">{header_display}</span>
    <span class="acc-icon">{icon_char}</span>
  </button>
  <div class="acc-content" style="padding: 16px 20px;">
    {d_desc}
  </div>
</div>''')
            
            itin_html = '\n'.join(itin_blocks)
            page_html = re.sub(
                r'<div class="itinerary-accordion">\s*<p[^>]*>.*?</p>\s*</div>',
                f'<div class="itinerary-accordion">\n{itin_html}\n</div>',
                page_html,
                flags=re.DOTALL
            )

        # Helper to format image paths for /trips/ sub-directory
        def fix_p(p, default_img):
            if not p: return f"../assets/images/destinations/domestic/{default_img}"
            if p.startswith('http://') or p.startswith('https://') or p.startswith('data:'):
                return p
            clean = p.replace('../', '').lstrip('/')
            return f"../{clean}"

        file_name = f"{cat_slug}-{title_slug}-{trip_id}.html"

        # Pre-render Relevant Reviews Section matching THIS trip
        matched_reviews = []
        c_title = clean_str(title)
        c_cat = (cat_name or '').lower()
        
        for r in all_reviews:
            r_text = (r.get('review_text') or r.get('text') or '').strip()
            if not r_text: continue
            r_trip_id = str(r.get('trip_id') or '')
            r_trip_url = r.get('trip_url') or ''
            r_trip_name = r.get('trip_name') or ''

            if r_trip_id and r_trip_id == trip_id:
                matched_reviews.append(r)
            elif r_trip_url and (f"-{trip_id}.html" in r_trip_url or f"id={trip_id}" in r_trip_url):
                matched_reviews.append(r)
            elif c_title and (clean_str(r_trip_name) == c_title or c_title in clean_str(r_trip_name) or clean_str(r_trip_name) in c_title):
                matched_reviews.append(r)

        # Fallback if no direct review match
        if not matched_reviews:
            for r in all_reviews:
                r_text = (r.get('review_text') or r.get('text') or '').strip()
                if not r_text: continue
                r_name = (r.get('trip_name') or '').lower()
                r_cat = (r.get('category') or '').lower()
                if c_cat and (c_cat in r_cat or c_cat in r_name):
                    matched_reviews.append(r)
                elif 'spiti' in c_title and 'spiti' in r_name:
                    matched_reviews.append(r)
                elif 'zanskar' in c_title and 'zanskar' in r_name:
                    matched_reviews.append(r)
                elif 'kashmir' in c_title and 'kashmir' in r_name:
                    matched_reviews.append(r)
                elif 'himachal' in c_title and 'himachal' in r_name:
                    matched_reviews.append(r)
                elif 'ladakh' in c_title and 'ladakh' in r_name:
                    matched_reviews.append(r)

        if not matched_reviews:
            matched_reviews = [r for r in all_reviews if (r.get('review_text') or r.get('text') or '').strip()][:4]

        # Always cap to top 4 reviews
        matched_reviews = matched_reviews[:4]

        rev_cards = []
        for rev in matched_reviews:
            name = rev.get('customer_name') or rev.get('name') or 'Verified Traveler'
            initial = name.strip()[0].upper() if name.strip() else 'A'
            avatar_url = rev.get('avatar_url') or rev.get('avatar') or ''
            if avatar_url and avatar_url.strip() and 'placeholder' not in avatar_url:
                safe_avatar = fix_p(avatar_url.strip(), '')
                avatar_html = f'<img src="{safe_avatar}" alt="{name}" class="rev-avatar-img">'
            else:
                avatar_html = f'<div class="avatar-circle-initial" style="background-color: #0284c7;">{initial}</div>'

            rating = int(rev.get('rating') or 5)
            star_svg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#facc15"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
            date_text = rev.get('date_text') or '1 month ago'
            trip_tag = rev.get('trip_tag') or 'private'
            r_text = (rev.get('review_text') or rev.get('text') or '').strip()

            rev_cards.append(f'''<article class="review-card-modern">
  <div class="rev-card-header">
    {avatar_html}
    <div class="rev-header-info">
      <div class="rev-author-name-row">
        <strong class="rev-author-name">{name}</strong>
        <span class="rev-trip-tag">{trip_tag}</span>
      </div>
      <div class="rev-booked-row">
        <span class="booked-label">Booked:</span>
        <a href="{file_name}" class="booked-trip-link"><strong>{title}</strong> <span class="arrow">↗</span></a>
      </div>
    </div>
  </div>
  <div class="rev-rating-date-row">
    <div class="stars">{star_svg * rating}</div>
    <span class="rev-date-text">{date_text}</span>
  </div>
  <p class="rev-quote-body">"{r_text}" <span class="read-more">Read More</span></p>
</article>''')

        reviews_grid_html = f'<div class="reviews-grid">\n' + '\n'.join(rev_cards) + '\n</div>'
        page_html = re.sub(r'<div class="reviews-mini-grid">.*?</div>\s*</section>', f'{reviews_grid_html}\n</section>', page_html, flags=re.DOTALL)
        page_html = re.sub(r'<div class="reviews-grid">.*?</div>\s*</section>', f'{reviews_grid_html}\n</section>', page_html, flags=re.DOTALL)

        b1 = fix_p(trip.get('bento_img_1') or trip.get('image_url'), 'spiti.jpg')
        b2 = fix_p(trip.get('bento_img_2'), 'ladakh.jpg')
        b3 = fix_p(trip.get('bento_img_3'), 'meghalaya.jpg')
        b4 = fix_p(trip.get('bento_img_4'), 'kashmir.jpg')
        b5 = fix_p(trip.get('bento_img_5'), 'kerala.jpg')

        page_html = re.sub(r'<img\s+src="assets/images/placeholder-hero.svg"[^>]*>', f'<img src="{b1}" alt="{title} Hero Cover — Awara Banjara">', page_html)
        page_html = re.sub(r'<img\s+src="assets/images/placeholder-card-1.svg"[^>]*>', f'<img src="{b2}" alt="{title} Gallery Photo 2 — Awara Banjara">', page_html)
        page_html = re.sub(r'<img\s+src="assets/images/placeholder-card-2.svg"[^>]*>', f'<img src="{b3}" alt="{title} Gallery Photo 3 — Awara Banjara">', page_html)
        page_html = re.sub(r'<img\s+src="assets/images/placeholder-card-3.svg"[^>]*>', f'<img src="{b4}" alt="{title} Gallery Photo 4 — Awara Banjara">', page_html)
        page_html = re.sub(r'<img\s+src="assets/images/placeholder-card-4.svg"[^>]*>', f'<img src="{b5}" alt="{title} Gallery Photo 5 — Awara Banjara">', page_html)
        page_html = re.sub(r'<div[^>]*class="booking-popup-hero"[^>]*>', f'<div class="booking-popup-hero" id="bookingPopupHero" style="background-image: url(\'{b1}\'); background-size: cover; background-position: center;">', page_html, flags=re.DOTALL)
        page_html = re.sub(r'<img[^>]*class="share-trip-thumb"[^>]*>', f'<img src="{b1}" alt="{title}" class="share-trip-thumb">', page_html)

        # Fix relative asset & navigation link paths for sub-directory /trips/
        page_html = page_html.replace('href="assets/', 'href="../assets/')
        page_html = page_html.replace('src="assets/', 'src="../assets/')
        page_html = page_html.replace("this.src='assets/", "this.src='../assets/")
        page_html = page_html.replace('href="index.html"', 'href="../index.html"')
        page_html = page_html.replace('href="tour-packages.html#', 'href="../tour-packages.html#')
        page_html = page_html.replace('href="tour-packages.html"', 'href="../tour-packages.html"')
        page_html = page_html.replace('href="about.html"', 'href="../about.html"')
        page_html = page_html.replace('href="contact.html"', 'href="../contact.html"')
        page_html = page_html.replace('href="postcards.html"', 'href="../postcards.html"')
        page_html = page_html.replace('href="careers.html"', 'href="../careers.html"')
        page_html = page_html.replace('href="booking-terms.html"', 'href="../booking-terms.html"')
        page_html = page_html.replace('href="cancellation-policy.html"', 'href="../cancellation-policy.html"')
        page_html = page_html.replace('href="privacy-policy.html"', 'href="../privacy-policy.html"')
        page_html = page_html.replace('href="payment-details.html"', 'href="../payment-details.html"')
        page_html = page_html.replace('href="reviews.html"', 'href="../reviews.html"')

        file_path = os.path.join(output_dir, file_name)

        with open(file_path, 'w', encoding='utf-8') as out_f:
            out_f.write(page_html)

        generated_count += 1
        print(f"  ✅ Generated: trips/{file_name}")

    print(f"✨ Successfully generated {generated_count} pre-rendered trip page(s) in `trips/` directory!")

if __name__ == '__main__':
    generate_static_files()
