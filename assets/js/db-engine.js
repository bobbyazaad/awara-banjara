// =========================================================
// AwaraBanjara — Unified Data Engine v6.0
// Connects to Express REST API (/api/*) when server is running,
// with seamless fallback to static JSON / localStorage.
// =========================================================

(function (window) {
  'use strict';

  let inMemoryTrips = null;
  let inMemoryDestinations = null;
  let inMemoryReviews = null;
  let inMemoryPostcards = null;
  let inMemorySiteConfig = null;

  function notifyCmsUpdate() {
    inMemoryTrips = null;
    inMemoryDestinations = null;
    inMemoryReviews = null;
    inMemoryPostcards = null;
    inMemorySiteConfig = null;
    try {
      localStorage.removeItem('awara_trips_cache');
      localStorage.removeItem('awara_destinations');
      localStorage.removeItem('awara_reviews_cache');
      localStorage.removeItem('awara_postcards_cache');
      localStorage.removeItem('awara_site_config_cache');
      localStorage.setItem('awara_cms_update_signal', Date.now().toString());
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('awaraCmsUpdated'));
    } catch (err) {}
  }

  function getBasePath() {
    const isSubfolder = window.location.pathname.includes('/trips/');
    return isSubfolder ? '../' : '';
  }

  // Get API Base URL. The site is deployed as a single Render service that serves both
  // the static pages and the /api/* routes from the same origin, so a same-origin relative
  // path always works and never goes stale if the Render service is ever renamed/redeployed
  // under a different URL. window.AWARA_API_URL / localStorage overrides are still honored
  // for local testing against a different backend.
  function getApiBaseUrl() {
    if (window.AWARA_API_URL) return window.AWARA_API_URL.replace(/\/$/, '');
    try {
      const saved = localStorage.getItem('awara_api_url');
      if (saved) return saved.replace(/\/$/, '');
    } catch (e) {}

    const basePath = getBasePath();
    return `${basePath}api`;
  }

  function getApiUrl(endpoint) {
    const base = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return `${base}${cleanEndpoint}`;
  }
  window.getAwaraApiUrl = getApiUrl;

  function getAuthHeaders(customHeaders = {}) {
    const token = localStorage.getItem('awara_admin_token');
    const headers = { ...customHeaders };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  const AwaraDB = {
    /**
     * Fetch All Tour Packages & Trip Itineraries
     */
    async getTrips(forceRefresh = false) {
      const isLocallyModified = localStorage.getItem('awara_trips_modified') === 'true';

      // 1. Try Express REST API
      try {
        const res = await fetch(getApiUrl(`/trips?includeInactive=true&_t=${Date.now()}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            if (!isLocallyModified || forceRefresh) {
              inMemoryTrips = json.data;
              try { localStorage.setItem('awara_trips_cache', JSON.stringify(json.data)); } catch (e) {}
              if (forceRefresh) localStorage.removeItem('awara_trips_modified');
            }
            return (isLocallyModified && !forceRefresh && inMemoryTrips && inMemoryTrips.length > 0) ? inMemoryTrips : json.data;
          }
        }
      } catch (err) {}

      if (!forceRefresh && inMemoryTrips && inMemoryTrips.length > 0) {
        return inMemoryTrips;
      }

      // 2. Check localStorage cache
      try {
        const stored = localStorage.getItem('awara_trips_cache');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            inMemoryTrips = parsed;
            return inMemoryTrips;
          }
        }
      } catch (e) {}

      // 3. Fallback to static JSON file
      try {
        const basePath = getBasePath();
        const res = await fetch(`${basePath}data/trips.json?_t=${Date.now()}`);
        if (res.ok) {
          const jsonTrips = await res.json();
          if (Array.isArray(jsonTrips) && jsonTrips.length > 0) {
            if (!isLocallyModified) {
              inMemoryTrips = jsonTrips;
              try { localStorage.setItem('awara_trips_cache', JSON.stringify(jsonTrips)); } catch (e) {}
            }
            return (isLocallyModified && !forceRefresh && inMemoryTrips && inMemoryTrips.length > 0) ? inMemoryTrips : jsonTrips;
          }
        }
      } catch (err) {}

      return inMemoryTrips || [];
    },

    /**
     * Helper to slugify text string for SEO clean URLs
     */
    slugify(text) {
      if (!text || typeof text !== 'string') return '';
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    },

    /**
     * Helper to derive primary category slug
     */
    getCategorySlug(category) {
      if (!category || typeof category !== 'string') return 'group-tours';
      const firstCat = category.split(',')[0].trim();
      let cleanCat = firstCat.replace(/_tours$/i, ' tours').replace(/_/g, ' ');
      return this.slugify(cleanCat) || 'group-tours';
    },

    /**
     * Construct SEO-optimized trip detail URL
     */
    buildSeoTripUrl(trip) {
      if (!trip) return 'trip-detail';
      const tripId = trip.id;
      const catSlug = this.getCategorySlug(trip.category);
      const titleSlug = this.slugify(trip.title) || 'himalayan-expedition';

      if (tripId) {
        return `trips/${catSlug}-${titleSlug}-${tripId}`;
      }
      return `trip-detail?category=${encodeURIComponent(catSlug)}&trip=${encodeURIComponent(titleSlug)}`;
    },

    /**
     * Fetch single trip by ID, Title, or Slug
     */
    async getTripById(idOrSlug) {
      if (!idOrSlug) return null;
      const targetStr = String(idOrSlug).toLowerCase().trim();

      // Try API first
      try {
        const res = await fetch(getApiUrl(`/trips/${encodeURIComponent(targetStr)}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) return json.data;
        }
      } catch (err) {}

      const trips = await this.getTrips(false);

      // 1. Match by ID
      let found = trips.find(t => String(t.id) === targetStr);
      if (found) return found;

      // 2. Match by exact or partial title slug
      const slugTarget = this.slugify(targetStr);
      found = trips.find(t => {
        const titleSlug = this.slugify(t.title);
        return titleSlug === slugTarget || titleSlug.includes(slugTarget) || slugTarget.includes(titleSlug);
      });
      if (found) return found;

      // 3. Fallback: match by title text
      found = trips.find(t => 
        (t.title && t.title.toLowerCase().includes(targetStr))
      );

      return found || null;
    },

    /**
     * Save or Update a trip itinerary
     */
    async saveTrip(payload) {
      if (!payload.id) {
        payload.id = Date.now();
      }
      if (typeof this.buildSeoTripUrl === 'function') {
        payload.link = this.buildSeoTripUrl(payload);
      }

      // 1. Update local state & cache first to ensure immediate responsiveness
      let trips = inMemoryTrips && inMemoryTrips.length > 0 ? [...inMemoryTrips] : [];
      if (trips.length === 0) {
        try {
          const cached = localStorage.getItem('awara_trips_cache');
          if (cached) trips = JSON.parse(cached);
        } catch (e) {}
      }

      const existingIdx = trips.findIndex(t => String(t.id) === String(payload.id));
      if (existingIdx >= 0) {
        trips[existingIdx] = { ...trips[existingIdx], ...payload };
      } else {
        trips.unshift(payload);
      }

      inMemoryTrips = trips;
      try {
        localStorage.setItem('awara_trips_cache', JSON.stringify(trips));
        localStorage.setItem('awara_trips_modified', 'true');
      } catch (e) {}
      notifyCmsUpdate();

      // 2. Try REST API server sync
      try {
        const res = await fetch(getApiUrl('/trips'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.success) {
          localStorage.removeItem('awara_trips_modified');
          await this.getTrips(true);
          return json;
        }
        const error = (json && json.error) || (res.status === 401
          ? 'Your admin session has expired. Please log out and log back in, then try saving again.'
          : `Server rejected the save (HTTP ${res.status}).`);
        return { success: false, error, localOnly: true, authExpired: res.status === 401, data: [payload] };
      } catch (err) {
        // Genuinely unreachable backend (offline / static hosting) — keep the optimistic local save
        return { success: true, offline: true, data: [payload] };
      }
    },

    /**
     * Delete a trip itinerary by ID
     */
    async deleteTrip(id) {
      // 1. Update local state & cache first
      let trips = inMemoryTrips && inMemoryTrips.length > 0 ? [...inMemoryTrips] : [];
      if (trips.length === 0) {
        try {
          const cached = localStorage.getItem('awara_trips_cache');
          if (cached) trips = JSON.parse(cached);
        } catch (e) {}
      }
      trips = trips.filter(t => String(t.id) !== String(id));
      inMemoryTrips = trips;
      try {
        localStorage.setItem('awara_trips_cache', JSON.stringify(trips));
        localStorage.setItem('awara_trips_modified', 'true');
      } catch (e) {}
      notifyCmsUpdate();

      // 2. Try REST API server sync
      try {
        const res = await fetch(getApiUrl(`/trips/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.success) {
          localStorage.removeItem('awara_trips_modified');
          await this.getTrips(true);
          return json;
        }
        const error = (json && json.error) || (res.status === 401
          ? 'Your admin session has expired. Please log out and log back in, then try deleting again.'
          : `Server rejected the delete (HTTP ${res.status}).`);
        return { success: false, error, localOnly: true, authExpired: res.status === 401 };
      } catch (err) {
        return { success: true, offline: true };
      }
    },

    /**
     * Fetch Home Destinations (Domestic & International)
     */
    async getDestinations(forceRefresh = false) {
      const isLocallyModified = localStorage.getItem('awara_destinations_modified') === 'true';

      // Try REST API
      try {
        const res = await fetch(getApiUrl(`/destinations?_t=${Date.now()}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            if (!isLocallyModified || forceRefresh) {
              inMemoryDestinations = json.data;
              try { localStorage.setItem('awara_destinations', JSON.stringify(json.data)); } catch (e) {}
              if (forceRefresh) localStorage.removeItem('awara_destinations_modified');
            }
            return (isLocallyModified && !forceRefresh && inMemoryDestinations && inMemoryDestinations.length > 0) ? inMemoryDestinations : json.data;
          }
        }
      } catch (err) {}

      if (!forceRefresh && inMemoryDestinations && inMemoryDestinations.length > 0) {
        return inMemoryDestinations;
      }

      // Check localStorage
      try {
        const stored = localStorage.getItem('awara_destinations');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            inMemoryDestinations = parsed;
            return inMemoryDestinations;
          }
        }
      } catch (e) {}

      // Fallback to static JSON
      try {
        const basePath = getBasePath();
        const res = await fetch(`${basePath}data/destinations.json?_t=${Date.now()}`);
        if (res.ok) {
          const jsonDests = await res.json();
          if (Array.isArray(jsonDests) && jsonDests.length > 0) {
            if (!isLocallyModified) {
              inMemoryDestinations = jsonDests;
              try { localStorage.setItem('awara_destinations', JSON.stringify(jsonDests)); } catch (e) {}
            }
            return (isLocallyModified && !forceRefresh && inMemoryDestinations && inMemoryDestinations.length > 0) ? inMemoryDestinations : jsonDests;
          }
        }
      } catch (err) {}

      return inMemoryDestinations || [];
    },

    /**
     * Save / Update Home Destination Card
     */
    async saveDestination(destPayload) {
      if (!destPayload.id) {
        destPayload.id = `dest_${Date.now()}`;
      }

      let allDests = inMemoryDestinations && inMemoryDestinations.length > 0 ? [...inMemoryDestinations] : [];
      if (allDests.length === 0) {
        try {
          const stored = localStorage.getItem('awara_destinations');
          if (stored) allDests = JSON.parse(stored);
        } catch (e) {}
      }

      const existingIdx = allDests.findIndex(d => String(d.id) === String(destPayload.id));
      if (existingIdx >= 0) {
        allDests[existingIdx] = { ...allDests[existingIdx], ...destPayload };
      } else {
        allDests.push(destPayload);
      }
      inMemoryDestinations = allDests;
      try {
        localStorage.setItem('awara_destinations', JSON.stringify(allDests));
        localStorage.setItem('awara_destinations_modified', 'true');
      } catch (e) {}
      notifyCmsUpdate();

      try {
        const res = await fetch(getApiUrl('/destinations'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(destPayload)
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.success) {
          localStorage.removeItem('awara_destinations_modified');
          await this.getDestinations(true);
          return json;
        }
        const error = (json && json.error) || (res.status === 401
          ? 'Your admin session has expired. Please log out and log back in, then try saving again.'
          : `Server rejected the save (HTTP ${res.status}).`);
        return { success: false, error, localOnly: true, authExpired: res.status === 401, data: destPayload };
      } catch (err) {
        return { success: true, offline: true, data: destPayload };
      }
    },

    /**
     * Delete Home Destination Card
     */
    async deleteDestination(id) {
      let dests = inMemoryDestinations && inMemoryDestinations.length > 0 ? [...inMemoryDestinations] : [];
      if (dests.length === 0) {
        try {
          const stored = localStorage.getItem('awara_destinations');
          if (stored) dests = JSON.parse(stored);
        } catch (e) {}
      }
      dests = dests.filter(d => String(d.id) !== String(id));
      inMemoryDestinations = dests;
      try {
        localStorage.setItem('awara_destinations', JSON.stringify(dests));
        localStorage.setItem('awara_destinations_modified', 'true');
      } catch (e) {}
      notifyCmsUpdate();

      try {
        const res = await fetch(getApiUrl(`/destinations/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.success) {
          localStorage.removeItem('awara_destinations_modified');
          await this.getDestinations(true);
          return json;
        }
        const error = (json && json.error) || (res.status === 401
          ? 'Your admin session has expired. Please log out and log back in, then try deleting again.'
          : `Server rejected the delete (HTTP ${res.status}).`);
        return { success: false, error, localOnly: true, authExpired: res.status === 401 };
      } catch (err) {
        return { success: true, offline: true };
      }
    },

    /**
     * Delete Review
     */
    async deleteReview(id) {
      let reviews = inMemoryReviews && inMemoryReviews.length > 0 ? [...inMemoryReviews] : [];
      if (reviews.length === 0) {
        try {
          const stored = localStorage.getItem('awara_reviews_cache');
          if (stored) reviews = JSON.parse(stored);
        } catch (e) {}
      }
      reviews = reviews.filter(r => String(r.id) !== String(id));
      inMemoryReviews = reviews;
      try {
        localStorage.setItem('awara_reviews_cache', JSON.stringify(reviews));
        localStorage.setItem('awara_reviews_modified', 'true');
      } catch (e) {}
      notifyCmsUpdate();

      try {
        const res = await fetch(getApiUrl(`/reviews/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.success) {
          localStorage.removeItem('awara_reviews_modified');
          await this.getReviews(true);
          return json;
        }
        const error = (json && json.error) || (res.status === 401
          ? 'Your admin session has expired. Please log out and log back in, then try deleting again.'
          : `Server rejected the delete (HTTP ${res.status}).`);
        return { success: false, error, localOnly: true, authExpired: res.status === 401 };
      } catch (err) {
        return { success: true, offline: true };
      }
    },

    /**
     * Fetch Customer Reviews
     */
    async getReviews(forceRefresh = false) {
      const isLocallyModified = localStorage.getItem('awara_reviews_modified') === 'true';

      // Try REST API
      try {
        const res = await fetch(getApiUrl(`/reviews?_t=${Date.now()}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            if (!isLocallyModified) {
              inMemoryReviews = json.data;
              try { localStorage.setItem('awara_reviews_cache', JSON.stringify(json.data)); } catch (e) {}
            }
            return (isLocallyModified && inMemoryReviews && inMemoryReviews.length > 0) ? inMemoryReviews : json.data;
          }
        }
      } catch (err) {}

      if (!forceRefresh && inMemoryReviews && inMemoryReviews.length > 0) {
        return inMemoryReviews;
      }

      // Check localStorage
      try {
        const stored = localStorage.getItem('awara_reviews_cache');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            inMemoryReviews = parsed;
            return inMemoryReviews;
          }
        }
      } catch (e) {}

      // Fallback to static JSON
      try {
        const basePath = getBasePath();
        const res = await fetch(`${basePath}data/reviews.json?_t=${Date.now()}`);
        if (res.ok) {
          const jsonReviews = await res.json();
          if (Array.isArray(jsonReviews) && jsonReviews.length > 0) {
            if (!isLocallyModified) {
              inMemoryReviews = jsonReviews;
              try { localStorage.setItem('awara_reviews_cache', JSON.stringify(jsonReviews)); } catch (e) {}
            }
            return (isLocallyModified && inMemoryReviews && inMemoryReviews.length > 0) ? inMemoryReviews : jsonReviews;
          }
        }
      } catch (err) {}

      return inMemoryReviews || [];
    },

    /**
     * Save Customer Review
     */
    async saveReview(reviewData) {
      if (!reviewData.id) {
        reviewData.id = 'rev_' + Date.now();
      }

      let reviews = inMemoryReviews && inMemoryReviews.length > 0 ? [...inMemoryReviews] : [];
      if (reviews.length === 0) {
        try {
          const stored = localStorage.getItem('awara_reviews_cache');
          if (stored) reviews = JSON.parse(stored);
        } catch (e) {}
      }

      const existingIdx = reviews.findIndex(r => String(r.id) === String(reviewData.id));
      if (existingIdx >= 0) {
        reviews[existingIdx] = { ...reviews[existingIdx], ...reviewData };
      } else {
        reviews.unshift(reviewData);
      }
      inMemoryReviews = reviews;

      try {
        localStorage.setItem('awara_reviews_cache', JSON.stringify(reviews));
        localStorage.setItem('awara_reviews_modified', 'true');
      } catch (e) {}
      notifyCmsUpdate();

      try {
        const res = await fetch(getApiUrl('/reviews'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(reviewData)
        });
        const json = await res.json().catch(() => null);
        // The server returns the single saved review object (`data`), not the full
        // list — a previous fix here incorrectly required Array.isArray(json.data),
        // which is never true for this endpoint, so every save was misreported as failed.
        if (res.ok && json && json.success && json.data) {
          const savedReview = json.data;
          const idx = reviews.findIndex(r => String(r.id) === String(savedReview.id));
          if (idx >= 0) reviews[idx] = savedReview; else reviews.unshift(savedReview);
          inMemoryReviews = reviews;
          try {
            localStorage.setItem('awara_reviews_cache', JSON.stringify(reviews));
            localStorage.removeItem('awara_reviews_modified');
          } catch (e) {}
          notifyCmsUpdate();
          return { success: true, data: savedReview };
        }
        const error = (json && json.error) || (res.status === 401
          ? 'Your admin session has expired. Please log out and log back in, then try saving again.'
          : `Server rejected the save (HTTP ${res.status}).`);
        return { success: false, error, localOnly: true, authExpired: res.status === 401, data: reviewData };
      } catch (err) {
        return { success: true, offline: true, data: reviewData };
      }
    },

    /**
     * Fetch All Postcards (Reels & Blogs)
     */
    async getPostcards(forceRefresh = false) {
      const isLocallyModified = localStorage.getItem('awara_postcards_modified') === 'true';

      // 1. Try Express REST API
      try {
        const res = await fetch(getApiUrl(`/postcards?_t=${Date.now()}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            if (!isLocallyModified || forceRefresh) {
              try { localStorage.setItem('awara_postcards_cache', JSON.stringify(json.data)); } catch (e) {}
              if (forceRefresh) localStorage.removeItem('awara_postcards_modified');
            }
            return (isLocallyModified && !forceRefresh) ? (JSON.parse(localStorage.getItem('awara_postcards_cache') || '[]') || json.data) : json.data;
          }
        }
      } catch (err) {}

      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem('awara_postcards_cache');
          if (cached) return JSON.parse(cached);
        } catch (e) {}
      }

      // 2. Fallback: load data/postcards.json
      try {
        const basePath = getBasePath();
        const res = await fetch(`${basePath}data/postcards.json?_t=${Date.now()}`);
        if (res.ok) {
          const jsonPostcards = await res.json();
          if (Array.isArray(jsonPostcards)) {
            if (!isLocallyModified) {
              try { localStorage.setItem('awara_postcards_cache', JSON.stringify(jsonPostcards)); } catch (e) {}
            }
            return (isLocallyModified && !forceRefresh) ? (JSON.parse(localStorage.getItem('awara_postcards_cache') || '[]') || jsonPostcards) : jsonPostcards;
          }
        }
      } catch (err) {}

      return [];
    },

    /**
     * Save/Update Postcard (Reel or Blog - Admin Panel)
     */
    async savePostcard(postcardPayload) {
      let postcards = [];
      try {
        postcards = JSON.parse(localStorage.getItem('awara_postcards_cache') || '[]');
      } catch (e) {}

      if (!postcardPayload.id) {
        postcardPayload.id = 'pc_' + Date.now();
      }

      const existingIdx = postcards.findIndex(p => String(p.id) === String(postcardPayload.id));
      if (existingIdx >= 0) {
        postcards[existingIdx] = { ...postcards[existingIdx], ...postcardPayload };
      } else {
        postcards.unshift(postcardPayload);
      }

      try {
        localStorage.setItem('awara_postcards_cache', JSON.stringify(postcards));
        localStorage.setItem('awara_postcards_modified', 'true');
      } catch (e) {}
      notifyCmsUpdate();

      try {
        const res = await fetch(getApiUrl('/postcards'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(postcardPayload)
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.success) {
          localStorage.removeItem('awara_postcards_modified');
          await this.getPostcards(true);
          return json;
        }
        const error = (json && json.error) || (res.status === 401
          ? 'Your admin session has expired. Please log out and log back in, then try saving again.'
          : `Server rejected the save (HTTP ${res.status}).`);
        return { success: false, error, localOnly: true, authExpired: res.status === 401, data: postcardPayload };
      } catch (err) {
        return { success: true, offline: true, data: postcardPayload };
      }
    },

    /**
     * Delete Postcard (Admin Panel)
     */
    async deletePostcard(id) {
      let postcards = [];
      try {
        postcards = JSON.parse(localStorage.getItem('awara_postcards_cache') || '[]');
      } catch (e) {}

      postcards = postcards.filter(p => String(p.id) !== String(id));
      try {
        localStorage.setItem('awara_postcards_cache', JSON.stringify(postcards));
        localStorage.setItem('awara_postcards_modified', 'true');
      } catch (e) {}
      notifyCmsUpdate();

      try {
        const res = await fetch(getApiUrl(`/postcards/${id}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.success) {
          localStorage.removeItem('awara_postcards_modified');
          await this.getPostcards(true);
          return json;
        }
        const error = (json && json.error) || (res.status === 401
          ? 'Your admin session has expired. Please log out and log back in, then try deleting again.'
          : `Server rejected the delete (HTTP ${res.status}).`);
        return { success: false, error, localOnly: true, authExpired: res.status === 401 };
      } catch (err) {
        return { success: true, offline: true };
      }
    },

    /**
     * Submit Customer Booking Inquiry / Lead (Public Endpoint)
     */
    async submitInquiry(inquiryPayload) {
      try {
        const res = await fetch(getApiUrl('/inquiries'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inquiryPayload)
        });
        if (res.ok) {
          const json = await res.json();
          return { success: true, serverSynced: true, data: json.data };
        }
      } catch (err) {}

      // Local fallback
      try {
        const localBookings = JSON.parse(localStorage.getItem('awara_local_bookings') || '[]');
        localBookings.unshift({ 
          ...inquiryPayload, 
          inquiry_id: inquiryPayload.inquiry_id || ('inq_' + Date.now()),
          timestamp: new Date().toISOString(),
          status: inquiryPayload.status || 'Pending'
        });
        localStorage.setItem('awara_local_bookings', JSON.stringify(localBookings));
      } catch (e) {}

      return { success: true, bufferedLocally: true };
    },

    /**
     * Fetch All Customer Inquiries (Admin Panel - Protected)
     */
    async getInquiries() {
      try {
        const res = await fetch(getApiUrl('/inquiries'), {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            return json.data;
          }
        }
      } catch (err) {}

      try {
        const localBookings = JSON.parse(localStorage.getItem('awara_local_bookings') || '[]');
        return localBookings;
      } catch (e) {
        return [];
      }
    },

    /**
     * Update Customer Inquiry Status (Admin Panel - Protected)
     */
    async updateInquiryStatus(inquiryId, newStatus) {
      try {
        const res = await fetch(getApiUrl(`/inquiries/${encodeURIComponent(inquiryId)}`), {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
          return { success: true };
        }
      } catch (err) {}

      try {
        let localBookings = JSON.parse(localStorage.getItem('awara_local_bookings') || '[]');
        const idx = localBookings.findIndex(b => String(b.inquiry_id || b.id) === String(inquiryId));
        if (idx >= 0) {
          localBookings[idx].status = newStatus;
          localStorage.setItem('awara_local_bookings', JSON.stringify(localBookings));
        }
      } catch (e) {}
      return { success: true };
    },

    /**
     * Delete Customer Inquiry (Admin Panel - Protected)
     */
    async deleteInquiry(inquiryId) {
      try {
        const res = await fetch(getApiUrl(`/inquiries/${encodeURIComponent(inquiryId)}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          return { success: true };
        }
      } catch (err) {}

      try {
        let localBookings = JSON.parse(localStorage.getItem('awara_local_bookings') || '[]');
        localBookings = localBookings.filter(b => String(b.inquiry_id || b.id) !== String(inquiryId));
        localStorage.setItem('awara_local_bookings', JSON.stringify(localBookings));
      } catch (e) {}
      return { success: true };
    },

    /**
     * Fetch Site Config
     */
    async getSiteConfig(forceRefresh = false) {
      if (!forceRefresh && inMemorySiteConfig) {
        return inMemorySiteConfig;
      }

      try {
        const res = await fetch(getApiUrl('/site-config'));
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            inMemorySiteConfig = json.data;
            return inMemorySiteConfig;
          }
        }
      } catch (err) {}

      let configMap = {};
      try {
        const basePath = getBasePath();
        const res = await fetch(`${basePath}data/site_config.json`);
        if (res.ok) {
          const jsonArr = await res.json();
          if (Array.isArray(jsonArr)) {
            jsonArr.forEach(item => { configMap[item.key] = item.value; });
          } else if (typeof jsonArr === 'object') {
            configMap = jsonArr;
          }
        }
      } catch (e) {}

      inMemorySiteConfig = configMap;
      return configMap;
    },

    /**
     * Invalidate all in-memory caches
     */
    invalidateCache() {
      inMemoryTrips = null;
      inMemoryDestinations = null;
      inMemoryReviews = null;
      inMemorySiteConfig = null;
      try {
        localStorage.removeItem('awara_trips_cache');
        localStorage.removeItem('awara_destinations');
        localStorage.removeItem('awara_reviews_cache');
      } catch (e) {}
    },

    /**
     * Export Complete JSON Bundle (For Admin Backup - Protected)
     */
    async exportAllDataJSON() {
      try {
        const res = await fetch(getApiUrl('/export'), {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}

      const trips = await this.getTrips(true);
      const destinations = await this.getDestinations(true);
      const reviews = await this.getReviews(true);
      const inquiries = await this.getInquiries();
      const site_config = await this.getSiteConfig(true);

      return {
        exported_at: new Date().toISOString(),
        trips,
        destinations,
        reviews,
        inquiries,
        site_config
      };
    },

    /**
     * Import JSON Bundle (For Admin Restore - Protected)
     */
    async importAllDataJSON(bundle) {
      if (!bundle || typeof bundle !== 'object') return false;

      try {
        const res = await fetch(getApiUrl('/import'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(bundle)
        });
        if (res.ok) {
          this.invalidateCache();
          return true;
        }
      } catch (e) {}

      if (Array.isArray(bundle.trips)) {
        localStorage.setItem('awara_trips_cache', JSON.stringify(bundle.trips));
      }
      if (Array.isArray(bundle.destinations)) {
        localStorage.setItem('awara_destinations', JSON.stringify(bundle.destinations));
      }
      if (Array.isArray(bundle.reviews)) {
        localStorage.setItem('awara_reviews_cache', JSON.stringify(bundle.reviews));
      }
      if (Array.isArray(bundle.inquiries)) {
        localStorage.setItem('awara_local_bookings', JSON.stringify(bundle.inquiries));
      }

      this.invalidateCache();
      return true;
    },

    getApiUrl(endpoint) {
      return getApiUrl(endpoint);
    },

    async uploadImage(filename, dataUrl) {
      try {
        const res = await fetch(getApiUrl('/upload'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ filename, dataUrl })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {}
      return { success: false };
    }
  };

  window.AwaraDB = AwaraDB;

  // ─── Cross-tab CMS sync ───────────────────────────────────────────────────
  // When the admin panel (open in a different browser tab) saves/deletes any
  // CMS item, db-engine.js writes `awara_cms_update_signal` to localStorage.
  // The `storage` event fires in every OTHER tab on the same origin, allowing
  // the website tab to automatically re-render without a page reload.
  window.addEventListener('storage', function (e) {
    if (e.key === 'awara_cms_update_signal') {
      try {
        window.dispatchEvent(new CustomEvent('awaraCmsUpdated'));
      } catch (_) {}
    }
  });
})(window);
