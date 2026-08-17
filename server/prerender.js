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

// Helper: strip everything except lowercase alphanumerics, for loose name matching
function cleanStr(s) {
  if (!s) return '';
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function loadReviews() {
  const reviewsPath = path.join(ROOT_DIR, 'data', 'reviews.json');
  try {
    if (fs.existsSync(reviewsPath)) {
      return JSON.parse(fs.readFileSync(reviewsPath, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

// Find the customer reviews relevant to this trip, matching (in order of preference)
// by trip_id, by trip_url containing this trip's id, or by a loosely-cleaned trip_name
// comparison. Falls back to category/keyword matches, then any review, so a page never
// ends up with an empty reviews section as long as reviews exist somewhere.
function matchReviewsForTrip(trip, allReviews) {
  const tripId = String(trip.id);
  const cTitle = cleanStr(trip.title);
  const catName = (trip.category || '').split(',')[0].replace(/_tours/gi, ' Tours').replace(/_/g, ' ').trim() || 'Himalayan Tours';
  const cCat = catName.toLowerCase();
  const hasText = (r) => !!((r.review_text || r.text || '').trim());

  let matched = allReviews.filter((r) => {
    if (!hasText(r)) return false;
    const rTripId = String(r.trip_id || '');
    const rTripUrl = r.trip_url || '';
    const cName = cleanStr(r.trip_name || '');
    if (rTripId && rTripId === tripId) return true;
    if (rTripUrl && (rTripUrl.includes(`-${tripId}.html`) || rTripUrl.includes(`id=${tripId}`))) return true;
    if (cTitle && (cName === cTitle || cTitle.includes(cName) || cName.includes(cTitle))) return true;
    return false;
  });

  if (matched.length === 0) {
    const keywords = ['spiti', 'zanskar', 'kashmir', 'himachal', 'ladakh'];
    matched = allReviews.filter((r) => {
      if (!hasText(r)) return false;
      const rName = (r.trip_name || '').toLowerCase();
      const rCat = (r.category || '').toLowerCase();
      if (cCat && (rCat.includes(cCat) || rName.includes(cCat))) return true;
      return keywords.some((kw) => cTitle.includes(kw) && rName.includes(kw));
    });
  }

  if (matched.length === 0) {
    matched = allReviews.filter(hasText);
  }

  return matched.slice(0, 4);
}

function renderReviewCards(matchedReviews, trip, fileName) {
  const starSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#facc15"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  const cards = matchedReviews.map((rev) => {
    const name = rev.customer_name || rev.name || 'Verified Traveler';
    const initial = name.trim() ? name.trim()[0].toUpperCase() : 'A';
    const avatarUrl = (rev.avatar_url || rev.avatar || '').trim();
    const avatarHtml = (avatarUrl && !avatarUrl.includes('placeholder'))
      ? `<img src="${fixAssetPath(avatarUrl)}" alt="${name}" class="rev-avatar-img">`
      : `<div class="avatar-circle-initial" style="background-color: #0284c7;">${initial}</div>`;

    const rating = parseInt(rev.rating, 10) || 5;
    const dateText = rev.date_text || '1 month ago';
    const tripTag = rev.trip_tag || 'private';
    const text = (rev.review_text || rev.text || '').trim();

    return `<article class="review-card-modern">
  <div class="rev-card-header">
    ${avatarHtml}
    <div class="rev-header-info">
      <div class="rev-author-name-row">
        <strong class="rev-author-name">${name}</strong>
        <span class="rev-trip-tag">${tripTag}</span>
      </div>
      <div class="rev-booked-row">
        <span class="booked-label">Booked:</span>
        <a href="${fileName}" class="booked-trip-link"><strong>${trip.title || ''}</strong> <span class="arrow">↗</span></a>
      </div>
    </div>
  </div>
  <div class="rev-rating-date-row">
    <div class="stars">${starSvg.repeat(rating)}</div>
    <span class="rev-date-text">${dateText}</span>
  </div>
  <p class="rev-quote-body">"${text}" <span class="read-more">Read More</span></p>
</article>`;
  });

  return `<div class="reviews-grid">\n${cards.join('\n')}\n</div>`;
}

function injectReviews(page, trip, allReviews, fileName) {
  const gridHtml = renderReviewCards(matchReviewsForTrip(trip, allReviews), trip, fileName);
  // The template has used both class names across revisions - try both, each is a
  // no-op if that particular wrapper isn't present in this copy of the template.
  page = page.replace(/<div class="reviews-mini-grid">[\s\S]*?<\/div>\s*<\/section>/, `${gridHtml}\n</section>`);
  page = page.replace(/<div class="reviews-grid">[\s\S]*?<\/div>\s*<\/section>/, `${gridHtml}\n</section>`);
  return page;
}

// Compute a trip's canonical static-page filename. Shared by prerenderTrip
// (which writes the file) and server.js (which needs the name to push that
// exact file to git-sync right after a save, without regenerating every
// trip's page just to find out one filename).
function getTripFileName(trip) {
  const catSlug = getCategorySlug(trip.category);
  const titleSlug = slugify(trip.title) || 'himalayan-expedition';
  return `${catSlug}-${titleSlug}-${trip.id}.html`;
}

// Pre-render a single trip static HTML page. `allReviews` is optional - pass it when
// rendering many trips in a batch (prerenderAllTrips) to avoid re-reading reviews.json
// once per trip; omitted, it's loaded fresh so standalone calls (e.g. right after a
// single trip save) still get reviews injected correctly.
function prerenderTrip(trip, allReviews) {
  if (!trip || !trip.id) return null;
  if (!fs.existsSync(MASTER_FILE)) return null;
  if (!fs.existsSync(TRIPS_DIR)) {
    fs.mkdirSync(TRIPS_DIR, { recursive: true });
  }

  const masterHtml = fs.readFileSync(MASTER_FILE, 'utf-8');

  // Adjust master template relative paths for /trips/ subfolder. The
  // template's own links are already extensionless (clean-URL scheme - the
  // file on disk still ends in .html, only the public-facing links don't),
  // so this just needs to prefix them with "../" for the one extra path
  // segment. One general pattern covers every nav/footer link rather than
  // an explicit list per page - a prior version only handled 3 of the ~15
  // links here, leaving the rest resolving as trips/about (404s).
  let page = masterHtml;
  page = page.replace(/href="assets\//g, 'href="../assets/');
  page = page.replace(/src="assets\//g, 'src="../assets/');
  page = page.replace(/href="\/"/g, 'href="../"');
  page = page.replace(/href="([a-z0-9-]+)(#[a-z0-9-]*)?"/gi, 'href="../$1$2"');

  const fileName = getTripFileName(trip);
  const filePath = path.join(TRIPS_DIR, fileName);
  const canonicalUrl = `https://awarabanjara.in/trips/${fileName.replace(/\.html$/, '')}`;
  const catName = (trip.category || '').split(',')[0].replace(/_tours/gi, ' Tours').replace(/_/g, ' ').trim() || 'Himalayan Tours';

  // 1. Page Title & Meta
  const titleText = `${trip.title || 'Himalayan Expedition'} — ${catName} | Awara Banjara`;
  page = page.replace(/<title>.*?<\/title>/s, `<title>${titleText}</title>`);
  page = page.replace(/<link rel="canonical" href=".*?">/s, `<link rel="canonical" href="${canonicalUrl}">`);
  page = page.replace(/<meta property="og:url" content=".*?">/s, `<meta property="og:url" content="${canonicalUrl}">`);
  page = page.replace(/<meta property="og:title" content=".*?">/s, `<meta property="og:title" content="${trip.title || ''} — Awara Banjara">`);
  // The template's own JSON-LD "url" is generic (points at trip-detail itself,
  // not this specific trip) - make it trip-specific while we're already
  // rewriting every other URL field on this page.
  page = page.replace(/"url":\s*"https:\/\/awarabanjara\.in\/trip-detail\.html"/, `"url": "${canonicalUrl}"`);

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

  // 10. Customer reviews relevant to this trip (extensionless self-link,
  // same clean-URL scheme as everywhere else on the page)
  page = injectReviews(page, trip, allReviews || loadReviews(), fileName.replace(/\.html$/, ''));

  fs.writeFileSync(filePath, page, 'utf-8');
  console.log(`🖼️ Pre-rendered static trip page: trips/${fileName}`);
  return `trips/${fileName}`;
}

// Pre-render all trips in an array. Loads reviews.json once for the whole batch rather
// than once per trip (prerenderTrip does that itself when called standalone).
function prerenderAllTrips(tripsArr) {
  if (!Array.isArray(tripsArr)) return;
  const allReviews = loadReviews();
  tripsArr.forEach(t => prerenderTrip(t, allReviews));
}

module.exports = {
  prerenderTrip,
  prerenderAllTrips,
  getTripFileName
};
