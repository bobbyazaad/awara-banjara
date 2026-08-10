// =========================================================
// Dynamic Customer Reviews Page & Home Page Loader
// Exact screenshot design: Initial Letter Avatars, Working Booked Trip Links, Rating & Relative Dates
// Renders seamlessly on both reviews.html and index.html (#homeReviewsContainer)
// =========================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReviewsPage);
} else {
  initReviewsPage();
}

let _allReviews = [
  {
    "id": "rev_201",
    "customer_name": "Heli Shah",
    "trip_tag": "private",
    "trip_name": "Spiti Full Summer Circuit",
    "trip_url": "trips/spiti-tours-spiti-full-summer-circuit-106.html",
    "rating": 5,
    "date_text": "1 month ago",
    "review_text": "",
    "avatar_url": "",
    "featured": true
  },
  {
    "id": "rev_202",
    "customer_name": "Jainy Gandhi",
    "trip_tag": "private",
    "trip_name": "Spiti Highland Circuit Group Trip",
    "trip_url": "trips/spiti-tours-spiti-the-highland-circuit-group-trip-111.html",
    "rating": 5,
    "date_text": "1 month ago",
    "review_text": "My bucketlist trip just got ticked. So happy to complete it with Awara Banjara experiences, everything was very well managed and the views from homestays were 10/10. Chandra Taal lake was breathtaking!",
    "avatar_url": "assets/images/reviews/pfp-ananya.jpg",
    "featured": true
  },
  {
    "id": "rev_203",
    "customer_name": "Divya mehta",
    "trip_tag": "private",
    "trip_name": "Escape to Zanskar Group Trip",
    "trip_url": "trips/ladakh-tours-escape-to-zanskar-group-trip-105.html",
    "rating": 5,
    "date_text": "1 month ago",
    "review_text": "I would like to express my sincere appreciation to the Awara Banjara team for their excellent support and guidance throughout the travel process. They were professional, responsive, supportive...",
    "avatar_url": "",
    "featured": true
  },
  {
    "id": "rev_204",
    "customer_name": "Dhruvi Shah",
    "trip_tag": "private",
    "trip_name": "Spiti Winter 4x4 Expedition",
    "trip_url": "trips/spiti-tours-spiti-winter-4x4-expedition-103.html",
    "rating": 5,
    "date_text": "1 month ago",
    "review_text": "The spiti valley road trip with Awara Banjara was very good. It was my first ever solo trip but it did not feel like one as everyone in the group was very welcoming and hospitable...",
    "avatar_url": "",
    "featured": true
  },
  {
    "id": "rev_205",
    "customer_name": "Dabhi Mann",
    "trip_tag": "private",
    "trip_name": "Bir Billing Paragliding & Valley Escape",
    "trip_url": "trips/himachal-tours-bir-billing-escape-paragliding-rajgundha-valley-prashar-lake-120.html",
    "rating": 5,
    "date_text": "1 month ago",
    "review_text": "Bir was peaceful and the homestay felt like home-cooked comfort food after long days of paragliding and valley walks. Fantastic trip leads!",
    "avatar_url": "",
    "featured": true
  },
  {
    "id": "rev_206",
    "customer_name": "RIYA JAYESH GADA",
    "trip_tag": "private",
    "trip_name": "Kashmir Great Lakes Trek",
    "trip_url": "trips/kashmir-tours-kashmir-great-lakes-trek-107.html",
    "rating": 5,
    "date_text": "1 month ago",
    "review_text": "Trekking through the 7 alpine lakes in Kashmir was pure magic! Everything was seamless, safe, and exceptionally organized.",
    "avatar_url": "",
    "featured": true
  },
  {
    "id": "rev_207",
    "customer_name": "Ananya Sharma",
    "trip_tag": "bike",
    "trip_name": "Zanskar Moto Passage",
    "trip_url": "trips/ladakh-tours-zanskar-moto-passage-the-monolith-circuit-100.html",
    "rating": 5,
    "date_text": "2 weeks ago",
    "review_text": "The whole Zanskar trip was handled beautifully — great riders, warm homestays and a trip leader who knew every turn of the route. Unforgettable Himalayan experience!",
    "avatar_url": "assets/images/reviews/pfp-ananya.jpg",
    "featured": true
  },
  {
    "id": "rev_208",
    "customer_name": "Karan Mehta",
    "trip_tag": "bike",
    "trip_name": "Spiti Circuit Moto Expedition",
    "trip_url": "trips/spiti-tours-spiti-circuit-chandratal-lake-moto-expedition-116.html",
    "rating": 5,
    "date_text": "3 weeks ago",
    "review_text": "Best stay for anyone looking for a quiet, beautiful getaway — the whole crew knew the mountains and valleys inside out.",
    "avatar_url": "assets/images/reviews/pfp-karan.jpg",
    "featured": true
  }
];

let _allTrips = [];

function initReviewsPage() {
  const searchInput = document.getElementById('reviewSearchInput');
  const categorySelect = document.getElementById('filterCategory');

  // STEP 1: INSTANT HYDRATION (0ms Initial Render!)
  try {
    const cached = localStorage.getItem('awara_reviews_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _allReviews = parsed;
      }
    }
  } catch (e) {}

  // Render INSTANTLY on home page & reviews page without waiting for network calls!
  filterAndRender();

  // STEP 2: ATTACH LISTENERS
  if (searchInput) {
    searchInput.addEventListener('input', filterAndRender);
  }
  if (categorySelect) {
    categorySelect.addEventListener('change', filterAndRender);
  }

  // STEP 3: BACKGROUND NON-BLOCKING SWR REVALIDATION
  setTimeout(async () => {
    // Fetch trips in background for url resolving
    if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.getTrips) {
      try { _allTrips = await window.AwaraDB.getTrips(false); } catch (e) {}
    }

    // Fetch fresh reviews from DB in background
    if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.getReviews) {
      try {
        const freshReviews = await window.AwaraDB.getReviews(false);
        if (freshReviews && freshReviews.length > 0) {
          _allReviews = freshReviews;
          filterAndRender();
        }
      } catch (e) {}
    }
  }, 50);

  function filterAndRender() {
    const selectedCategory = categorySelect ? categorySelect.value.toLowerCase() : 'all';
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = _allReviews.filter(rev => {
      // Category Filter
      if (selectedCategory !== 'all') {
        const tripName = (rev.trip_name || '').toLowerCase();
        const revCategory = (rev.category || '').toLowerCase();
        
        let matchesCat = false;
        if (revCategory && revCategory.includes(selectedCategory)) {
          matchesCat = true;
        } else if (selectedCategory === 'spiti' && (tripName.includes('spiti') || tripName.includes('pin valley') || tripName.includes('kaza'))) {
          matchesCat = true;
        } else if (selectedCategory === 'ladakh' && (tripName.includes('ladakh') || tripName.includes('zanskar') || tripName.includes('leh') || tripName.includes('umling'))) {
          matchesCat = true;
        } else if (selectedCategory === 'kashmir' && (tripName.includes('kashmir') || tripName.includes('srinagar') || tripName.includes('gulmarg') || tripName.includes('pahal'))) {
          matchesCat = true;
        } else if (selectedCategory === 'himachal' && (tripName.includes('himachal') || tripName.includes('manali') || tripName.includes('kasol') || tripName.includes('bir') || tripName.includes('jibhi'))) {
          matchesCat = true;
        } else if (selectedCategory === 'uttarakhand' && (tripName.includes('uttarakhand') || tripName.includes('kedarkantha') || tripName.includes('chopta') || tripName.includes('auli'))) {
          matchesCat = true;
        } else if (selectedCategory === 'rajasthan' && (tripName.includes('rajasthan') || tripName.includes('udaipur') || tripName.includes('jaisalmer'))) {
          matchesCat = true;
        } else if (selectedCategory === 'northeast' && (tripName.includes('meghalaya') || tripName.includes('ziro') || tripName.includes('arunachal') || tripName.includes('kaziranga'))) {
          matchesCat = true;
        } else if (selectedCategory === 'bike' && (tripName.includes('bike') || tripName.includes('moto') || tripName.includes('circuit') || tripName.includes('expedition'))) {
          matchesCat = true;
        } else if (selectedCategory === 'trek' && (tripName.includes('trek') || tripName.includes('pass') || tripName.includes('ghati'))) {
          matchesCat = true;
        } else if (selectedCategory === 'women' && (tripName.includes('women') || tripName.includes('girls'))) {
          matchesCat = true;
        }

        if (!matchesCat) return false;
      }

      // Text Query Filter
      if (query) {
        const nameMatch = (rev.customer_name || '').toLowerCase().includes(query);
        const tripMatch = (rev.trip_name || '').toLowerCase().includes(query);
        const textMatch = (rev.review_text || '').toLowerCase().includes(query);
        if (!nameMatch && !tripMatch && !textMatch) return false;
      }

      return true;
    });

    renderReviewsGrid(filtered);
  }
}

window.addEventListener('awaraCmsUpdated', async function() {
  if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.getReviews) {
    try {
      const freshReviews = await window.AwaraDB.getReviews(true);
      if (freshReviews && freshReviews.length > 0) {
        _allReviews = freshReviews;
        initReviewsPage();
      }
    } catch (e) {}
  }
});

function resolveReviewTripUrl(rev) {
  if (rev.trip_url && rev.trip_url.trim() && rev.trip_url.includes('trips/')) {
    return rev.trip_url.trim();
  }

  const tripName = (rev.trip_name || '').toLowerCase().trim();
  const tripId = rev.trip_id;

  if (tripId && _allTrips.length > 0) {
    const match = _allTrips.find(t => String(t.id) === String(tripId));
    if (match && window.AwaraDB) {
      return window.AwaraDB.buildSeoTripUrl(match);
    }
  }

  if (tripName && _allTrips.length > 0) {
    const match = _allTrips.find(t => {
      const tTitle = (t.title || '').toLowerCase();
      return tTitle.includes(tripName) || tripName.includes(tTitle) ||
             (tripName.includes('bir') && tTitle.includes('bir')) ||
             (tripName.includes('zanskar') && tTitle.includes('zanskar')) ||
             (tripName.includes('spiti') && tTitle.includes('spiti')) ||
             (tripName.includes('kashmir') && tTitle.includes('kashmir')) ||
             (tripName.includes('kasol') && tTitle.includes('kasol')) ||
             (tripName.includes('meghalaya') && tTitle.includes('meghalaya'));
    });
    if (match && window.AwaraDB) {
      return window.AwaraDB.buildSeoTripUrl(match);
    }
  }

  return 'tour-packages.html';
}

function getInitialAvatar(name) {
  if (!name) return { initial: 'A', bg: '#0284c7' };
  const initial = name.trim().charAt(0).toUpperCase();
  const colors = ['#5c4033', '#0284c7', '#0d9488', '#7c3aed', '#e11d48', '#d97706'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  return { initial, bg: colors[colorIndex] };
}

window.getInitialAvatarHtml = function(name) {
  const { initial, bg } = getInitialAvatar(name);
  return `<div class="avatar-circle-initial" style="background-color: ${bg};">${initial}</div>`;
};

function renderReviewsGrid(reviews) {
  const containers = [
    document.getElementById('reviewsGridContainer'),
    document.getElementById('homeReviewsContainer')
  ].filter(Boolean);

  if (containers.length === 0) return;

  containers.forEach(container => {
    // Filter out empty/invalid reviews defensively
    let validReviews = (reviews || []).filter(r => r && r.customer_name && r.review_text && r.review_text.trim().length > 0);

    // If it's the home page container, show top 4 reviews (clean 2-column layout)
    let targetReviews = validReviews;
    if (container.id === 'homeReviewsContainer' && validReviews.length > 4) {
      targetReviews = validReviews.slice(0, 4);
    }

    if (!targetReviews || targetReviews.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center py-5" style="grid-column: 1 / -1; background: #fff; padding: 50px 20px; border-radius: 16px; border: 1px solid #e0e0d8; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
          <h3 style="font-size: 20px; font-weight: 800; color: #14140f; margin-bottom: 8px;">No Reviews Found</h3>
          <p style="color: #666; font-size: 14px;">Try selecting "All Categories" or clearing your search keywords.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = targetReviews.map((rev) => {
      const rating = parseInt(rev.rating, 10) || 5;
      
      let starSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#facc15"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
      let starsHtml = `<div class="stars">${starSvg.repeat(rating)}</div>`;

      let avatarHtml = '';
      if (rev.avatar_url && rev.avatar_url.trim() && !rev.avatar_url.includes('placeholder')) {
        const safeName = (rev.customer_name || 'Traveler').replace(/'/g, "\\'");
        avatarHtml = `<img src="${rev.avatar_url.trim()}" alt="${rev.customer_name}" class="rev-avatar-img" onerror="this.outerHTML=getInitialAvatarHtml('${safeName}');">`;
      } else {
        const { initial, bg } = getInitialAvatar(rev.customer_name);
        avatarHtml = `<div class="avatar-circle-initial" style="background-color: ${bg};">${initial}</div>`;
      }
      
      const tripTag = rev.trip_tag || 'private';
      const tripName = rev.trip_name || 'Spiti Valley from Ahmedabad';
      const tripUrl = resolveReviewTripUrl(rev);
      const dateText = rev.date_text || '1 month ago';

      let reviewTextHtml = '';
      if (rev.review_text && rev.review_text.trim()) {
        let text = rev.review_text.trim();
        let hasReadMore = false;
        if (text.length > 180) {
          text = text.substring(0, 180) + '...';
          hasReadMore = true;
        }
        reviewTextHtml = `
          <p class="rev-quote-body">${text}${hasReadMore ? ' <span class="read-more">Read More</span>' : ''}</p>
        `;
      }

      return `
        <article class="review-card-modern">
          <div class="rev-card-header">
            ${avatarHtml}
            <div class="rev-header-info">
              <div class="rev-author-name-row">
                <strong class="rev-author-name">${rev.customer_name}</strong>
                <span class="rev-trip-tag">${tripTag}</span>
              </div>
              <div class="rev-booked-row">
                <span class="booked-label">Booked:</span>
                <a href="${tripUrl}" class="booked-trip-link"><strong>${tripName}</strong> <span class="arrow">↗</span></a>
              </div>
            </div>
          </div>

          <div class="rev-rating-date-row">
            ${starsHtml}
            <span class="rev-date-text">${dateText}</span>
          </div>

          ${reviewTextHtml}
        </article>
      `;
    }).join('');
  });
}
