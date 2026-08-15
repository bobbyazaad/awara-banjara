// =========================================================
// AwaraBanjara — Navbar Itinerary Search
// Live dropdown of matching trips as the visitor types, sourced from the
// same AwaraDB trip data every other listing on the site uses.
// =========================================================

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const wrapper = document.getElementById('navSearch');
    const toggle = document.getElementById('navSearchToggle');
    const panel = document.getElementById('navSearchPanel');
    const input = document.getElementById('navSearchInput');
    const resultsEl = document.getElementById('navSearchResults');
    const flipPlaceholder = document.getElementById('navSearchFlipPlaceholder');
    const flipWord = document.getElementById('navSearchFlipWord');
    if (!wrapper || !toggle || !panel || !input || !resultsEl) return;

    // Rotating "Search itineraries for <destination>" placeholder, since a
    // real <input placeholder> can't animate between words on its own.
    // Only runs while the panel is actually open/rendered - a CSS animation
    // started on a class while its ancestor is display:none won't reliably
    // play once that ancestor becomes visible, so tying this to open/close
    // (rather than free-running from page load) keeps it predictable.
    let startFlipping = function() {};
    let stopFlipping = function() {};
    let resetFlipWord = function() {};

    if (flipPlaceholder && flipWord) {
      const destinations = ['Spiti', 'Ladakh', 'Zanskar', 'Kashmir', 'Himachal', 'Meghalaya', 'Rajasthan', 'Uttarakhand'];
      let destIndex = 0;
      let flipTimer = null;

      function flipToNext() {
        destIndex = (destIndex + 1) % destinations.length;
        flipWord.classList.remove('flip-in');
        flipWord.classList.add('flip-out');
        flipWord.addEventListener('animationend', function onOut() {
          flipWord.removeEventListener('animationend', onOut);
          flipWord.textContent = destinations[destIndex];
          flipWord.classList.remove('flip-out');
          flipWord.classList.add('flip-in');
        }, { once: true });
      }

      startFlipping = function() {
        if (flipTimer || input.value.length > 0) return;
        flipTimer = setInterval(flipToNext, 2200);
      };

      stopFlipping = function() {
        clearInterval(flipTimer);
        flipTimer = null;
      };

      resetFlipWord = function() {
        destIndex = 0;
        flipWord.classList.remove('flip-out', 'flip-in');
        flipWord.textContent = destinations[0];
      };

      function syncPlaceholderVisibility() {
        const hasValue = input.value.length > 0;
        flipPlaceholder.classList.toggle('hidden', hasValue);
        if (hasValue) stopFlipping(); else startFlipping();
      }

      input.addEventListener('input', syncPlaceholderVisibility);
      input.addEventListener('focus', syncPlaceholderVisibility);
      input.addEventListener('blur', syncPlaceholderVisibility);
    }

    let allTrips = [];
    let tripsLoaded = false;

    async function ensureTrips() {
      if (tripsLoaded) return;
      try {
        if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.getTrips) {
          allTrips = await window.AwaraDB.getTrips();
        } else {
          const res = await fetch('data/trips.json');
          allTrips = await res.json();
        }
      } catch (e) {
        allTrips = [];
      }
      tripsLoaded = true;
    }

    function tripDetailUrl(trip) {
      return (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.buildSeoTripUrl)
        ? window.AwaraDB.buildSeoTripUrl(trip)
        : (trip.id ? 'trip-detail.html?id=' + trip.id : 'trip-detail.html');
    }

    function matchesQuery(t, query) {
      const haystack = [
        t.title || '',
        t.route || '',
        t.category || '',
        Array.isArray(t.tags) ? t.tags.join(' ') : (t.tags || ''),
        t.sub_package_options || ''
      ].join(' ').toLowerCase();
      return query.split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
    }

    function formatPrice(val) {
      if (val === null || val === undefined) return 'On Request';
      const str = String(val).trim();
      if (!str || str === '0' || str.toLowerCase().includes('request')) return 'On Request';
      const numMatch = str.match(/\d[\d,]*/);
      if (!numMatch) return 'On Request';
      const num = parseInt(numMatch[0].replace(/,/g, ''), 10);
      if (isNaN(num) || num <= 0) return 'On Request';
      return `₹${num.toLocaleString('en-IN')}`;
    }

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function renderResults(rawQuery) {
      const query = rawQuery.trim().toLowerCase();

      if (!query) {
        resultsEl.innerHTML = '';
        resultsEl.classList.remove('show');
        return;
      }

      const matches = allTrips.filter(t => matchesQuery(t, query)).slice(0, 8);

      if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="nav-search-empty">No itineraries found. Try a different destination or trip name.</div>';
        resultsEl.classList.add('show');
        return;
      }

      resultsEl.innerHTML = matches.map(t => {
        const url = tripDetailUrl(t);
        const img = t.image_url || t.image || 'assets/images/placeholder-card-1.svg';
        const price = formatPrice(t.price);
        const title = escapeHtml(t.title || 'Untitled Trip');
        const duration = escapeHtml(t.duration || '');
        return (
          '<a class="nav-search-result" href="' + url + '">' +
            '<img src="' + img + '" alt="" loading="lazy" onerror="this.src=\'assets/images/placeholder-card-1.svg\'">' +
            '<div>' +
              '<div class="nav-search-result-title">' + title + '</div>' +
              '<div class="nav-search-result-meta">' + (duration ? duration + ' · ' : '') + price + '</div>' +
            '</div>' +
          '</a>'
        );
      }).join('');
      resultsEl.classList.add('show');
    }

    function openPanel() {
      wrapper.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      ensureTrips().then(() => {
        if (input.value.trim()) renderResults(input.value);
      });
      startFlipping();
      setTimeout(() => input.focus(), 50);
    }

    function closePanel() {
      wrapper.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      stopFlipping();
      resetFlipWord();
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (wrapper.classList.contains('open')) {
        closePanel();
      } else {
        openPanel();
      }
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    let debounceTimer = null;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => renderResults(input.value), 150);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePanel();
        toggle.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) closePanel();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
    });
  }
})();
