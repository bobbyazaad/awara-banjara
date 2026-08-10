#!/usr/bin/env python3
"""
AwaraBanjara — Automated Sitemap Sync Script
Fetches active trips from Supabase and updates sitemap.xml with full SEO URLs.
"""

import os
import re
import json
import urllib.request
import ssl

SUPABASE_URL = "https://ahtvuswpdewnszktqkpp.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodHZ1c3dwZGV3bnN6a3Rxa3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTM5ODEsImV4cCI6MjEwMDg4OTk4MX0.ssA8hMNsWzPGoSUKBi0hUioEfN0GcgI5bCcajz1cZsQ"

def slugify(text):
    if not text:
        return ''
    return re.sub(r'^-+|-+$', '', re.sub(r'[\s_-]+', '-', re.sub(r'[^\w\s-]', '', str(text).lower().strip())))

def get_cat_slug(cat):
    if not cat:
        return 'group-tours'
    first = cat.split(',')[0].strip()
    clean = first.replace('_tours', ' tours').replace('_', ' ')
    return slugify(clean) or 'group-tours'

def sync_sitemap():
    ssl._create_default_https_context = ssl._create_unverified_context
    endpoint = f"{SUPABASE_URL}/rest/v1/trips?select=*"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    req = urllib.request.Request(endpoint, headers=headers)
    with urllib.request.urlopen(req) as resp:
        trips = json.loads(resp.read().decode('utf-8'))

    trip_urls = []
    for t in trips:
        c_slug = get_cat_slug(t.get('category'))
        t_slug = slugify(t.get('title')) or 'himalayan-expedition'
        trip_id = t.get('id')
        loc = f"https://awarabanjara.in/trip-detail.html?category={c_slug}&amp;trip={t_slug}&amp;id={trip_id}"
        trip_urls.append(f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>2026-08-07</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>")

    sitemap_header = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://awarabanjara.in/</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://awarabanjara.in/tour-packages.html</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://awarabanjara.in/about.html</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://awarabanjara.in/contact.html</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://awarabanjara.in/postcards.html</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://awarabanjara.in/careers.html</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
"""

    sitemap_footer = """  <url>
    <loc>https://awarabanjara.in/booking-terms.html</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://awarabanjara.in/cancellation-policy.html</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://awarabanjara.in/privacy-policy.html</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
"""

    full_sitemap = sitemap_header + '\n'.join(trip_urls) + '\n' + sitemap_footer
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sitemap_path = os.path.join(base_dir, "sitemap.xml")

    with open(sitemap_path, 'w', encoding='utf-8') as f:
        f.write(full_sitemap)

    print(f"✅ sitemap.xml successfully synchronized with {len(trips)} trip(s)!")

if __name__ == '__main__':
    sync_sitemap()
