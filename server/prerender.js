// =========================================================
// Awara Banjara — Automatic Static Trip HTML Pre-renderer
// Real-time Static Page Generator for CMS Updates
// =========================================================

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const TRIPS_DIR = path.join(ROOT_DIR, 'trips');
const MASTER_FILE = path.join(ROOT_DIR, 'trip-detail.html');

// Helper: Fix relative image paths for subfolder /trips/
function fixAssetPath(imgUrl) {
  if (!imgUrl) return '../assets/images/placeholder-hero.svg';
  if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:')) {
    return imgUrl;
  }
  let clean = imgUrl.replace(/^\.\.\//, '').trim();
  if (clean.startsWith('/')) clean = clean.substring(1);
  return `../${clean}`;
}

// Helper: Format INR currency
function formatPrice(val) {
  if (val === null || val === undefined) return 'On Request';
  const str = String(val).trim();
  if (!str || str === '0' || str === '0.00' || str.toLowerCase() === 'on request' || str.toLowerCase().includes('request')) {
    return 'On Request';
  }
  const numMatch = str.match(/\d[\d,]*/);
  if (!numMatch) return str.startsWith('₹') ? str : `₹${str}`;
  const num = parseInt(numMatch[0].replace(/,/g, ''), 10);
  if (isNaN(num) || num <= 0) return 'On Request';
  return `₹${num.toLocaleString('en-IN')}`;
}

// Helper: Slugify text
function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper: Get Category Slug
function getCategorySlug(category) {
  if (!category || typeof category !== 'string') return 'group-tours';
  const firstCat = category.split(',')[0].trim();
  let cleanCat = firstCat.replace(/_tours$/i, ' tours').replace(/_/g, ' ');
  return slugify(cleanCat) || 'group-tours';
}

// Pre-render a single trip static HTML page
function prerenderTrip(trip) {
  if (!trip || !trip.id) return null;
  if (!fs.existsSync(MASTER_FILE)) return null;
  if (!fs.existsSync(TRIPS_DIR)) {
    fs.mkdirSync(TRIPS_DIR, { recursive: true });
  }

  const masterHtml = fs.readFileSync(MASTER_FILE, 'utf-8');

  // Adjust master template relative paths for /trips/ subfolder
  let page = masterHtml;
  page = page.replace(/href="assets\//g, 'href="../assets/');
  page = page.replace(/src="assets\//g, 'src="../assets/');
  page = page.replace(/href="index\.html"/g, 'href="../index.html"');
  page = page.replace(/href="tour-packages\.html"/g, 'href="../tour-packages.html"');
  page = page.replace(/href="tour-packages\.html#/g, 'href="../tour-packages.html#');

  const catSlug = getCategorySlug(trip.category);
  const titleSlug = slugify(trip.title) || 'himalayan-expedition';
  const fileName = `${catSlug}-${titleSlug}-${trip.id}.html`;
  const filePath = path.join(TRIPS_DIR, fileName);
  const canonicalUrl = `https://awarabanjara.in/trips/${fileName}`;
  const catName = (trip.category || '').split(',')[0].replace(/_tours/gi, ' Tours').replace(/_/g, ' ').trim() || 'Himalayan Tours';

  // 1. Page Title & Meta
  const titleText = `${trip.title || 'Himalayan Expedition'} — ${catName} | Awara Banjara`;
  page = page.replace(/<title>.*?<\/title>/s, `<title>${titleText}</title>`);
  page = page.replace(/<link rel="canonical" href=".*?">/s, `<link rel="canonical" href="${canonicalUrl}">`);
  page = page.replace(/<meta property="og:url" content=".*?">/s, `<meta property="og:url" content="${canonicalUrl}">`);
  page = page.replace(/<meta property="og:title" content=".*?">/s, `<meta property="og:title" content="${trip.title || ''} — Awara Banjara">`);

  const aboutExcerpt = (trip.about_text || '').substring(0, 160);
  if (aboutExcerpt) {
    page = page.replace(/<meta name="description" content=".*?">/s, `<meta name="description" content="${aboutExcerpt}">`);
    page = page.replace(/<meta property="og:description" content=".*?">/s, `<meta property="og:description" content="${aboutExcerpt}">`);
  }

  const heroSrc = fixAssetPath(trip.bento_img_1 || trip.image_url);
  page = page.replace(/<meta property="og:image" content=".*?">/s, `<meta property="og:image" content="${heroSrc}">`);

  // 2. Bento Photo Gallery
  const side2 = fixAssetPath(trip.bento_img_2 || 'assets/images/destinations/domestic/ladakh.jpg');
  const side3 = fixAssetPath(trip.bento_img_3 || 'assets/images/destinations/domestic/meghalaya.jpg');
  const side4 = fixAssetPath(trip.bento_img_4 || 'assets/images/destinations/domestic/kashmir.jpg');
  const side5 = fixAssetPath(trip.bento_img_5 || 'assets/images/destinations/domestic/kerala.jpg');

  const bentoGalleryHtml = `<section class="trip-bento-gallery">
      <div class="bento-col main-hero-bento">
        <img src="${heroSrc}" alt="${trip.title || 'Himalayan Trip'} Hero Cover — Awara Banjara" onerror="this.onerror=null;this.src='../assets/images/placeholder-hero.svg'">
      </div>
      <div class="bento-col side-bento-col">
        <img src="${side2}" alt="${trip.title || ''} Gallery Image 2" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='../assets/images/placeholder-card-1.svg'">
        <img src="${side3}" alt="${trip.title || ''} Gallery Image 3" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='../assets/images/placeholder-card-2.svg'">
      </div>
      <div class="bento-col side-bento-col">
        <img src="${side4}" alt="${trip.title || ''} Gallery Image 4" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='../assets/images/placeholder-card-3.svg'">
        <img src="${side5}" alt="${trip.title || ''} Gallery Image 5" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='../assets/images/placeholder-card-4.svg'">
      </div>
    </section>`;

  page = page.replace(/<section class="trip-bento-gallery">.*?<\/section>/s, bentoGalleryHtml);

  // 3. Title Card (Duration, Title, Route, Tags)
  const durStr = `⏱ ${trip.duration || '5 Days / 4 Nights'}`;
  page = page.replace(/<span class="meta-duration">.*?<\/span>/s, `<span class="meta-duration">${durStr}</span>`);
  page = page.replace(/<h1 class="trip-title">.*?<\/h1>/s, `<h1 class="trip-title">${trip.title || ''}</h1>`);
  page = page.replace(/<p class="trip-route">.*?<\/p>/s, `<p class="trip-route">${trip.route || ''}</p>`);

  const rawTags = trip.tags;
  if (rawTags) {
    const tagsList = Array.isArray(rawTags) ? rawTags : String(rawTags).split(',');
    const tagsSpans = tagsList.map(t => `<span class="badge badge-tag">${t.trim()}</span>`).join('');
    const tagsRowHtml = `<div class="trip-tags-row">
            ${tagsSpans}
            <button type="button" class="share-btn" id="openShareModal">
              <svg class="share-btn-icon" viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Share
            </button>
          </div>`;
    page = page.replace(/<div class="trip-tags-row">.*?<\/div>/s, tagsRowHtml);
  }

  // 4. About Text
  if (trip.about_text) {
    page = page.replace(/<p class="about-trip-text">.*?<\/p>/s, `<p class="about-trip-text">${trip.about_text}</p>`);
  }

  // 5. Day-by-Day Accordion Itinerary
  let itinList = trip.itinerary;
  if (typeof itinList === 'string') {
    try { itinList = JSON.parse(itinList); } catch (e) { itinList = []; }
  }

  if (Array.isArray(itinList) && itinList.length > 0) {
    const itemsHtml = itinList.map((dayItem, idx) => {
      let dayNumStr = `DAY ${idx + 1}`;
      if (typeof dayItem === 'object' && dayItem.day) {
        dayNumStr = typeof dayItem.day === 'number' ? `DAY ${dayItem.day}` : String(dayItem.day).toUpperCase();
      }

      let rawTitle = '';
      if (typeof dayItem === 'string') rawTitle = dayItem;
      else if (typeof dayItem === 'object') {
        rawTitle = dayItem.title || dayItem.day_title || dayItem.name || dayItem.header || '';
      }

      const cleanTitle = rawTitle.replace(/^DAY\s*\d+:\s*/gi, '').trim();
      const headerDisplay = cleanTitle ? `${dayNumStr}: ${cleanTitle}` : dayNumStr;

      let contentHtml = '';
      if (typeof dayItem === 'object') {
        if (dayItem.details) {
          contentHtml = `<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">${dayItem.details}</p>`;
        } else if (Array.isArray(dayItem.points)) {
          const pts = dayItem.points.map(pt => `<li style="font-size: 14px; line-height: 1.6; color: #444; margin-bottom: 4px;">${pt}</li>`).join('');
          contentHtml = `<ul style="margin: 0; padding-left: 20px;">${pts}</ul>`;
        } else if (dayItem.text || dayItem.description) {
          contentHtml = `<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">${dayItem.text || dayItem.description}</p>`;
        }
      }

      if (!contentHtml && cleanTitle) {
        contentHtml = `<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">${cleanTitle}</p>`;
      }

      return `<div class="acc-item ${idx === 0 ? 'active' : ''}">
  <button class="acc-trigger" type="button">
    <span class="acc-day-title" style="font-weight: 700;">${headerDisplay}</span>
    <span class="acc-icon">${idx === 0 ? '−' : '+'}</span>
  </button>
  <div class="acc-content" style="padding: 16px 20px;">
    ${contentHtml}
  </div>
</div>`;
    });

    const accBlock = itemsHtml.join('\n');
    page = page.replace(/<div class="itinerary-accordion">.*?<\/div>/s, `<div class="itinerary-accordion">\n${accBlock}\n</div>`);
  }

  // 6. Inclusions
  let incList = trip.inclusions;
  if (typeof incList === 'string') {
    try { incList = JSON.parse(incList); } catch (e) { incList = incList.split('\n'); }
  }
  if (Array.isArray(incList) && incList.length > 0) {
    const incItems = incList.map(item => `<div class="feat-item"><span class="icon-check">✔</span> ${String(item).trim()}</div>`).join('');
    page = page.replace(/<div class="feature-grid inclusions-grid">.*?<\/div>/s, `<div class="feature-grid inclusions-grid">${incItems}</div>`);
  }

  // 7. Exclusions
  let excList = trip.exclusions;
  if (typeof excList === 'string') {
    try { excList = JSON.parse(excList); } catch (e) { excList = excList.split('\n'); }
  }
  if (Array.isArray(excList) && excList.length > 0) {
    const excItems = excList.map(item => `<div class="feat-item"><span class="icon-cross">✘</span> ${String(item).trim()}</div>`).join('');
    page = page.replace(/<div class="feature-grid exclusions-grid">.*?<\/div>/s, `<div class="feature-grid exclusions-grid">${excItems}</div>`);
  }

  // 8. Package Pills & Sidebar Price
  let pkgList = trip.package_options;
  if (typeof pkgList === 'string') {
    try { pkgList = JSON.parse(pkgList); } catch (e) { pkgList = []; }
  }
  if (!Array.isArray(pkgList) || pkgList.length === 0) {
    pkgList = [{ title: 'Standard Package', price: formatPrice(trip.price) }];
  }

  const pillsHtml = pkgList.map((pkg, idx) => {
    const pFmt = formatPrice(pkg.price || trip.price);
    return `<button class="pill-btn ${idx === 0 ? 'active' : ''}" type="button" data-pkg-title="${pkg.title || 'Standard Package'}" data-pkg-price="${pFmt}">${pkg.title || 'Standard Package'}<br><strong>${pFmt}</strong></button>`;
  });
  page = page.replace(/<div class="package-options-pills">.*?<\/div>/s, `<div class="package-options-pills">${pillsHtml.join('')}</div>`);

  const firstPkgPrice = formatPrice(pkgList[0] ? pkgList[0].price : trip.price);
  if (firstPkgPrice === 'On Request') {
    page = page.replace(/<div class="price-val">.*?<\/div>/s, '<div class="price-val">On Request</div>');
  } else {
    page = page.replace(/<div class="price-val">.*?<\/div>/s, `<div class="price-val">${firstPkgPrice} <small>per person</small></div>`);
  }

  // 9. Booking Popup & Share Modal
  if (heroSrc) {
    page = page.replace(/<div[^>]*class="booking-popup-hero"[^>]*>/g, `<div class="booking-popup-hero" id="bookingPopupHero" style="background-image: url('${heroSrc}'); background-size: cover; background-position: center;">`);
    page = page.replace(/<img src="[^"]*" alt=".*?" class="share-trip-thumb">/g, `<img src="${heroSrc}" alt="${trip.title || ''}" class="share-trip-thumb">`);
  }

  page = page.replace(
    /<div class="share-trip-info">\s*<h4>.*?<\/h4>\s*<p>.*?<\/p>\s*<\/div>/s,
    `<div class="share-trip-info">\n          <h4>${trip.title || ''}</h4>\n          <p>${trip.route || ''}</p>\n        </div>`
  );

  fs.writeFileSync(filePath, page, 'utf-8');
  console.log(`🖼️ Pre-rendered static trip page: trips/${fileName}`);
  return `trips/${fileName}`;
}

// Pre-render all trips in an array
function prerenderAllTrips(tripsArr) {
  if (!Array.isArray(tripsArr)) return;
  tripsArr.forEach(t => prerenderTrip(t));
}

module.exports = {
  prerenderTrip,
  prerenderAllTrips
};
