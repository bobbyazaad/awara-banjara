// =========================================================
// AwaraBanjara — Standalone Featured Card Stack Engine v5.0
// Smooth 3D Flip & Slide Animation Engine
// =========================================================

(function () {
  'use strict';

  var CardStackManager = {
    trips: [],
    currentIndex: 0,
    isAnimating: false,
    container: null,
    captionTitle: null,
    captionPrice: null,
    captionBtn: null,

    init: function () {
      this.container = document.getElementById('featuredCardStack');
      if (!this.container) return;

      var banner = this.container.closest('.featured-banner') || document;
      this.captionTitle = banner.querySelector('[data-role="title"]');
      this.captionPrice = banner.querySelector('[data-role="price"]');
      this.captionBtn = banner.querySelector('[data-role="cta"]');

      var self = this;

      this.container.addEventListener('click', function (e) {
        // A swipe that just completed also fires a synthetic click on touch
        // devices - swallow that one so it doesn't double-advance.
        if (self._justSwiped) { self._justSwiped = false; return; }
        if (e && e.preventDefault) e.preventDefault();
        self.advance(1);
      });

      this.container.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          self.advance(1);
        }
      });

      this.bindSwipe();

      console.log('✅ CardStackManager v5.0 initialized');
    },

    bindSwipe: function () {
      var self = this;
      var touch = null; // { startX, startY, dx, axis }
      var SWIPE_THRESHOLD = 60;

      function frontCard() {
        return self.container.querySelector('.card-stack-item[data-pos="0"]');
      }

      this.container.addEventListener('touchstart', function (e) {
        if (self.isAnimating) { touch = null; return; }
        var t = e.touches[0];
        touch = { startX: t.clientX, startY: t.clientY, dx: 0, axis: null };
      }, { passive: true });

      this.container.addEventListener('touchmove', function (e) {
        if (!touch) return;
        var t = e.touches[0];
        var dx = t.clientX - touch.startX;
        var dy = t.clientY - touch.startY;

        if (touch.axis === null) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        if (touch.axis !== 'x') return;

        // Only once we know this is a horizontal drag do we take over the
        // gesture - otherwise a vertical swipe here would still scroll it.
        e.preventDefault();
        touch.dx = dx;

        var front = frontCard();
        if (front) {
          front.classList.add('dragging');
          front.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 18) + 'deg)';
        }
      }, { passive: false });

      this.container.addEventListener('touchend', function () {
        if (!touch) return;
        var dx = touch.dx;
        var wasHorizontal = touch.axis === 'x';
        touch = null;

        var front = frontCard();

        if (wasHorizontal && Math.abs(dx) > SWIPE_THRESHOLD) {
          // Mobile browsers usually suppress the synthetic click that would
          // otherwise follow a touchend after a preventDefault()-ed drag, so
          // don't rely on the click handler to clear this - self-clear on a
          // timer, or a later genuine tap could get incorrectly swallowed.
          self._justSwiped = true;
          setTimeout(function () { self._justSwiped = false; }, 400);
          if (front) {
            front.classList.remove('dragging');
            front.style.transform = '';
          }
          self.advance(dx < 0 ? -1 : 1);
        } else if (front) {
          front.classList.remove('dragging');
          front.style.transform = '';
        }
      }, { passive: true });

      this.container.addEventListener('touchcancel', function () {
        if (!touch) return;
        touch = null;
        var front = frontCard();
        if (front) {
          front.classList.remove('dragging');
          front.style.transform = '';
        }
      }, { passive: true });
    },

    setTrips: function (tripsData) {
      if (!Array.isArray(tripsData) || tripsData.length === 0) {
        this.renderComingSoon();
        return;
      }
      this.trips = tripsData;
      this.currentIndex = 0;
      this.render();
    },

    renderComingSoon: function () {
      if (!this.container) this.init();
      if (!this.container) return;

      this.container.innerHTML = [
        '<div class="coming-soon-stack-card" style="width: 100%; height: 360px; background: #fafaf7; border: 2px dashed #e0e0d8; border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;">',
        '  <div style="font-size: 42px; margin-bottom: 12px;">✨</div>',
        '  <h3 style="font-size: 22px; font-weight: 800; color: #14140f; margin-bottom: 8px; letter-spacing: -0.02em;">Coming Soon</h3>',
        '  <p style="font-size: 14px; color: #666; margin: 0; max-width: 340px;">Featured destination flip cards are being prepared and will appear here as soon as itineraries are added from the Admin Panel.</p>',
        '</div>'
      ].join('');

      if (this.captionTitle) this.captionTitle.textContent = 'Featured Destinations';
      if (this.captionPrice) this.captionPrice.textContent = 'Curated trips arriving shortly';
      if (this.captionBtn) {
        this.captionBtn.textContent = 'Explore';
        this.captionBtn.href = 'tour-packages.html';
      }
    },

    getLocationTag: function (trip) {
      if (trip.route) {
        var parts = trip.route.split('—').map(function (p) { return p.trim(); });
        if (parts.length > 0 && parts[0]) return parts[0] + ', India';
      }
      var title = (trip.title || '').toLowerCase();
      if (title.includes('spiti')) return 'Spiti Valley, India';
      if (title.includes('ladakh') || title.includes('leh')) return 'Ladakh, India';
      if (title.includes('zanskar') || title.includes('zaskar')) return 'Zanskar Valley, India';
      if (title.includes('kashmir')) return 'Kashmir, India';
      if (title.includes('meghalaya')) return 'Meghalaya, India';
      if (title.includes('rajasthan') || title.includes('udaipur')) return 'Rajasthan, India';
      if (title.includes('uttarakhand')) return 'Uttarakhand, India';
      if (title.includes('himachal') || title.includes('kasol') || title.includes('manali')) return 'Himachal, India';
      return 'Himalayas, India';
    },

    formatPrice: function (val) {
      if (val === null || val === undefined) return 'On Request';
      var str = String(val).trim();
      if (!str || str === '0' || str === '0.00' || str.toLowerCase() === 'on request' || str.toLowerCase().indexOf('request') !== -1) {
        return 'On Request';
      }
      var numMatch = str.match(/\d[\d,]*/);
      if (!numMatch) return str.indexOf('₹') === 0 ? str : '₹' + str;
      var num = parseInt(numMatch[0].replace(/,/g, ''), 10);
      if (isNaN(num) || num <= 0) return 'On Request';
      return '₹' + num.toLocaleString('en-IN');
    },

    render: function () {
      if (!this.container) this.init();
      if (!this.container || this.trips.length === 0) return;

      var count = Math.min(4, this.trips.length);
      var html = '';

      for (var i = 0; i < count; i++) {
        var tripIdx = (this.currentIndex + i) % this.trips.length;
        var trip = this.trips[tripIdx];
        var detailUrl = (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.buildSeoTripUrl)
          ? window.AwaraDB.buildSeoTripUrl(trip)
          : (trip.id ? ('trip-detail.html?id=' + trip.id) : (trip.link || 'trip-detail.html'));
        var imgUrl = trip.image_url || trip.bento_img_1 || 'assets/images/placeholder-card-1.svg';
        var locTag = this.getLocationTag(trip);
        var priceDisplay = this.formatPrice(trip.price);

        html += `
          <div class="card-stack-item" data-pos="${i}" data-trip-index="${tripIdx}" data-title="${trip.title}" data-price="${priceDisplay}" data-href="${detailUrl}">
            <img src="${encodeURI(imgUrl)}" alt="${trip.title}" onerror="this.onerror=null;this.src='assets/images/placeholder-card-1.svg'">
            <div class="card-gradient-overlay"></div>
            <span class="card-tag">📍 ${locTag}</span>
          </div>
        `;
      }

      this.container.innerHTML = html;
      this.updateCaption();
    },

    /**
     * Advance the stack by one card. direction is 1 (flies off to the
     * right - default for click/keyboard/right-swipe) or -1 (flies off to
     * the left - left-swipe).
     */
    advance: function (direction) {
      if (this.isAnimating || !this.container) return;

      var dir = direction === -1 ? -1 : 1;
      var items = Array.from(this.container.querySelectorAll('.card-stack-item'));
      var total = items.length;
      if (total === 0) return;

      this.isAnimating = true;

      var currentFront = items.filter(function (item) { return item.getAttribute('data-pos') === '0'; })[0] || items[0];
      if (currentFront) {
        currentFront.style.setProperty('--flip-dir', String(dir));
        currentFront.classList.add('flip-animating');
      }

      var self = this;
      setTimeout(function () {
        // Pure CSS attribute rotation (glitch-free & hardware accelerated)
        items.forEach(function (item) {
          var pos = parseInt(item.getAttribute('data-pos'), 10);
          if (isNaN(pos)) pos = 0;
          var newPos = (pos - 1 + total) % total;
          item.setAttribute('data-pos', String(newPos));
          item.classList.remove('flip-animating');
        });

        // Update front caption for new front card (data-pos="0")
        var newFront = items.filter(function (item) { return item.getAttribute('data-pos') === '0'; })[0];
        if (newFront) {
          var title = newFront.getAttribute('data-title') || 'Himalayan Expedition';
          var price = self.formatPrice(newFront.getAttribute('data-price'));
          var href = newFront.getAttribute('data-href') || 'trip-detail.html';

          if (self.captionTitle) self.captionTitle.textContent = title;
          if (self.captionPrice) self.captionPrice.textContent = price;
          if (self.captionBtn) self.captionBtn.setAttribute('href', href);
        }
      }, 180);

      setTimeout(function () {
        self.isAnimating = false;
      }, 500);
    },

    updateCaption: function () {
      if (this.trips.length === 0) return;
      var activeTrip = this.trips[this.currentIndex] || this.trips[0];
      if (!activeTrip) return;
      var detailUrl = (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.buildSeoTripUrl)
        ? window.AwaraDB.buildSeoTripUrl(activeTrip)
        : (activeTrip.id ? ('trip-detail.html?id=' + activeTrip.id) : (activeTrip.link || 'trip-detail.html'));

      if (this.captionTitle) this.captionTitle.textContent = activeTrip.title || 'Himalayan Expedition';
      if (this.captionPrice) this.captionPrice.textContent = this.formatPrice(activeTrip.price);
      if (this.captionBtn) this.captionBtn.setAttribute('href', detailUrl);
    }
  };

  window.CardStackManager = CardStackManager;

  document.addEventListener('DOMContentLoaded', function () {
    CardStackManager.init();
  });
})();
