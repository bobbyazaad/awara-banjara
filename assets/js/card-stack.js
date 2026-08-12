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
      this.container.onclick = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        // A drag that released past the swipe threshold already triggered its
        // own flyOut in pointerup - don't double-advance on the click that
        // usually follows a touch/mouse release. Gated on a time window
        // rather than a plain flag: some input paths (e.g. a mouse drag that
        // starts on the card's <img>) never fire that trailing click at all,
        // which would otherwise leave the flag stuck and swallow the next
        // real tap forever.
        if (self._suppressClickUntil && Date.now() < self._suppressClickUntil) {
          self._suppressClickUntil = 0;
          return;
        }
        self.nextCard();
      };

      this.container.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          self.nextCard();
        }
      };

      this.bindSwipe();

      console.log('✅ CardStackManager v5.0 initialized');
    },

    // Drag-to-follow-finger + directional fly-out on release. Uses Pointer
    // Events so it behaves the same for real touch and a mouse drag.
    bindSwipe: function () {
      var self = this;
      var drag = null;
      var DRAG_ROTATE_DIVISOR = 16;
      var FLING_THRESHOLD = 55;

      this.container.addEventListener('pointerdown', function (e) {
        if (self.isAnimating) return;
        var front = self.container.querySelector('.card-stack-item[data-pos="0"]');
        if (!front) return;
        drag = { startX: e.clientX, startY: e.clientY, front: front, moved: false };
        front.style.transition = 'none';
      });

      this.container.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.startX;
        var dy = e.clientY - drag.startY;
        if (!drag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        drag.moved = true;
        drag.dx = dx;
        drag.front.style.transform = 'translateX(' + dx + 'px) translateY(' + (dy * 0.15) + 'px) rotate(' + (dx / DRAG_ROTATE_DIVISOR) + 'deg)';
      });

      var release = function () {
        if (!drag) return;
        var front = drag.front;
        var dx = drag.dx || 0;
        var wasDrag = drag.moved;
        drag = null;

        front.style.transition = '';

        if (wasDrag && Math.abs(dx) > FLING_THRESHOLD) {
          self._suppressClickUntil = Date.now() + 400;
          self.flyOut(dx > 0 ? 'right' : 'left', front);
        } else {
          front.style.transform = '';
        }
      };

      this.container.addEventListener('pointerup', release);
      this.container.addEventListener('pointercancel', release);
      this.container.addEventListener('pointerleave', function () {
        if (drag && drag.moved) release();
      });
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

    // Pure CSS attribute rotation (Glitch-Free & Hardware Accelerated) -
    // shared by a plain click/tap advance and the post-flyOut settle.
    rotatePositions: function () {
      if (!this.container) return;
      var items = Array.from(this.container.querySelectorAll('.card-stack-item'));
      var total = items.length;
      if (total === 0) return;

      items.forEach(function (item) {
        var pos = parseInt(item.getAttribute('data-pos'), 10);
        if (isNaN(pos)) pos = 0;
        var newPos = (pos - 1 + total) % total;
        item.setAttribute('data-pos', String(newPos));
      });

      var newFront = items.filter(function (item) { return item.getAttribute('data-pos') === '0'; })[0];
      if (newFront) {
        var title = newFront.getAttribute('data-title') || 'Himalayan Expedition';
        var price = this.formatPrice(newFront.getAttribute('data-price'));
        var href = newFront.getAttribute('data-href') || 'trip-detail.html';

        if (this.captionTitle) this.captionTitle.textContent = title;
        if (this.captionPrice) this.captionPrice.textContent = price;
        if (this.captionBtn) this.captionBtn.setAttribute('href', href);
      }
    },

    nextCard: function () {
      if (this.isAnimating || !this.container) return;
      if (this.container.querySelectorAll('.card-stack-item').length === 0) return;

      this.isAnimating = true;
      this.rotatePositions();

      var self = this;
      setTimeout(function () {
        self.isAnimating = false;
      }, 420);
    },

    // Swiped release: the front card flies off screen in the swipe direction,
    // then the stack rotates underneath it and the flown card is recycled
    // back into the (now hidden) rear position with its transform cleared.
    flyOut: function (direction, front) {
      if (this.isAnimating || !this.container) return;
      front = front || this.container.querySelector('.card-stack-item[data-pos="0"]');
      if (!front) return;

      this.isAnimating = true;
      var flyX = direction === 'right' ? '170%' : '-170%';
      var rot = direction === 'right' ? '28deg' : '-28deg';

      front.style.transition = 'transform 0.42s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.42s ease';
      front.style.transform = 'translateX(' + flyX + ') translateY(-18px) rotate(' + rot + ')';
      front.style.opacity = '0';

      var self = this;
      setTimeout(function () {
        self.rotatePositions();
        front.style.transition = 'none';
        front.style.transform = '';
        front.style.opacity = '';
        // Next frame: restore the transition so the recycled card's move
        // into its new stack position animates instead of snapping.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            front.style.transition = '';
          });
        });
        self.isAnimating = false;
      }, 420);
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
