// =========================================================
// Dynamic Trip Detail Page Loader — Supabase Integration
// Renders all macros dynamically from Supabase database columns.
// =========================================================

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

function toOrdinalDay(day) {
  const d = parseInt(day, 10);
  if (isNaN(d)) return day;
  if (d >= 11 && d <= 13) return d + "th";
  const last = d % 10;
  if (last === 1) return d + "st";
  if (last === 2) return d + "nd";
  if (last === 3) return d + "rd";
  return d + "th";
}

function formatSingleDateDisplay(dateStr) {
  if (!dateStr) return '1st August';
  let single = dateStr.split('—')[0].split('-')[0].trim();
  const parts = single.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const day = parts[0];
    const month = parts[1];
    if (!isNaN(parseInt(day, 10))) {
      return `${toOrdinalDay(day)} ${month}`;
    }
  }
  return single;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initAccordionListeners();
    initFAQListeners();
    loadTripDetails();
  });
} else {
  initAccordionListeners();
  initFAQListeners();
  loadTripDetails();
}

async function loadTripDetails() {
  const urlParams = new URLSearchParams(window.location.search);

  let pathId = null;
  const pathMatch = window.location.pathname.match(/-(\d+)$/);
  if (pathMatch) {
    pathId = pathMatch[1];
  }

  const tripId = urlParams.get('id') || pathId;
  const tripIdOrSlug = tripId || urlParams.get('trip') || urlParams.get('slug') || (window.location.pathname.includes('/trips/') ? '' : window.location.pathname.split('/').pop().replace('.html', ''));

  const isStaticPage = window.location.pathname.includes('/trips/');

  let tripData = null;

  // 1. Fetch trip using AwaraDB unified caching engine
  if (tripIdOrSlug && typeof window.AwaraDB !== 'undefined' && window.AwaraDB) {
    tripData = await window.AwaraDB.getTripById(tripIdOrSlug);
  }

  // If on static page and tripData is not found, preserve pre-rendered static HTML!
  if (!tripData && isStaticPage) {
    console.log('ℹ️ [trip-detail-loader] Preserving pre-rendered static HTML for', window.location.pathname);
    return;
  }

  // If on master trip-detail.html template with no params, load first trip
  if (!tripData && !isStaticPage && typeof window.AwaraDB !== 'undefined') {
    const allTrips = await window.AwaraDB.getTrips(false);
    tripData = allTrips[0] || null;
  }

  if (!tripData) {
    return;
  }

  // Merge custom cache saved via admin panel if present
  const cacheKey = tripData ? tripData.id : tripId;
  if (cacheKey && localStorage.getItem(`trip_custom_${cacheKey}`)) {
    try {
      const cached = JSON.parse(localStorage.getItem(`trip_custom_${cacheKey}`));
      tripData = Object.assign({}, tripData || {}, cached);
    } catch(e) {}
  }

  // 2. Generate title-tailored contextual defaults if optional fields are missing
  if (tripData) {
    const titleName = tripData.title || 'Himalayan Expedition';
    const defaultContextual = {
      route: `${titleName} — Main Basecamp — High Altitude Pass — Scenic Vista`,
      tags: ['Expedition', 'Group Trip', 'Curated'],
      bento_img_1: tripData.image_url || 'assets/images/destinations/domestic/spiti.jpg',
      bento_img_2: tripData.image_url || 'assets/images/destinations/domestic/ladakh.jpg',
      bento_img_3: 'assets/images/destinations/domestic/meghalaya.jpg',
      bento_img_4: 'assets/images/destinations/domestic/kashmir.jpg',
      bento_img_5: 'assets/images/destinations/domestic/kerala.jpg',
      about_text: `Embark on an extraordinary journey with Awara Banjara for ${titleName}. Discover untouched natural landscapes, high mountain passes, vibrant local culture, and memorable campfire evenings with like-minded travelers.`,
      inclusions: [
        'Accommodation in Handpicked Hotels / Camps',
        'Daily Breakfast & Dinner',
        'Comfortable Group Transport (SUV / Traveler / Bike)',
        'Inner Line Permits & Permits Fees',
        'Experienced Trip Captain & Local Guide',
        'First Aid Kit & Emergency Support'
      ],
      exclusions: [
        'Airfare / Train tickets to base city',
        'Lunch & personal beverages during travel',
        'Personal expenses (laundry, tips, shopping)',
        'Anything not explicitly listed under inclusions'
      ],
      package_options: [
        { title: 'Standard Package', price: formatPrice(tripData.price) }
      ],
      sub_package_options: 'none',
      itinerary: [
        { day: `DAY 1: ARRIVAL & DEPARTURE FOR ${titleName.toUpperCase()}`, points: [`Meet trip captain and fellow travelers.`, `Scenic drive towards destination basecamp.`, `Overnight stay and briefing session.`] },
        { day: `DAY 2: EXPLORING ${titleName.toUpperCase()} SIGHTS`, points: [`Morning breakfast with mountain views.`, `Visit iconic valley locations and hidden gems.`, `Evening campfire and group bonding.`] },
        { day: `DAY 3: HIGHLIGHT EXPEDITION & RETURN`, points: [`Sunrise photography session.`, `Checkout and comfortable return journey.`, `Drop off with lifelong memories.`] }
      ],
      departure_dates: [
        {
          month: 'August 2026',
          dates: [
            { range: '1 August — 8 August', status: 'Available', price: formatPrice(tripData.price) },
            { range: '10 August — 17 August', status: 'Available', price: formatPrice(tripData.price) },
            { range: '20 August — 27 August', status: 'Sold Out', price: formatPrice(tripData.price) }
          ]
        }
      ],
      faqs: [
        { question: `WHAT IS THE BEST TIME FOR ${titleName.toUpperCase()}?`, answer: 'The best time to travel is during pleasant seasonal weather windows for maximum comfort.' },
        { question: 'IS THIS TRIP SUITABLE FOR SOLO TRAVELERS?', answer: 'Yes! Over 60% of our travelers join solo and make lifelong friends.' }
      ],
      reviews: [
        { name: 'Rohit Verma', location: 'Delhi · July 2026', text: `Traveling for ${titleName} with Awara Banjara was surreal! Highly recommended.`, avatar: 'assets/images/reviews/pfp-rohit.jpg' },
        { name: 'Ananya Sharma', location: 'Mumbai · June 2026', text: 'Flawless execution, amazing trip captain, and top notch service!', avatar: 'assets/images/reviews/pfp-ananya.jpg' }
      ],
      reserve_banner_title: `Reserve your seat for ${titleName}!`,
      reserve_banner_sub: 'Limited seats per batch for an intimate group experience.',
      custom_quote_title: 'Private Group Quote',
      custom_quote_sub: 'Customized itinerary for groups of 4+ travelers.'
    };

    tripData = Object.assign({}, defaultContextual, tripData);
  } else {
    tripData = getDefaultZanskarTripData();
  }

  // 3. Render all macros on the master itinerary template page
  renderFullTripDetail(tripData);
}

// Module-level state for selected package/sub-package tracking
let _selectedPackageTitle = '';
let _selectedPackagePrice = '';
let _selectedSubPackage = 'N/A';

function renderFullTripDetail(trip) {
  // 0. Update Address Bar to SEO Clean URL with Category & Trip Name
  let seoRelativeUrl = 'trip-detail';
  if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.buildSeoTripUrl) {
    seoRelativeUrl = window.AwaraDB.buildSeoTripUrl(trip);
  } else if (trip.id) {
    seoRelativeUrl = `trip-detail?id=${trip.id}`;
  }

  if (!window.location.pathname.includes('/trips/') && window.history && window.history.replaceState && window.location.protocol !== 'file:') {
    try {
      window.history.replaceState(null, '', seoRelativeUrl);
    } catch(e) {}
  }

  // Page Title & Meta
  const catName = (trip.category ? trip.category.split(',')[0].replace(/_tours$/i, ' Tours').replace(/_/g, ' ') : 'Himalayan Tours').trim();
  if (trip.title) {
    document.title = `${trip.title} — ${catName} | Awara Banjara`;
  }

  // Dynamic Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (canonicalEl) {
    canonicalEl.setAttribute('href', `https://awarabanjara.in/${seoRelativeUrl}`);
  }

  // Dynamic Open Graph Tags
  let ogTitleEl = document.querySelector('meta[property="og:title"]');
  if (ogTitleEl && trip.title) ogTitleEl.setAttribute('content', `${trip.title} — Awara Banjara`);

  let ogUrlEl = document.querySelector('meta[property="og:url"]');
  if (ogUrlEl) ogUrlEl.setAttribute('content', `https://awarabanjara.in/${seoRelativeUrl}`);

  let ogDescEl = document.querySelector('meta[property="og:description"]');
  if (ogDescEl && trip.about_text) ogDescEl.setAttribute('content', trip.about_text.substring(0, 160));

  // Dynamic Schema.org JSON-LD (TouristTrip & Offer)
  let schemaScript = document.getElementById('seo-trip-schema');
  if (!schemaScript) {
    schemaScript = document.createElement('script');
    schemaScript.id = 'seo-trip-schema';
    schemaScript.type = 'application/ld+json';
    document.head.appendChild(schemaScript);
  }

  const numericPrice = parseFloat(String(trip.price || '').replace(/[^0-9.]/g, '')) || 0;
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "name": trip.title || "Himalayan Trip",
    "description": trip.about_text || `${trip.title} with Awara Banjara`,
    "touristType": Array.isArray(trip.tags) ? trip.tags : (trip.tags ? String(trip.tags).split(',') : ["Adventure", "Group Trip"]),
    "image": trip.image_url || trip.bento_img_1 || "https://awarabanjara.in/assets/images/destinations/domestic/spiti.jpg",
    "offers": {
      "@type": "Offer",
      "price": numericPrice > 0 ? numericPrice : "0",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": `https://awarabanjara.in/${seoRelativeUrl}`
    },
    "provider": {
      "@type": "TravelAgency",
      "name": "Awara Banjara",
      "url": "https://awarabanjara.in/"
    }
  };
  schemaScript.textContent = JSON.stringify(jsonLdData, null, 2);

function fixAssetPath(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const isSubfolder = window.location.pathname.includes('/trips/');
  let cleanPath = path.replace(/^(\.\.\/)+/, '');
  if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
  return isSubfolder ? `../${cleanPath}` : cleanPath;
}

  // 1. Bento Photo Gallery (Main Cover image_url is Bento Image 1)
  const bentoCol1 = document.querySelector('.trip-bento-gallery .main-hero-bento img');
  const bentoCols = document.querySelectorAll('.trip-bento-gallery .side-bento-col img');

  if (bentoCol1 && (trip.bento_img_1 || trip.image_url)) {
    const heroSrc = fixAssetPath(trip.bento_img_1 || trip.image_url);
    if (bentoCol1.getAttribute('src') !== heroSrc) {
      bentoCol1.src = heroSrc;
    }
    bentoCol1.alt = `${trip.title || 'Himalayan Trip'} Hero Cover — Awara Banjara`;
    bentoCol1.onerror = function() {
      this.onerror = null;
      this.src = fixAssetPath('assets/images/placeholder-hero.svg');
    };
  }

  const sideImages = [
    trip.bento_img_2 || 'assets/images/destinations/domestic/ladakh.jpg',
    trip.bento_img_3 || 'assets/images/destinations/domestic/meghalaya.jpg',
    trip.bento_img_4 || 'assets/images/destinations/domestic/kashmir.jpg',
    trip.bento_img_5 || 'assets/images/destinations/domestic/kerala.jpg'
  ];

  bentoCols.forEach((imgEl, idx) => {
    if (sideImages[idx]) {
      const sideSrc = fixAssetPath(sideImages[idx]);
      if (imgEl.getAttribute('src') !== sideSrc) {
        imgEl.src = sideSrc;
      }
      imgEl.alt = `${trip.title || 'Himalayan Trip'} Gallery Photo ${idx + 2} — Awara Banjara`;
      imgEl.setAttribute('loading', 'lazy');
      imgEl.setAttribute('decoding', 'async');
      imgEl.onerror = function() {
        this.onerror = null;
        this.src = fixAssetPath(`assets/images/placeholder-card-${idx + 1}.svg`);
      };
    }
  });

  // 2. Title Card Macros
  const durationEl = document.querySelector('.title-meta-row .meta-duration');
  if (durationEl) durationEl.innerHTML = `⏱ ${trip.duration || '5 Days / 4 Nights'}`;

  const titleEl = document.querySelector('.trip-title');
  if (titleEl) titleEl.textContent = trip.title || 'Escape to Zanskar: Half Circuit';

  const routeEl = document.querySelector('.trip-route');
  if (routeEl) routeEl.textContent = trip.route || 'Manali — Gata Loops — Suraj Tal — Gonbo Rangjon — Padum — Jispa';

  // Tags
  const tagsRow = document.querySelector('.trip-tags-row');
  if (tagsRow && trip.tags) {
    const rawTags = Array.isArray(trip.tags) ? trip.tags : trip.tags.split(',');
    const tagsHTML = rawTags.map(t => `<span class="badge badge-tag">${t.trim()}</span>`).join('');
    const shareBtn = tagsRow.querySelector('.share-btn');
    tagsRow.innerHTML = tagsHTML;
    if (shareBtn) tagsRow.appendChild(shareBtn);
  }

  // 3. About This Trip Text
  const aboutTextEl = document.querySelector('.about-trip-text');
  if (aboutTextEl && trip.about_text) {
    aboutTextEl.textContent = trip.about_text;
  }

  // 4. Day-by-Day Accordion Itinerary
  const accordionContainer = document.querySelector('.itinerary-accordion');
  if (accordionContainer && trip.itinerary) {
    let itinList = trip.itinerary;
    if (typeof itinList === 'string') {
      try { itinList = JSON.parse(itinList); } catch (e) { itinList = []; }
    }

    if (Array.isArray(itinList) && itinList.length > 0) {
      accordionContainer.innerHTML = itinList.map((dayItem, idx) => {
        // 1. Determine Day Label
        let dayNumStr = `DAY ${idx + 1}`;
        if (typeof dayItem === 'object' && dayItem !== null && dayItem.day) {
          if (typeof dayItem.day === 'number') dayNumStr = `DAY ${dayItem.day}`;
          else if (typeof dayItem.day === 'string') dayNumStr = dayItem.day.toUpperCase();
        }

        // 2. Determine Title Text
        let rawTitle = '';
        if (typeof dayItem === 'string') {
          rawTitle = dayItem;
        } else if (typeof dayItem === 'object' && dayItem !== null) {
          rawTitle = dayItem.title || dayItem.day_title || dayItem.name || dayItem.header || '';
        }

        // Strip redundant "DAY X:" from raw title if present
        const cleanTitle = rawTitle.replace(/^DAY\s*\d+:\s*/i, '').trim();
        const headerDisplay = cleanTitle ? `${dayNumStr}: ${cleanTitle}` : dayNumStr;

        // 3. Determine Details / Content Text
        let contentHTML = '';
        if (typeof dayItem === 'object' && dayItem !== null) {
          if (dayItem.details) {
            contentHTML = `<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">${dayItem.details}</p>`;
          } else if (Array.isArray(dayItem.points) && dayItem.points.length > 0) {
            contentHTML = `<ul style="margin: 0; padding-left: 20px;">${dayItem.points.map(pt => `<li style="font-size: 14px; line-height: 1.6; color: #444; margin-bottom: 4px;">${pt}</li>`).join('')}</ul>`;
          } else if (dayItem.text || dayItem.description) {
            contentHTML = `<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">${dayItem.text || dayItem.description}</p>`;
          }
        }

        if (!contentHTML && cleanTitle) {
          contentHTML = `<p style="font-size: 14px; line-height: 1.6; color: #444; margin: 0;">${cleanTitle}</p>`;
        }

        return `
          <div class="acc-item ${idx === 0 ? 'active' : ''}">
            <button class="acc-trigger">
              <span class="acc-day-title" style="font-weight: 700;">${headerDisplay}</span>
              <span class="acc-icon">${idx === 0 ? '−' : '+'}</span>
            </button>
            <div class="acc-content" style="padding: 16px 20px;">
              ${contentHTML}
            </div>
          </div>
        `;
      }).join('');

      initAccordionListeners();
    }
  }

  // 5. Inclusions
  const inclusionsGrid = document.querySelector('.inclusions-grid');
  if (inclusionsGrid && trip.inclusions) {
    let incList = trip.inclusions;
    if (typeof incList === 'string') {
      try { incList = JSON.parse(incList); } catch (e) { incList = incList.split('\n'); }
    }

    if (Array.isArray(incList) && incList.length > 0) {
      inclusionsGrid.innerHTML = incList.map(item => `<div class="feat-item"><span class="icon-check">✔</span> ${item.trim()}</div>`).join('');
    }
  }

  // 6. Exclusions
  const exclusionsGrid = document.querySelector('.exclusions-grid');
  if (exclusionsGrid && trip.exclusions) {
    let excList = trip.exclusions;
    if (typeof excList === 'string') {
      try { excList = JSON.parse(excList); } catch (e) { excList = excList.split('\n'); }
    }

    if (Array.isArray(excList) && excList.length > 0) {
      exclusionsGrid.innerHTML = excList.map(item => `<div class="feat-item"><span class="icon-cross">✘</span> ${item.trim()}</div>`).join('');
    }
  }

  // 7. Package Options Pills (INTERACTIVE)
  const packagePillsContainer = document.querySelector('.package-options-pills');
  const packageCard = packagePillsContainer ? packagePillsContainer.closest('.detail-card') : null;

  const tripPriceFormatted = formatPrice(trip.price);
  const isTripOnRequest = tripPriceFormatted === 'On Request';

  let pkgList = trip.package_options;
  if (typeof pkgList === 'string') {
    try { pkgList = JSON.parse(pkgList); } catch (e) { pkgList = []; }
  }

  if (!Array.isArray(pkgList) || pkgList.length === 0) {
    pkgList = [{ title: 'Standard Package', price: tripPriceFormatted }];
  }

  if (packageCard) {
    packageCard.style.display = 'block';

    // Set initial selected package
    _selectedPackageTitle = pkgList[0].title || 'Standard Package';
    _selectedPackagePrice = formatPrice(pkgList[0].price || trip.price);

    packagePillsContainer.innerHTML = pkgList.map((pkg, idx) => {
      const pFormatted = formatPrice(pkg.price || trip.price);
      return `<button class="pill-btn ${idx === 0 ? 'active' : ''}" data-pkg-title="${pkg.title}" data-pkg-price="${pFormatted}">${pkg.title}<br><strong>${pFormatted}</strong></button>`;
    }).join('');

    // Click listeners for package option pills
    const allPkgBtns = packagePillsContainer.querySelectorAll('.pill-btn');
    allPkgBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        allPkgBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        _selectedPackageTitle = btn.getAttribute('data-pkg-title');
        _selectedPackagePrice = formatPrice(btn.getAttribute('data-pkg-price'));

        // Update sidebar price display
        const priceValEl = document.querySelector('.price-val');
        const priceLabelEl = document.querySelector('.sidebar-price-block .price-label');
        if (priceValEl) {
          if (_selectedPackagePrice === 'On Request') {
            priceValEl.innerHTML = `On Request`;
            if (priceLabelEl) priceLabelEl.textContent = 'Price';
          } else {
            priceValEl.innerHTML = `${_selectedPackagePrice} <small>per person</small>`;
            if (priceLabelEl) priceLabelEl.textContent = 'Starting From';
          }
        }

        // Update all date row prices to reflect new package base price
        const dateRows = document.querySelectorAll('.date-row');
        dateRows.forEach(row => {
          row.setAttribute('data-price', _selectedPackagePrice);
          const priceSpan = row.querySelector('.date-price');
          if (priceSpan) priceSpan.textContent = _selectedPackagePrice;
        });

        // Update booking buttons with new price
        const activeRow = document.querySelector('.selected-date-row');
        const currentRange = activeRow ? activeRow.getAttribute('data-range') : 'Selected Batch';
        updateBookingButtons(trip, currentRange, _selectedPackagePrice);
      });
    });
  }

  // Sub-package Pills (Bike Models)
  const subTitleEl = document.querySelector('.sub-package-title');
  const subPillsContainer = document.querySelector('.sub-package-pills');

  const subVal = trip.sub_package_options;
  const isSubEnabled = subVal && subVal !== 'none' && subVal !== '' && subVal !== '[]';

  if (subTitleEl) subTitleEl.style.display = isSubEnabled ? 'block' : 'none';
  if (subPillsContainer) {
    if (isSubEnabled) {
      subPillsContainer.style.display = 'flex';
      let subList = subVal;
      if (typeof subList === 'string') {
        try { subList = JSON.parse(subList); } catch (e) {
          // Smart split: avoid breaking on commas inside prices like ₹4,000
          if (subList.includes('),')) {
            subList = subList.split('),').map((s, i, arr) => i < arr.length - 1 ? s.trim() + ')' : s.trim());
          } else {
            subList = subList.split(',').map(s => s.trim());
          }
        }
      }
      if (Array.isArray(subList)) {
        // Set initial selected sub-package
        _selectedSubPackage = subList[0] ? subList[0].trim() : 'N/A';

        subPillsContainer.innerHTML = subList.map((sub, idx) => `
          <button class="sub-pill ${idx === 0 ? 'active' : ''}" data-sub-name="${sub.trim()}">${sub.trim()}</button>
        `).join('');

        // Click listeners for sub-package pills
        const allSubBtns = subPillsContainer.querySelectorAll('.sub-pill');
        allSubBtns.forEach(btn => {
          btn.addEventListener('click', function() {
            allSubBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _selectedSubPackage = btn.getAttribute('data-sub-name');
          });
        });
      }
    } else {
      subPillsContainer.style.display = 'none';
    }
  }

  // 8. Departure Dates Table & Month Tabs
  const monthTabsContainer = document.querySelector('.month-tabs');
  const datesTableContainer = document.querySelector('.dates-table');

  const DEFAULT_DEPARTURE_DATES = [
    {
      month: "August 2026",
      dates: [
        { id: "b1", range: "1st August", startDate: "2026-08-01", status: "Available", price: formatPrice(trip.price) },
        { id: "b2", range: "6th August", startDate: "2026-08-06", status: "Filling Fast", price: formatPrice(trip.price) },
        { id: "b3", range: "11th August", startDate: "2026-08-11", status: "Available", price: formatPrice(trip.price) },
        { id: "b4", range: "20th August", startDate: "2026-08-20", status: "Sold Out", price: formatPrice(trip.price) }
      ]
    }
  ];

function groupDepartureDatesByMonth(deps) {
  if (!deps) return [];
  if (typeof deps === 'string') {
    try { deps = JSON.parse(deps); } catch (e) { deps = []; }
  }

  let allDates = [];
  if (Array.isArray(deps)) {
    deps.forEach(item => {
      if (item && item.month && Array.isArray(item.dates)) {
        item.dates.forEach(d => {
          allDates.push({ ...d, parentMonth: item.month });
        });
      } else if (item && (item.range || item.startDate)) {
        allDates.push(item);
      }
    });
  }

  if (allDates.length === 0) return [];

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  function extractMonthYear(row) {
    if (row.startDate && typeof row.startDate === 'string') {
      const parts = row.startDate.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const mIdx = parseInt(parts[1], 10) - 1;
        if (MONTH_NAMES[mIdx]) {
          return `${MONTH_NAMES[mIdx]} ${y}`;
        }
      }
    }

    const rangeText = row.range || row.startDate || '';
    const mMatch = rangeText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
    if (mMatch) {
      const mName = mMatch[1].charAt(0).toUpperCase() + mMatch[1].slice(1).toLowerCase();
      const yMatch = rangeText.match(/\b(202\d)\b/);
      const year = yMatch ? yMatch[1] : '2026';
      return `${mName} ${year}`;
    }

    if (row.parentMonth && row.parentMonth.trim()) return row.parentMonth.trim();

    return "Upcoming Batches";
  }

  const groupedMap = {};
  const monthOrder = [];

  allDates.forEach(row => {
    const monthKey = extractMonthYear(row);
    if (!groupedMap[monthKey]) {
      groupedMap[monthKey] = [];
      monthOrder.push(monthKey);
    }
    const cleanRow = { ...row };
    delete cleanRow.parentMonth;
    groupedMap[monthKey].push(cleanRow);
  });

  return monthOrder.map(mKey => ({
    month: mKey,
    dates: groupedMap[mKey]
  }));
}

  const departureDatesCard = document.getElementById('departure-dates');
  if (departureDatesCard) departureDatesCard.style.display = 'block';

  const DEFAULT_DEPARTURE_DATES_ON_REQUEST = [
    {
      month: "Upcoming Batches",
      dates: [
        { id: "b1", range: "On Request Departure Date", startDate: "2026-08-01", status: "Available", price: "On Request" }
      ]
    }
  ];

  if (datesTableContainer) {
    let deps = groupDepartureDatesByMonth(trip.departure_dates);

    if (!Array.isArray(deps) || deps.length === 0) {
      deps = isTripOnRequest ? DEFAULT_DEPARTURE_DATES_ON_REQUEST : DEFAULT_DEPARTURE_DATES;
    }

    let activeSelectedRange = null;
    let activeSelectedPrice = formatPrice(trip.price);

    function renderDateRowsForBatch(batch) {
      const dateRows = batch.dates || [];
      if (dateRows.length === 0) {
        datesTableContainer.innerHTML = `<p style="padding:16px; color:#666; font-style:italic;">No departure dates scheduled for this month.</p>`;
        return;
      }

      // Default select first available row
      const firstAvailableIndex = dateRows.findIndex(r => r.status !== 'Sold Out');

      datesTableContainer.innerHTML = dateRows.map((row, rIdx) => {
        const isSelected = rIdx === (firstAvailableIndex !== -1 ? firstAvailableIndex : 0) && row.status !== 'Sold Out';
        const singleDateLabel = formatSingleDateDisplay(row.range);
        const rowPriceFormatted = formatPrice(row.price || trip.price);

        if (isSelected) {
          activeSelectedRange = singleDateLabel;
          activeSelectedPrice = rowPriceFormatted;
        }

        const badgeBg = row.status === 'Sold Out' ? '#fee2e2' : row.status === 'Filling Fast' ? '#fef3c7' : '#dcfce7';
        const badgeFg = row.status === 'Sold Out' ? '#b91c1c' : row.status === 'Filling Fast' ? '#d97706' : '#15803d';

        return `
          <div class="date-row ${row.status === 'Sold Out' ? 'sold-out-row' : ''} ${isSelected ? 'selected-date-row' : ''}" 
               data-range="${singleDateLabel}" data-price="${rowPriceFormatted}" data-status="${row.status}"
               style="cursor: ${row.status === 'Sold Out' ? 'not-allowed' : 'pointer'}; transition: all 0.2s ease; display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; margin-bottom: 8px; border-radius: 12px; border: ${isSelected ? '2px solid #b8ff00' : '1px solid #e0e0d8'}; background: ${isSelected ? '#fafef0' : '#ffffff'}; box-shadow: ${isSelected ? '0 0 12px rgba(184, 255, 0, 0.35)' : 'none'};">
            
            <div>
              <span class="date-range" style="font-weight: 700; color: #14140f; font-size: 15px;">${singleDateLabel}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="status-badge" style="font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px; background: ${badgeBg}; color: ${badgeFg};">${row.status}</span>
              <span class="date-price" style="font-weight: 800; font-size: 15px; color: #14140f;">${rowPriceFormatted}</span>
            </div>
          </div>
        `;
      }).join('');

      // Attach click listeners to date rows
      const rows = datesTableContainer.querySelectorAll('.date-row');
      rows.forEach(r => {
        r.addEventListener('click', function() {
          if (r.classList.contains('sold-out-row')) return;
          
          rows.forEach(other => {
            other.classList.remove('selected-date-row');
            other.style.border = '1px solid #e0e0d8';
            other.style.background = '#ffffff';
            other.style.boxShadow = 'none';
          });

          r.classList.add('selected-date-row');
          r.style.border = '2px solid #b8ff00';
          r.style.background = '#fafef0';
          r.style.boxShadow = '0 0 12px rgba(184, 255, 0, 0.35)';

          activeSelectedRange = r.getAttribute('data-range');
          activeSelectedPrice = r.getAttribute('data-price');

          // Update Book Now Buttons Text & Links
          updateBookingButtons(trip, activeSelectedRange, activeSelectedPrice);
        });
      });

      updateBookingButtons(trip, activeSelectedRange, activeSelectedPrice);
      initBookingModalHandlers(trip);
    }

    if (monthTabsContainer) {
      monthTabsContainer.innerHTML = deps.map((d, idx) => `
        <button class="month-tab ${idx === 0 ? 'active' : ''}" type="button" data-month-index="${idx}">${d.month}</button>
      `).join('');

      monthTabsContainer.querySelectorAll('.month-tab').forEach(tab => {
        tab.addEventListener('click', function() {
          monthTabsContainer.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const mIdx = parseInt(tab.getAttribute('data-month-index'), 10);
          renderDateRowsForBatch(deps[mIdx] || {});
        });
      });
    }

    renderDateRowsForBatch(deps[0] || {});
  }

function updateBookingButtons(trip, selectedRange, selectedPrice) {
  const waClean = (trip.whatsapp_number || '919103910523').replace(/[^0-9]/g, '');
  const displayRange = selectedRange || 'Selected Batch';
  const displayPrice = formatPrice(selectedPrice || trip.price);

  const priceMsg = (displayPrice === 'On Request') ? 'Price: On Request' : displayPrice;
  const waMsg = `Hi Awara Banjara, I want to book the ${trip.title} for batch: ${displayRange} (${priceMsg})!`;

  const bookNowBtn = document.querySelector('.btn-neon-book-now');
  const sidebarBookBtn = document.querySelector('.btn-sidebar-book');
  const reserveBtn = document.querySelector('.btn-black-reserve');
  const waSidebarBtn = document.querySelector('.btn-whatsapp-sidebar');

  if (bookNowBtn) {
    bookNowBtn.textContent = `BOOK NOW — ${displayRange}`;
    bookNowBtn.onclick = function(e) {
      e.preventDefault();
      openBookingModal(trip, displayRange, displayPrice);
    };
  }

  if (sidebarBookBtn) {
    sidebarBookBtn.onclick = function(e) {
      e.preventDefault();
      openBookingModal(trip, displayRange, displayPrice);
    };
  }

  if (reserveBtn) {
    reserveBtn.onclick = function(e) {
      e.preventDefault();
      openBookingModal(trip, displayRange, displayPrice);
    };
  }

  if (waSidebarBtn) {
    waSidebarBtn.href = `https://wa.me/${waClean}?text=${encodeURIComponent(waMsg)}`;
  }
}

function getResolvedHeroImgUrl(trip) {
  // 1. First preference: Active DOM bento hero image loaded on the itinerary page
  const bentoImgEl = document.getElementById('bentoImg1') || document.querySelector('.main-hero-bento img') || document.querySelector('.trip-bento-gallery img');
  if (bentoImgEl && bentoImgEl.src && !bentoImgEl.src.includes('placeholder')) {
    return bentoImgEl.src;
  }
  
  // 2. Second preference: Trip object property
  let rawUrl = (trip && (trip.bento_img_1 || trip.image_url || trip.heroImage)) || '';
  if (!rawUrl) {
    rawUrl = 'assets/images/trips/gonbo-rangjon.jpg';
  }

  // 3. Fix relative paths if page is in /trips/ sub-directory
  const isSubfolder = window.location.pathname.includes('/trips/');
  if (isSubfolder && !rawUrl.startsWith('../') && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://') && !rawUrl.startsWith('data:')) {
    return '../' + rawUrl.replace(/^\//, '');
  } else if (!isSubfolder && rawUrl.startsWith('../')) {
    return rawUrl.replace(/^\.\.\//, '');
  }
  return rawUrl;
}

function openBookingModal(trip, selectedRange, selectedPrice) {
  const modal = document.getElementById('bookingModal');
  const heroEl = document.getElementById('bookingPopupHero');
  const batchEl = document.getElementById('bookingSelectedBatch');
  const priceEl = document.getElementById('bookingSelectedPrice');
  const dateDisplayInput = document.getElementById('custDateDisplay');

  const displayRange = selectedRange || '1st August';
  const displayPrice = formatPrice(selectedPrice || (trip && trip.price));

  if (heroEl) {
    const heroImgUrl = getResolvedHeroImgUrl(trip);
    heroEl.style.backgroundImage = `url('${heroImgUrl}')`;
    heroEl.style.backgroundSize = 'cover';
    heroEl.style.backgroundPosition = 'center';
  }
  if (batchEl) batchEl.textContent = `🗓️ ${displayRange}`;
  if (priceEl) priceEl.textContent = displayPrice;
  if (dateDisplayInput) dateDisplayInput.value = displayRange;

  // Show selected package & sub-package in modal
  const pkgLabelEl = document.getElementById('bookingSelectedPackage');
  if (pkgLabelEl) {
    const pkgText = _selectedPackageTitle || 'Standard Package';
    const subText = _selectedSubPackage && _selectedSubPackage !== 'N/A' ? ` · ${_selectedSubPackage}` : '';
    pkgLabelEl.textContent = `📦 ${pkgText}${subText}`;
  }

  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
}

function initBookingModalHandlers(trip) {
  const modal = document.getElementById('bookingModal');
  const closeBtn = document.getElementById('closeBookingModal');
  const form = document.getElementById('bookingForm');

  if (closeBtn && modal) {
    closeBtn.onclick = function() {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };
  }

  if (form) {
    form.onsubmit = async function(e) {
      e.preventDefault();
      
      const custName = document.getElementById('custName').value.trim();
      const custPhone = document.getElementById('custPhone').value.trim();
      const custEmail = document.getElementById('custEmail').value.trim();
      const custTravelers = parseInt(document.getElementById('custTravelers').value, 10) || 1;
      const custRequests = document.getElementById('custRequests').value.trim();

      const batchText = (document.getElementById('custDateDisplay')?.value || document.getElementById('bookingSelectedBatch')?.textContent || '1st August').replace('🗓️ Batch:', '').replace('🗓️', '').trim();
      const priceText = document.getElementById('bookingSelectedPrice').textContent.trim();

      const pkgTag = _selectedPackageTitle ? `[Package: ${_selectedPackageTitle}]` : '';
      const subTag = (_selectedSubPackage && _selectedSubPackage !== 'N/A') ? `[Bike: ${_selectedSubPackage}]` : '';
      const fullMsg = [pkgTag, subTag, custRequests].filter(Boolean).join(' ');

      const displayPriceWithPkg = _selectedPackageTitle ? `${priceText} (${_selectedPackageTitle})` : priceText;

      const inquiryPayload = {
        inquiry_id: 'INQ_' + Date.now(),
        trip_id: String(trip.id || 'custom'),
        trip_title: trip.title || 'Spiti Summer Expedition',
        price: displayPriceWithPkg,
        selected_date: batchText,
        selected_package: _selectedPackageTitle || 'Standard Package',
        selected_sub_package: _selectedSubPackage || 'N/A',
        customer_name: custName,
        phone: custPhone,
        email: custEmail || 'N/A',
        travelers_count: custTravelers,
        message: fullMsg || '—',
        status: 'new'
      };

      const bookingPayload = {
        booking_id: 'BK_' + Date.now(),
        package_id: String(trip.id || 'custom'),
        customer_name: custName,
        email: custEmail || 'N/A',
        phone: custPhone,
        travelers_count: custTravelers,
        selected_batch: batchText,
        selected_price: displayPriceWithPkg,
        special_requests: fullMsg || '—',
        status: 'pending'
      };

      // 1. Submit Inquiry via AwaraDB Local Engine
      if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB) {
        await window.AwaraDB.submitInquiry(inquiryPayload);
      }

      if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }

      // Show Success Confirmation Modal
      const successModal = document.getElementById('inquirySuccessModal');
      const closeSuccessBtn = document.getElementById('closeSuccessModalBtn');

      if (successModal) {
        successModal.classList.add('active');
        successModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }

      if (closeSuccessBtn && successModal) {
        closeSuccessBtn.onclick = function() {
          successModal.classList.remove('active');
          successModal.setAttribute('aria-hidden', 'true');
          document.body.style.overflow = '';
        };
      }

      form.reset();
    };
  }
}

  // 9. FAQs Accordion
  const faqAccordion = document.querySelector('.faq-accordion');
  if (faqAccordion && trip.faqs) {
    let faqList = trip.faqs;
    if (typeof faqList === 'string') {
      try { faqList = JSON.parse(faqList); } catch (e) { faqList = []; }
    }

    if (Array.isArray(faqList) && faqList.length > 0) {
      faqAccordion.innerHTML = faqList.map(faq => `
        <div class="faq-item">
          <button class="faq-trigger">+ ${faq.question.toUpperCase()}</button>
          <div class="faq-content"><p>${faq.answer}</p></div>
        </div>
      `).join('');

      initFAQListeners();
    }
  }

  // 10. Reviews Grid — Show ONLY/ALL relevant reviews that backlink to this itinerary page
  const reviewsContainer = document.querySelector('.reviews-mini-grid') || document.querySelector('.reviews-grid');
  if (reviewsContainer) {
    (async () => {
      let allDbReviews = [];
      if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.getReviews) {
        try { allDbReviews = await window.AwaraDB.getReviews(false); } catch (e) {}
      }
      if (!allDbReviews || allDbReviews.length === 0) {
        try {
          const cached = localStorage.getItem('awara_reviews_cache');
          if (cached) allDbReviews = JSON.parse(cached);
        } catch (e) {}
      }

      const clean = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const currentTripId = String(trip.id || '');
      const currentTripTitle = trip.title || 'Himalayan Expedition';
      const currentCleanTitle = clean(currentTripTitle);
      const currentCategory = (trip.category || '').toLowerCase();

      // Current trip backlink URL
      let currentBacklinkUrl = window.location.pathname.split('/').pop() || '/';
      if (currentBacklinkUrl.includes('trip-detail') && trip.id) {
        currentBacklinkUrl = `trip-detail?id=${trip.id}`;
      }

      // Step A: Find reviews directly matching this trip ID / Title / URL
      let matchingReviews = (allDbReviews || []).filter(rev => {
        if (!rev || !rev.review_text || !rev.review_text.trim()) return false;
        const revTripId = String(rev.trip_id || '');
        const revTripUrl = rev.trip_url || '';
        const revTripName = rev.trip_name || '';

        if (revTripId && revTripId === currentTripId) return true;
        if (revTripUrl && (revTripUrl.includes(`-${currentTripId}`) || revTripUrl.includes(`id=${currentTripId}`))) return true;
        const rClean = clean(revTripName);
        if (rClean && currentCleanTitle && (rClean === currentCleanTitle || rClean.includes(currentCleanTitle) || currentCleanTitle.includes(rClean))) return true;
        return false;
      });

      // Step B: Fallback if no direct review match exists for this trip
      if (matchingReviews.length === 0) {
        matchingReviews = (allDbReviews || []).filter(rev => {
          if (!rev || !rev.review_text || !rev.review_text.trim()) return false;
          const rName = (rev.trip_name || '').toLowerCase();
          const rCat = (rev.category || '').toLowerCase();
          if (currentCategory && (rCat.includes(currentCategory) || rName.includes(currentCategory))) return true;
          if (currentCleanTitle.includes('spiti') && rName.includes('spiti')) return true;
          if (currentCleanTitle.includes('zanskar') && rName.includes('zanskar')) return true;
          if (currentCleanTitle.includes('kashmir') && rName.includes('kashmir')) return true;
          if (currentCleanTitle.includes('himachal') && rName.includes('himachal')) return true;
          if (currentCleanTitle.includes('ladakh') && rName.includes('ladakh')) return true;
          return false;
        });
      }

      // Step C: Top fallback if still empty
      if (matchingReviews.length === 0) {
        matchingReviews = (allDbReviews || []).filter(r => r && r.review_text && r.review_text.trim()).slice(0, 4);
      }

      // Always cap to top 4 reviews
      if (matchingReviews.length > 4) {
        matchingReviews = matchingReviews.slice(0, 4);
      }

      if (matchingReviews.length > 0) {
        reviewsContainer.className = 'reviews-grid';
        reviewsContainer.innerHTML = matchingReviews.map(rev => {
          const name = rev.customer_name || rev.name || 'Verified Traveler';
          const initial = name.trim().charAt(0).toUpperCase();
          const avatarUrl = rev.avatar_url || rev.avatar;
          const avatarHtml = (avatarUrl && avatarUrl.trim() && !avatarUrl.includes('placeholder'))
            ? `<img src="${encodeURI(avatarUrl.trim())}" alt="${name}" class="rev-avatar-img">`
            : `<div class="avatar-circle-initial" style="background-color: #0284c7;">${initial}</div>`;
          const starSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#facc15"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
          const rating = parseInt(rev.rating, 10) || 5;
          const dateText = rev.date_text || '1 month ago';
          const tripTag = rev.trip_tag || 'private';

          return `
            <article class="review-card-modern">
              <div class="rev-card-header">
                ${avatarHtml}
                <div class="rev-header-info">
                  <div class="rev-author-name-row">
                    <strong class="rev-author-name">${name}</strong>
                    <span class="rev-trip-tag">${tripTag}</span>
                  </div>
                  <div class="rev-booked-row">
                    <span class="booked-label">Booked:</span>
                    <a href="${currentBacklinkUrl}" class="booked-trip-link"><strong>${currentTripTitle}</strong> <span class="arrow">↗</span></a>
                  </div>
                </div>
              </div>

              <div class="rev-rating-date-row">
                <div class="stars">${starSvg.repeat(rating)}</div>
                <span class="rev-date-text">${dateText}</span>
              </div>

              <p class="rev-quote-body">"${rev.review_text || rev.text}" <span class="read-more">Read More</span></p>
            </article>
          `;
        }).join('');
      }
    })();
  }

  // 11. Reserve Seat Banner Macros
  const resTitleEl = document.querySelector('.reserve-seat-banner .reserve-text h3');
  const resSubEl = document.querySelector('.reserve-seat-banner .reserve-text p');
  if (resTitleEl && trip.reserve_banner_title) resTitleEl.textContent = trip.reserve_banner_title;
  if (resSubEl && trip.reserve_banner_sub) resSubEl.textContent = trip.reserve_banner_sub;

  // 12. Custom Quote Sidebar Box Macros
  const customTitleEl = document.querySelector('.custom-trip-box h4');
  const customSubEl = document.querySelector('.custom-trip-box p');
  if (customTitleEl && trip.custom_quote_title) customTitleEl.textContent = trip.custom_quote_title;
  if (customSubEl && trip.custom_quote_sub) customSubEl.textContent = trip.custom_quote_sub;

  // 13. Sticky Sidebar Price & WhatsApp Number Macros
  const priceValEl = document.querySelector('.price-val');
  const priceLabelEl = document.querySelector('.sidebar-price-block .price-label');
  if (priceValEl) {
    const formattedPrice = formatPrice(trip.price);
    if (formattedPrice === 'On Request') {
      priceValEl.innerHTML = `On Request`;
      if (priceLabelEl) priceLabelEl.textContent = 'Price';
    } else {
      priceValEl.innerHTML = `${formattedPrice} <small>per person</small>`;
      if (priceLabelEl) priceLabelEl.textContent = 'Starting From';
    }
  }

  const waNum = trip.whatsapp_number || '919103910523';
  const waClean = waNum.replace(/[^0-9]/g, '');
  const waSidebarBtn = document.querySelector('.btn-whatsapp-sidebar');
  const waCustomQuoteBtn = document.querySelector('.btn-custom-quote');
  
  if (waSidebarBtn) {
    waSidebarBtn.href = `https://wa.me/${waClean}?text=Hi%20Awara%20Banjara,%20I%20have%20questions%20about%20the%20${encodeURIComponent(trip.title)}%20trip!`;
  }
  if (waCustomQuoteBtn) {
    waCustomQuoteBtn.href = `https://wa.me/${waClean}?text=Hi%20Awara%20Banjara,%20I%20want%20a%20custom%20private%20quote%20for%20${encodeURIComponent(trip.title)}!`;
  }

  // Share Modal Dynamic Links
  const shareThumb = document.querySelector('.share-trip-thumb');
  const shareTitle = document.querySelector('.share-trip-info h4');
  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');

  if (shareThumb) {
    const resolvedThumb = getResolvedHeroImgUrl(trip);
    shareThumb.src = resolvedThumb;
    shareThumb.alt = trip.title || 'Trip Cover';
    shareThumb.onerror = function() {
      const isSubDir = window.location.pathname.includes('/trips/');
      this.src = (isSubDir ? '../' : '') + 'assets/images/trips/gonbo-rangjon.jpg';
    };
  }
  if (shareTitle) shareTitle.textContent = trip.title;
  if (shareWhatsAppBtn) {
    const shareText = `Check out this epic ${trip.title} trip with Awara Banjara! ${window.location.href}`;
    shareWhatsAppBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  }

  // 14. Ensure Booking Modal Handlers are attached unconditionally on page load
  initBookingModalHandlers(trip);
}

function initAccordionListeners() {
  document.querySelectorAll('.acc-trigger').forEach(btn => {
    btn.addEventListener('click', function () {
      const item = btn.closest('.acc-item');
      const isActive = item.classList.contains('active');
      item.classList.toggle('active');
      const icon = btn.querySelector('.acc-icon');
      if (icon) icon.textContent = isActive ? '+' : '−';
    });
  });
}

function initFAQListeners() {
  document.querySelectorAll('.faq-trigger').forEach(btn => {
    btn.addEventListener('click', function () {
      const item = btn.closest('.faq-item');
      item.classList.toggle('active');
    });
  });
}

function getDefaultZanskarTripData() {
  return {
    title: 'Escape to Zanskar: Half Circuit',
    duration: '5 Days / 4 Nights',
    price: '₹13,999',
    route: 'Manali — Gata Loops — Suraj Tal — Gonbo Rangjon — Padum — Jispa',
    tags: ['Mountain', 'Group Trip', 'High Alt'],
    bento_img_1: 'assets/images/destinations/domestic/spiti.jpg',
    bento_img_2: 'assets/images/destinations/domestic/ladakh.jpg',
    bento_img_3: 'assets/images/destinations/domestic/meghalaya.jpg',
    bento_img_4: 'assets/images/destinations/domestic/kashmir.jpg',
    bento_img_5: 'assets/images/destinations/domestic/kerala.jpg',
    about_text: 'Embark on a raw Himalayan expedition through Zanskar untouched high mountain passes. Traverse the breathtaking Shinku La Pass, gaze upon the sacred monolithic peak of Gonbo Rangjon, explore ancient monasteries perched on sheer cliffs, and ride along crystal-clear glacier rivers.',
    inclusions: [
      'Accommodation (4 Nights in Hotels / Camps)',
      'Daily Breakfast & Dinner (Pure Veg & Egg)',
      'SUV Transport (Innova / Traveler / Bike)',
      'Inner Line Permits & Environmental Fees',
      'Experienced Trip Captain & Local Guide',
      'Oxygen Cylinder & First Aid Kit on Board',
      'Mechanical Support & Backup Vehicle',
      'Welcome Drink & Farewell Dinner'
    ],
    exclusions: [
      'Airfare / Train tickets to Manali',
      'Lunch & personal snacks during travel',
      'Personal expenses (laundry, tips, drinks)',
      'Anything not explicitly mentioned in inclusions',
      'Monument entrance & monastery camera fees',
      'Travel Insurance',
      'Medical emergencies & evacuation costs'
    ],
    package_options: [
      { title: 'Dual Rider', price: '₹13,999' },
      { title: 'Solo Rider', price: '₹16,999' },
      { title: 'Own Bike', price: '₹11,999' }
    ],
    sub_package_options: ['Himalayan 411', 'Himalayan 450'],
    itinerary: [
      { day: 'DAY 1: MANALI TO PADUM (VIA ATAL TUNNEL)', points: ['Early morning departure from Manali via Atal Tunnel.', 'Drive past Jispa & Darcha, scaling the mighty Shinku La Pass (16,580 ft).', 'Stop at Gonbo Rangjon for photos.', 'Arrive in Padum by evening. Check-in to hotel stay.'] },
      { day: 'DAY 2: PADUM LOCAL SIGHTSEEING & PHUGTAL MONASTERY', points: ['Morning visit to Karsha Monastery & Zangla Fort.', 'Trek to cliffside Phugtal Monastery.', 'Interact with local monks & experience Zanskari heritage.'] },
      { day: 'DAY 3: PADUM TO GONBO RANGJON CAMPING', points: ['Scenic drive towards Gonbo Rangjon monolith.', 'Set up alpine dome tents under a blanket of stars.', 'Stargazing session with warm soup & campfire.'] },
      { day: 'DAY 4: GONBO RANGJON TO JISPA', points: ['Witness sunrise over Zanskar range.', 'Cross back over Shinku La towards Jispa.', 'Check-in at riverside camps in Jispa with dinner & music.'] },
      { day: 'DAY 5: JISPA TO MANALI (DEPARTURE)', points: ['Breakfast by the Bhaga River.', 'Drive back to Manali via Solang Valley.', 'Drop-off at Volvo stand with lifelong memories!'] }
    ],
    departure_dates: [
      {
        month: 'July 2026',
        dates: [
          { range: '1 August — 10 August', status: 'Available', price: '₹13,999' },
          { range: '6 August — 15 August', status: 'Available', price: '₹13,999' },
          { range: '11 August — 20 August', status: 'Available', price: '₹13,999' },
          { range: '20 August — 29 August', status: 'Sold Out', price: '₹13,999' }
        ]
      }
    ],
    faqs: [
      { question: 'WHAT IS THE BEST TIME FOR A ZANSKAR VALLEY TRIP?', answer: 'June to September is the ideal window as Shinku La Pass is open and weather is pleasant.' },
      { question: 'IS THIS TRIP SUITABLE FOR BEGINNERS?', answer: 'Yes, SUV travellers need no prior experience. For riders, basic off-roading experience is recommended.' }
    ],
    reviews: [
      { name: 'Rohit Verma', location: 'Delhi · July 2026', text: 'Zanskar with Awara Banjara was surreal! Camping under Gonbo Rangjon was an unforgettable memory.', avatar: 'assets/images/reviews/pfp-rohit.jpg' },
      { name: 'Ananya Sharma', location: 'Mumbai · June 2026', text: 'Flawless execution, amazing trip captain, and top notch bikes!', avatar: 'assets/images/reviews/pfp-ananya.jpg' }
    ]
  };
}
