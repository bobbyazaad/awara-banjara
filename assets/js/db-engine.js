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

  // Get API Base URL (relative for localhost, Render URL for remote/GitHub Pages)
  function getApiBaseUrl() {
    if (window.AWARA_API_URL) return window.AWARA_API_URL.replace(/\/$/, '');
    try {
      const saved = localStorage.getItem('awara_api_url');
      if (saved) return saved.replace(/\/$/, '');
    } catch (e) {}

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      const basePath = getBasePath();
      return `${basePath}api`;
    }

    // Default live Render backend service
    return 'https://awara-banjara-api.onrender.com/api';
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
      // 1. Try Express REST API first with cache buster
      try {
        const res = await fetch(getApiUrl(`/trips?includeInactive=true&_t=${Date.now()}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            inMemoryTrips = json.data;
            try { localStorage.setItem('awara_trips_cache', JSON.stringify(json.data)); } catch (e) {}
            return inMemoryTrips;
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
            inMemoryTrips = jsonTrips;
            try { localStorage.setItem('awara_trips_cache', JSON.stringify(jsonTrips)); } catch (e) {}
            return inMemoryTrips;
          }
        }
      } catch (err) {}

      return [];
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
      if (!trip) return 'trip-detail.html';
      const tripId = trip.id;
      const catSlug = this.getCategorySlug(trip.category);
      const titleSlug = this.slugify(trip.title) || 'himalayan-expedition';

      if (tripId) {
        return `trips/${catSlug}-${titleSlug}-${tripId}.html`;
      }
      return `trip-detail.html?category=${encodeURIComponent(catSlug)}&trip=${encodeURIComponent(titleSlug)}`;
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

      // Try REST API
      try {
        const res = await fetch(getApiUrl('/trips'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            notifyCmsUpdate();
            await this.getTrips(true); // refresh cache
            return json;
          }
        }
      } catch (err) {}

      // Local fallback
      let trips = await this.getTrips(true);
      const existingIdx = trips.findIndex(t => String(t.id) === String(payload.id));
      if (existingIdx >= 0) {
        trips[existingIdx] = { ...trips[existingIdx], ...payload };
      } else {
        trips.unshift(payload);
      }

      inMemoryTrips = trips;
      notifyCmsUpdate();
      try { localStorage.setItem('awara_trips_cache', JSON.stringify(trips)); } catch (e) {}
      return { success: true, data: [payload] };
    },

    /**
     * Delete a trip itinerary by ID
     */
    async deleteTrip(id) {
      try {
        const res = await fetch(getApiUrl(`/trips/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          notifyCmsUpdate();
          await this.getTrips(true);
          return { success: true };
        }
      } catch (err) {}

      let trips = await this.getTrips(true);
      trips = trips.filter(t => String(t.id) !== String(id));
      inMemoryTrips = trips;
      notifyCmsUpdate();
      try { localStorage.setItem('awara_trips_cache', JSON.stringify(trips)); } catch (e) {}
      return { success: true };
    },

    /**
     * Fetch Home Destinations (Domestic & International)
     */
    async getDestinations(forceRefresh = false) {
      // 1. Try REST API first with cache buster
      try {
        const res = await fetch(getApiUrl(`/destinations?_t=${Date.now()}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            inMemoryDestinations = json.data;
            try { localStorage.setItem('awara_destinations', JSON.stringify(json.data)); } catch (e) {}
            return inMemoryDestinations;
          }
        }
      } catch (err) {}

      if (!forceRefresh && inMemoryDestinations && inMemoryDestinations.length > 0) {
        return inMemoryDestinations;
      }

      // 2. Check localStorage
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

      // 3. Fallback to static JSON file
      try {
        const basePath = getBasePath();
        const res = await fetch(`${basePath}data/destinations.json?_t=${Date.now()}`);
        if (res.ok) {
          const jsonDests = await res.json();
          if (Array.isArray(jsonDests) && jsonDests.length > 0) {
            inMemoryDestinations = jsonDests;
            try { localStorage.setItem('awara_destinations', JSON.stringify(jsonDests)); } catch (e) {}
            return inMemoryDestinations;
          }
        }
      } catch (err) {}

      return [];
    },

    /**
     * Save / Update Home Destination Card
     */
    async saveDestination(destPayload) {
      if (!destPayload.id) {
        destPayload.id = `dest_${Date.now()}`;
      }

      try {
        const res = await fetch(getApiUrl('/destinations'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(destPayload)
        });
        if (res.ok) {
          notifyCmsUpdate();
          await this.getDestinations(true);
          return { success: true };
        }
      } catch (err) {}

      let allDests = await this.getDestinations(true);
      const existingIdx = allDests.findIndex(d => String(d.id) === String(destPayload.id));
      if (existingIdx >= 0) {
        allDests[existingIdx] = { ...allDests[existingIdx], ...destPayload };
      } else {
        allDests.push(destPayload);
      }
      inMemoryDestinations = allDests;
      notifyCmsUpdate();
      try { localStorage.setItem('awara_destinations', JSON.stringify(allDests)); } catch (e) {}
      return { success: true };
    },

    /**
     * Delete Home Destination Card
     */
    async deleteDestination(id) {
      try {
        const res = await fetch(getApiUrl(`/destinations/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          notifyCmsUpdate();
          await this.getDestinations(true);
          return { success: true };
        }
      } catch (err) {}

      let dests = await this.getDestinations(true);
      dests = dests.filter(d => String(d.id) !== String(id));
      inMemoryDestinations = dests;
      notifyCmsUpdate();
      try { localStorage.setItem('awara_destinations', JSON.stringify(dests)); } catch (e) {}
      return { success: true };
    },

    /**
     * Delete Review
     */
    async deleteReview(id) {
      try {
        const res = await fetch(getApiUrl(`/reviews/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          notifyCmsUpdate();
          await this.getReviews(true);
          return { success: true };
        }
      } catch (err) {}

      let reviews = await this.getReviews(true);
      reviews = reviews.filter(r => String(r.id) !== String(id));
      inMemoryReviews = reviews;
      try { localStorage.setItem('awara_reviews_cache', JSON.stringify(reviews)); } catch (e) {}
      notifyCmsUpdate();
      return { success: true };
    },

    /**
     * Fetch Customer Reviews
     */
    async getReviews(forceRefresh = false) {
      // 1. Try REST API first with cache buster
      try {
        const res = await fetch(getApiUrl(`/reviews?_t=${Date.now()}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            inMemoryReviews = json.data;
            try { localStorage.setItem('awara_reviews_cache', JSON.stringify(json.data)); } catch (e) {}
            return inMemoryReviews;
          }
        }
      } catch (err) {}

      if (!forceRefresh && inMemoryReviews && inMemoryReviews.length > 0) {
        return inMemoryReviews;
      }

      // 2. Check localStorage
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

      // 3. Fallback to static JSON file
      try {
        const basePath = getBasePath();
        const res = await fetch(`${basePath}data/reviews.json?_t=${Date.now()}`);
        if (res.ok) {
          const jsonReviews = await res.json();
          if (Array.isArray(jsonReviews) && jsonReviews.length > 0) {
            inMemoryReviews = jsonReviews;
            try { localStorage.setItem('awara_reviews_cache', JSON.stringify(jsonReviews)); } catch (e) {}
            return inMemoryReviews;
          }
        }
      } catch (err) {}

      return [];
    },

    /**
     * Save Customer Review
     */
    async saveReview(reviewData) {
      if (!reviewData.id) {
        reviewData.id = 'rev_' + Date.now();
      }

      try {
        const res = await fetch(getApiUrl('/reviews'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(reviewData)
        });
        if (res.ok) {
          notifyCmsUpdate();
          await this.getReviews(true);
          return { success: true, data: reviewData };
        }
      } catch (err) {}

      let reviews = await this.getReviews(true);
      const existingIdx = reviews.findIndex(r => String(r.id) === String(reviewData.id));
      if (existingIdx >= 0) {
        reviews[existingIdx] = { ...reviews[existingIdx], ...reviewData };
      } else {
        reviews.unshift(reviewData);
      }

      try { localStorage.setItem('awara_reviews_cache', JSON.stringify(reviews)); } catch (e) {}
      notifyCmsUpdate();
      return { success: true, data: reviewData };
    },

    /**
     * Fetch All Postcards (Reels & Blogs)
     */
    async getPostcards(forceRefresh = false) {
      // 1. Try REST API first with cache buster
      try {
        const res = await fetch(getApiUrl(`/postcards?_t=${Date.now()}`));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            try { localStorage.setItem('awara_postcards_cache', JSON.stringify(json.data)); } catch (e) {}
            return json.data;
          }
        }
      } catch (err) {}

      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem('awara_postcards_cache');
          if (cached) return JSON.parse(cached);
        } catch (e) {}
      }

      // Fallback: load awarabanjara.json
      try {
        const rawRes = await fetch(`data/awarabanjara.json?_t=${Date.now()}`);
        if (rawRes.ok) {
          const rawData = await rawRes.json();
          if (Array.isArray(rawData.postcards)) {
            try { localStorage.setItem('awara_postcards_cache', JSON.stringify(rawData.postcards)); } catch (e) {}
            return rawData.postcards;
          }
        }
      } catch (err) {}

      return [];
    },

    /**
     * Save/Update Postcard (Reel or Blog - Admin Panel)
     */
    async savePostcard(postcardPayload) {
      try {
        const res = await fetch(getApiUrl('/postcards'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(postcardPayload)
        });
        if (res.ok) {
          const json = await res.json();
          notifyCmsUpdate();
          return { success: true, data: json.data };
        }
      } catch (err) {}
      return { success: false, error: 'Failed to save postcard' };
    },

    /**
     * Delete Postcard (Admin Panel)
     */
    async deletePostcard(id) {
      try {
        const res = await fetch(getApiUrl(`/postcards/${id}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          notifyCmsUpdate();
          return { success: true };
        }
      } catch (err) {}
      return { success: false, error: 'Failed to delete postcard' };
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
