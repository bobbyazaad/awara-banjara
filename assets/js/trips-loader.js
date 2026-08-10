// =========================================================
// AwaraBanjara — High-Performance Trips Loader & Carousel Engine v10
// Consumes AwaraDB to render carousels, 3D card stack & category grids
// =========================================================

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 [trips-loader v11] DOMContentLoaded fired. Instant SWR loadTrips starting...');
    loadTrips(false);
  });

  async function loadTrips(forceRefresh = false) {
    let tripsData = [];

    // Path 1: Use AwaraDB engine
    if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB) {
      try {
        tripsData = await window.AwaraDB.getTrips(forceRefresh);
      } catch (err) {}
    }

    // Path 2: Local JSON fallback
    if (!tripsData || tripsData.length === 0) {
      try {
        const res = await fetch('data/trips.json');
        tripsData = await res.json();
      } catch (err) {
        tripsData = [];
      }
    }

    renderTrips(tripsData);
  }

  function renderTrips(trips) {
    const sortedTrips = trips.slice().sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));

    // =====================================================
    // 1. HOME PAGE: "From Reels to Real" Carousel
    // =====================================================
    const carouselStage = document.querySelector('#reels-carousel .carousel-stage');
    console.log('🎯 [trips-loader] #reels-carousel .carousel-stage found?', !!carouselStage);
    if (carouselStage) {
      if (sortedTrips.length > 0) {
        const reelsTrips = sortedTrips.filter(trip => trip.is_featured_reels !== false);
        const tripsToShow = reelsTrips.length > 0 ? reelsTrips : sortedTrips;
        carouselStage.innerHTML = tripsToShow.map(trip => createTripCardHTML(trip)).join('');
        console.log('✅ [trips-loader] Reels carousel: injected', tripsToShow.length, 'cards');
      } else {
        carouselStage.innerHTML = createComingSoonHTML('Featured trips for "From Reels to Real"');
        console.log('ℹ️ [trips-loader] Reels carousel: showing Coming Soon (0 trips)');
      }
      if (typeof window.initCarousels === 'function') window.initCarousels();
    }

    // =====================================================
    // 2. HOME PAGE: "High-End Wandering on a Lemonade Budget"
    //    RULE: Only show trips with price <= ₹14,999 OR is_featured_lemonade === true
    // =====================================================
    const lemonadeStage = document.querySelector('#lemonade-budget-carousel .carousel-stage');
    console.log('🎯 [trips-loader] #lemonade-budget-carousel .carousel-stage found?', !!lemonadeStage);
    if (lemonadeStage) {
      if (sortedTrips.length > 0) {
        const budgetTrips = sortedTrips.filter(trip => {
          if (trip.is_featured_lemonade === false) return false;
          if (trip.is_featured_lemonade === true) return true;
          if (!trip.price) return false;
          const numPrice = parseInt(String(trip.price).replace(/[^\d]/g, ''), 10);
          return !isNaN(numPrice) && numPrice <= 14999;
        });
        if (budgetTrips.length > 0) {
          lemonadeStage.innerHTML = budgetTrips.map(trip => createTripCardHTML(trip)).join('');
          console.log('✅ [trips-loader] Lemonade carousel: injected', budgetTrips.length, 'budget cards');
        } else {
          lemonadeStage.innerHTML = createComingSoonHTML('Budget Himalayan escapes under ₹14,999');
          console.log('ℹ️ [trips-loader] Lemonade carousel: no budget trips (all above ₹14,999)');
        }
      } else {
        lemonadeStage.innerHTML = createComingSoonHTML('Budget Himalayan escapes under ₹14,999');
        console.log('ℹ️ [trips-loader] Lemonade carousel: showing Coming Soon (0 trips)');
      }
      if (typeof window.initCarousels === 'function') window.initCarousels();
    }

    // =====================================================
    // 3. HOME PAGE: Featured Destination Card Stack (Flipkart 3D Stack)
    // =====================================================
    console.log('🎯 [trips-loader] window.CardStackManager found?', !!window.CardStackManager);
    if (window.CardStackManager) {
      if (sortedTrips.length > 0) {
        const stackTrips = sortedTrips.filter(trip => trip.is_featured_stack !== false);
        const tripsToShow = stackTrips.length > 0 ? stackTrips : sortedTrips;
        window.CardStackManager.setTrips(tripsToShow);
        console.log('✅ [trips-loader] CardStackManager.setTrips() called with', tripsToShow.length, 'trips');
      } else {
        window.CardStackManager.renderComingSoon();
        console.log('ℹ️ [trips-loader] CardStackManager: showing Coming Soon (0 trips)');
      }
    }

    // =====================================================
    // 4. TOUR PACKAGES PAGE: Category Grids
    // =====================================================
    const packagesContainer = document.getElementById('packagesCategoryContainer');
    console.log('🎯 [trips-loader] #packagesCategoryContainer found?', !!packagesContainer);
    if (packagesContainer) {
      renderTourPackagesPage(sortedTrips, packagesContainer);
    }
  }

  function parseNumericPrice(priceStr) {
    if (!priceStr || typeof priceStr !== 'string') return 0;
    const cleaned = priceStr.replace(/[^0-9]/g, '');
    if (!cleaned) return 0;
    return parseInt(cleaned, 10);
  }

  function renderTourPackagesPage(trips, container) {
    if (!container) return;

    const catSelect = document.getElementById('filterCategory');
    const priceSelect = document.getElementById('filterPrice');
    const sortSelect = document.getElementById('filterSort');
    const resetBtn = document.getElementById('resetFiltersBtn');
    const badgeEl = document.getElementById('filterResultsBadge');

    // Categories map directly to the CMS values selected in admin panel
    // Supports multi-category trips (a trip appears in every matching section)
    const categories = [
      { key: 'spiti-tours', name: 'Spiti Tours', dbValues: ['spiti_tours'] },
      { key: 'himachal-tours', name: 'Himachal Tours', dbValues: ['himachal_tours'] },
      { key: 'kashmir-tours', name: 'Kashmir Tours', dbValues: ['kashmir_tours'] },
      { key: 'ladakh-tours', name: 'Ladakh Tours', dbValues: ['ladakh_tours'] },
      { key: 'heart-of-india-tours', name: 'Heart of India Tours', dbValues: ['heart_of_india_tours'] },
      { key: 'northeast_india_tours', name: 'North-East India Tours', dbValues: ['northeast_india_tours'] },
      { key: 'south-india-tours', name: 'South India Tours', dbValues: ['south_india_tours'] },
      { key: 'goa-tours', name: 'Goa Tours', dbValues: ['goa_tours'] },
      { key: 'rajasthan_tours', name: 'Rajasthan Tours', dbValues: ['rajasthan_tours'] },
      { key: 'uttarakhand_tours', name: 'Uttarakhand Tours', dbValues: ['uttarakhand_tours'] },
      { key: 'international_tours', name: 'International Tours', dbValues: ['international_tours'] },
      { key: 'women-special', name: 'Women Only Tours', dbValues: ['women_only_tours', 'women_trips'] },
      { key: 'treks', name: 'Treks', dbValues: ['treks'] },
      { key: 'bike-expeditions', name: 'Bike Tours', dbValues: ['bike_tours', 'bike_trips'] },
      { key: 'festival-tours', name: 'Festival Tours', dbValues: ['festival_tours', 'group_trips'] },
      { key: 'corporate-tours', name: 'Corporate Tours', dbValues: ['corporate_tours'] },
      { key: 'educational-trips', name: 'Educational Trips', dbValues: ['educational_trips'] }
    ];

    function tripMatchesCategory(t, dbValues) {
      if (!t || !t.category) return false;
      let tripCats = [];
      if (Array.isArray(t.category)) {
        tripCats = t.category.map(c => String(c).trim().toLowerCase());
      } else if (typeof t.category === 'string') {
        const raw = t.category.trim();
        if (raw.startsWith('[') && raw.endsWith(']')) {
          try { tripCats = JSON.parse(raw).map(c => String(c).trim().toLowerCase()); } catch(e) {}
        }
        if (tripCats.length === 0) {
          tripCats = raw.split(',').map(c => c.trim().toLowerCase());
        }
      }
      return dbValues.some(v => tripCats.includes(v.toLowerCase()));
    }

    // Check hash in URL for initial category selection (e.g. #bike-expeditions, #festival-tours, #treks, #women-special)
    function syncHashCategory() {
      const urlHash = (window.location.hash || '').replace('#', '').toLowerCase();
      if (catSelect) {
        if (!urlHash) {
          catSelect.value = 'all';
        } else {
          const matchedCat = categories.find(c => c.key.toLowerCase() === urlHash);
          if (matchedCat) {
            catSelect.value = matchedCat.dbValues[0];
          }
        }
      }
    }
    syncHashCategory();
    window.addEventListener('hashchange', function() {
      syncHashCategory();
      applyFiltersAndRender();
    });

    function applyFiltersAndRender() {
      const selectedCat = catSelect ? catSelect.value : 'all';
      const selectedPrice = priceSelect ? priceSelect.value : 'all';
      const selectedSort = sortSelect ? sortSelect.value : 'default';

      const isFilterActive = selectedCat !== 'all' || selectedPrice !== 'all' || selectedSort !== 'default';

      if (resetBtn) {
        resetBtn.style.display = isFilterActive ? 'inline-block' : 'none';
      }

      // Filter trips
      let filtered = trips.filter(t => {
        // Category Filter
        if (selectedCat !== 'all') {
          const dbVals = [selectedCat];
          if (selectedCat === 'bike_tours') dbVals.push('bike_trips');
          if (selectedCat === 'festival_tours') dbVals.push('group_trips');
          if (selectedCat === 'women_only_tours') dbVals.push('women_trips');
          if (!tripMatchesCategory(t, dbVals)) return false;
        }

        // Price Filter
        const numPrice = parseNumericPrice(t.price);
        const isOnReq = numPrice === 0 || formatPrice(t.price) === 'On Request';

        if (selectedPrice === 'under_10k') {
          if (isOnReq || numPrice >= 10000) return false;
        } else if (selectedPrice === '10k_20k') {
          if (isOnReq || numPrice < 10000 || numPrice > 20000) return false;
        } else if (selectedPrice === '20k_30k') {
          if (isOnReq || numPrice < 20000 || numPrice > 30000) return false;
        } else if (selectedPrice === 'above_30k') {
          if (isOnReq || numPrice <= 30000) return false;
        } else if (selectedPrice === 'on_request') {
          if (!isOnReq) return false;
        }

        return true;
      });

      // Sort trips
      if (selectedSort === 'price_low_high') {
        filtered.sort((a, b) => {
          const pA = parseNumericPrice(a.price);
          const pB = parseNumericPrice(b.price);
          if (pA === 0) return 1;
          if (pB === 0) return -1;
          return pA - pB;
        });
      } else if (selectedSort === 'price_high_low') {
        filtered.sort((a, b) => {
          const pA = parseNumericPrice(a.price);
          const pB = parseNumericPrice(b.price);
          return pB - pA;
        });
      }

      // Update count badge
      if (badgeEl) {
        badgeEl.textContent = `Showing ${filtered.length} Package${filtered.length === 1 ? '' : 's'}`;
      }

      // Render Output
      if (!isFilterActive) {
        // Default categorized layout
        let html = '';
        const matchedTripIds = new Set();

        categories.forEach(cat => {
          const catTrips = trips.filter(t => tripMatchesCategory(t, cat.dbValues));
          catTrips.forEach(t => matchedTripIds.add(String(t.id)));

          if (catTrips.length > 0) {
            html += `
              <section class="category-section" id="${cat.key}">
                <h2 class="category-title">${cat.name}</h2>
                <div class="packages-grid">
                  ${catTrips.map(trip => createTripCardHTML(trip)).join('')}
                </div>
              </section>
            `;
          }
        });

        const remainingTrips = trips.filter(t => !matchedTripIds.has(String(t.id)));
        if (remainingTrips.length > 0) {
          html = `
            <section class="category-section" id="all-featured-expeditions">
              <h2 class="category-title">Featured All Expeditions &amp; Group Trips</h2>
              <div class="packages-grid">
                ${remainingTrips.map(trip => createTripCardHTML(trip)).join('')}
              </div>
            </section>
          ` + html;
        }

        container.innerHTML = html;
      } else {
        // Filtered Grid Layout
        if (filtered.length === 0) {
          container.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; background: #ffffff; border-radius: 16px; border: 1px solid #e0e0d8; margin-top: 10px;">
              <h3 style="font-size: 20px; font-weight: 800; color: #14140f; margin-bottom: 8px;">No packages found</h3>
              <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Try adjusting your category or price filters to see available itineraries.</p>
              <button id="emptyStateResetBtn" type="button" style="padding: 10px 20px; border-radius: 10px; border: none; background: #14140f; color: #b8ff00; font-size: 14px; font-weight: 800; cursor: pointer;">Reset All Filters</button>
            </div>
          `;
          const emptyResetBtn = document.getElementById('emptyStateResetBtn');
          if (emptyResetBtn) {
            emptyResetBtn.addEventListener('click', () => {
              if (catSelect) catSelect.value = 'all';
              if (priceSelect) priceSelect.value = 'all';
              if (sortSelect) sortSelect.value = 'default';
              applyFiltersAndRender();
            });
          }
        } else {
          container.innerHTML = `
            <section class="category-section">
              <div class="packages-grid">
                ${filtered.map(trip => createTripCardHTML(trip)).join('')}
              </div>
            </section>
          `;
        }
      }
    }

    // Attach Filter Listeners
    [catSelect, priceSelect, sortSelect].forEach(el => {
      if (el) el.addEventListener('change', applyFiltersAndRender);
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (catSelect) catSelect.value = 'all';
        if (priceSelect) priceSelect.value = 'all';
        if (sortSelect) sortSelect.value = 'default';
        applyFiltersAndRender();
      });
    }

    // Initial Filter Run
    applyFiltersAndRender();
    console.log('✅ [trips-loader] Filterable tour packages page initialized. Total trips:', trips.length);
  }

  /**
   * Universal category matcher: checks category, title, route, tags, sub_package_options
   */
  function matchAny(trip, keywords) {
    const haystack = [
      trip.category || '',
      trip.title || '',
      trip.route || '',
      trip.sub_package_options || '',
      (Array.isArray(trip.tags) ? trip.tags.join(' ') : ''),
      trip.about_text || ''
    ].join(' ').toLowerCase();

    return keywords.some(kw => haystack.includes(kw.toLowerCase()));
  }

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

  function createTripCardHTML(trip) {
    const detailUrl = (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.buildSeoTripUrl) 
      ? window.AwaraDB.buildSeoTripUrl(trip) 
      : (trip.id ? 'trip-detail.html?id=' + trip.id : (trip.link || 'trip-detail.html'));
    const rawImg = trip.image_url || trip.image || 'assets/images/placeholder-card-1.svg';
    const imgUrl = rawImg;
    const priceDisplay = formatPrice(trip.price);

    const priceHTML = (priceDisplay === 'On Request')
      ? '<span><span class="price-label">Price</span><span class="price">On Request</span></span>'
      : '<span><span class="price-label">Starts from</span><span class="price">' + priceDisplay + '</span></span>';

    return '<article class="trip-card">' +
      '<div class="thumb">' +
        '<a href="' + detailUrl + '">' +
          '<img src="' + imgUrl + '" alt="' + (trip.title || 'Trip') + '" loading="lazy" decoding="async" onerror="handleImageLoadError(this)">' +
        '</a>' +
      '</div>' +
      '<div class="body">' +
        '<h3><a href="' + detailUrl + '" style="color:inherit; text-decoration:none;">' + (trip.title || 'Untitled Trip') + '</a></h3>' +
        '<div class="meta"><svg><use href="#icon-clock"/></svg> ' + (trip.duration || '') + '</div>' +
        '<hr>' +
        '<div class="price-row">' +
          priceHTML +
          '<a href="' + detailUrl + '" class="btn btn-dark btn-sm">Book Now</a>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function createComingSoonHTML(description) {
    return '<div class="coming-soon-card" style="grid-column: 1 / -1; width: 100%; background: #fafaf7; border: 2px dashed #e0e0d8; border-radius: 16px; padding: 36px 24px; text-align: center; margin: 8px 0 20px 0;">' +
      '<div style="font-size: 32px; margin-bottom: 8px;">✨</div>' +
      '<h3 style="font-size: 20px; font-weight: 800; color: #14140f; margin-bottom: 6px; letter-spacing: -0.02em;">Coming Soon</h3>' +
      '<p style="font-size: 14px; color: #666; margin: 0; max-width: 460px; margin: 0 auto;">' + description + ' are being prepared and will be available shortly.</p>' +
    '</div>';
  }

  // Expose globally
  window.loadTrips = loadTrips;
  window.addEventListener('awaraCmsUpdated', function () {
    loadTrips(true);
  });
  window.handleImageLoadError = function(img) {
    var currentSrc = img.src;
    if (!img.dataset.triedFix) {
      img.dataset.triedFix = 'true';
      if (currentSrc.endsWith('.jpg')) { img.src = currentSrc.replace(/\.jpg$/, '.jpeg'); return; }
      if (currentSrc.endsWith('.jpeg')) { img.src = currentSrc.replace(/\.jpeg$/, '.jpg'); return; }
    }
    img.onerror = null;
    img.src = 'assets/images/placeholder-card-1.svg';
  };
})();
