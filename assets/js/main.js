document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');

  var MENU_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
  var CLOSE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  if (toggle && nav) {
    // Initial icon render to guarantee visible hamburger icon
    if (!toggle.innerHTML.trim() || toggle.innerHTML.includes('<use')) {
      toggle.innerHTML = MENU_SVG;
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    var setOpen = function (isOpen) {
      nav.classList.toggle('open', isOpen);
      backdrop.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.innerHTML = isOpen ? CLOSE_SVG : MENU_SVG;
    };

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });

    backdrop.addEventListener('click', function () {
      setOpen(false);
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  // Sticky header shadow once the page scrolls
  var header = document.querySelector('.site-header');
  if (header) {
    var updateHeaderShadow = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 4);
    };
    updateHeaderShadow();
    window.addEventListener('scroll', updateHeaderShadow, { passive: true });
  }

  // Center-mode carousels: the middle card is largest, neighbours scale down.
  // Arrows (or swipe, or clicking a side card) move a different card into the centre.
  window.initCarousels = function () {
    document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
      var stage = carousel.querySelector('.carousel-stage');
      if (!stage) return;

      var cards = Array.prototype.slice.call(stage.querySelectorAll('.trip-card'));
      var total = cards.length;
      if (!total) return;

      var center = Math.floor(total / 2); // start with middle card centred

      function render() {
        cards.forEach(function (card, i) {
          var delta = i - center;
          if (delta > total / 2) delta -= total;
          if (delta < -total / 2) delta += total;

          card.dataset.offset = Math.abs(delta) <= 3 ? String(delta) : 'far';
          card.querySelectorAll('a').forEach(function (link) {
            link.tabIndex = delta === 0 ? 0 : -1;
          });
        });
      }

      function move(step) {
        center = (center + step + total) % total;
        render();
      }

      carousel.querySelectorAll('[data-dir]').forEach(function (btn) {
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function () {
          move(newBtn.dataset.dir === 'next' ? 1 : -1);
        });
      });

      cards.forEach(function (card, i) {
        card.addEventListener('click', function (e) {
          if (card.dataset.offset === '0') return;
          if (e.target.closest('a, button')) return;
          e.preventDefault();
          center = i;
          render();
        });
      });

      var touchX = null;
      stage.addEventListener('touchstart', function (e) {
        touchX = e.changedTouches[0].clientX;
      }, { passive: true });

      stage.addEventListener('touchend', function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
        touchX = null;
      }, { passive: true });

      if (carousel._autoTimer) clearInterval(carousel._autoTimer);
      var autoAttr = carousel.getAttribute('data-autoscroll');
      if (autoAttr !== null && autoAttr !== 'false') {
        var intervalMs = parseInt(autoAttr, 10) || 3000;
        carousel._autoTimer = setInterval(function () {
          move(1);
        }, intervalMs);

        carousel.addEventListener('mouseenter', function () {
          clearInterval(carousel._autoTimer);
        });
        carousel.addEventListener('mouseleave', function () {
          clearInterval(carousel._autoTimer);
          carousel._autoTimer = setInterval(function () {
            move(1);
          }, intervalMs);
        });
      }

      render();
    });
  };

  window.initCarousels();

  window.initCardStack = function () {
    document.querySelectorAll('.card-stack').forEach(function (stack) {
      var caption = stack.parentElement ? stack.parentElement.querySelector('.featured-caption') : null;
      var isAnimating = false;

      function advance(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (isAnimating) return;

        var items = Array.from(stack.querySelectorAll('.card-stack-item'));
        var total = items.length;
        if (total === 0) return;

        var currentFront = items.filter(function (item) { return item.dataset.pos === '0'; })[0] || items[0];
        if (currentFront) {
          isAnimating = true;
          currentFront.classList.add('flip-animating');
        }

        setTimeout(function() {
          items.forEach(function (item) {
            var pos = parseInt(item.dataset.pos, 10);
            if (isNaN(pos)) pos = 0;
            var newPos = (pos - 1 + total) % total;
            item.dataset.pos = String(newPos);
            item.setAttribute('data-pos', String(newPos));
            item.classList.remove('flip-animating');
          });

          var newFront = items.filter(function (item) { return String(item.dataset.pos) === '0'; })[0];
          if (newFront && caption) {
            var titleNode = caption.querySelector('[data-role="title"]');
            var priceNode = caption.querySelector('[data-role="price"]');
            var ctaNode = caption.querySelector('[data-role="cta"]');
            if (titleNode) titleNode.textContent = newFront.dataset.title || '';
            if (priceNode) priceNode.textContent = newFront.dataset.price || '';
            if (ctaNode) ctaNode.setAttribute('href', newFront.dataset.href || 'trip-detail.html');
          }
          isAnimating = false;
        }, 180);
      }

      stack.onclick = advance;
      stack.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          advance();
        }
      };

      stack.querySelectorAll('.card-stack-item').forEach(function (item) {
        item.onclick = advance;
      });
    });
  };

  window.initCardStack();

  // Trip Planning Modal for International Destinations
  var tripModal = document.getElementById('tripModal');
  var closeTripModal = document.getElementById('closeTripModal');
  var modalDestImg = document.getElementById('modalDestImg');
  var modalDestTitle = document.getElementById('modalDestTitle');

  function openTripModal(title, imgSrc) {
    if (!tripModal) tripModal = document.getElementById('tripModal');
    if (!modalDestImg) modalDestImg = document.getElementById('modalDestImg');
    if (!modalDestTitle) modalDestTitle = document.getElementById('modalDestTitle');
    if (!tripModal) return;

    if (modalDestTitle) {
      modalDestTitle.textContent = title || 'Escape the ordinary.';
    }
    if (modalDestImg) modalDestImg.src = imgSrc || 'assets/images/trips/gonbo-rangjon.jpg';

    tripModal.classList.add('active');
    tripModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  window.openTripModal = openTripModal;

  function closeTripModalFunc() {
    if (!tripModal) return;
    tripModal.classList.remove('active');
    tripModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (closeTripModal) {
    closeTripModal.addEventListener('click', closeTripModalFunc);
  }

  if (tripModal) {
    tripModal.addEventListener('click', function (e) {
      if (e.target === tripModal) {
        closeTripModalFunc();
      }
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && tripModal.classList.contains('active')) {
        closeTripModalFunc();
      }
    });
  }

  // Attach click handler to Hero section Book Now button
  var heroBookNowBtn = document.getElementById('heroBookNowBtn');
  if (heroBookNowBtn) {
    heroBookNowBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openTripModal('Escape the ordinary.', 'assets/images/trips/gonbo-rangjon.jpg');
    });
  }

  // Attach click handlers to all cards in Domestic & International Destinations sections
  var destSections = document.querySelectorAll('#domestic-dest-section, #intl-dest-section');
  destSections.forEach(function (section) {
    section.querySelectorAll('.trip-card').forEach(function (card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function (e) {
        if (e.target.closest('button, a')) return;
        var img = card.querySelector('img');
        var titleEl = card.querySelector('.dest-top-title');
        var title = titleEl ? titleEl.textContent.trim() : 'Destination';
        var imgSrc = img ? img.getAttribute('src') : '';
        openTripModal(title, imgSrc);
      });
    });
  });

  // Dynamic Home Page Destinations Engine (Domestic & International)
  async function loadDynamicHomeDestinations(forceRefresh) {
    var domesticStage = document.querySelector('#domestic-dest-section .carousel-stage');
    var intlStage = document.querySelector('#intl-dest-section .carousel-stage');

    if (!domesticStage && !intlStage) return;

    if (typeof window.AwaraDB === 'undefined' || !window.AwaraDB.getDestinations) return;

    try {
      var destinations = await window.AwaraDB.getDestinations(forceRefresh);
      if (!destinations || !Array.isArray(destinations) || destinations.length === 0) return;

      var domesticList = destinations.filter(function(d) { return d.category === 'domestic' && d.is_active !== false; });
      var intlList = destinations.filter(function(d) { return (d.category === 'international' || d.category === 'intl') && d.is_active !== false; });

      function buildCardHTML(d, offset) {
        return '<article class="trip-card dest-card-simple" data-offset="' + offset + '" style="cursor:pointer;">' +
          '<div class="thumb">' +
            '<img src="' + (d.image_url || 'assets/images/placeholder-card-1.svg') + '" alt="' + (d.title || 'Destination') + '" onerror="this.onerror=null;this.src=\'assets/images/placeholder-card-1.svg\'">' +
            '<div class="dest-gradient-top"></div>' +
            '<h3 class="dest-top-title">' + (d.title || 'Destination') + '</h3>' +
            '<div class="dest-watermark"><img src="assets/images/logo/awara-banjara-white-logo.png" alt="Awara Banjara" class="watermark-logo-img"></div>' +
          '</div>' +
        '</article>';
      }

      if (domesticStage && domesticList.length > 0) {
        domesticStage.innerHTML = domesticList.map(function(d, i) { return buildCardHTML(d, i - Math.floor(domesticList.length / 2)); }).join('');
      }

      if (intlStage && intlList.length > 0) {
        intlStage.innerHTML = intlList.map(function(d, i) { return buildCardHTML(d, i - Math.floor(intlList.length / 2)); }).join('');
      }

      if (typeof window.initCarousels === 'function') {
        window.initCarousels();
      }

      // Re-attach click handlers to dynamically rendered cards
      document.querySelectorAll('#domestic-dest-section .trip-card, #intl-dest-section .trip-card').forEach(function (card) {
        card.style.cursor = 'pointer';
        card.onclick = function (e) {
          if (e.target.closest('button, a')) return;
          var img = card.querySelector('img');
          var titleEl = card.querySelector('.dest-top-title');
          var title = titleEl ? titleEl.textContent.trim() : 'Destination';
          var imgSrc = img ? img.getAttribute('src') : '';
          openTripModal(title, imgSrc);
        };
      });

    } catch (err) {
      console.warn('Notice: Dynamic home destinations load:', err);
    }
  }

  loadDynamicHomeDestinations();

  window.addEventListener('awaraCmsUpdated', function() {
    loadDynamicHomeDestinations(true);
  });

  function showInquirySuccessModal() {
    var successModal = document.getElementById('inquirySuccessModal');
    var closeSuccessBtn = document.getElementById('closeSuccessModalBtn');

    if (!successModal) return;

    successModal.style.zIndex = '999999';
    successModal.classList.add('active');
    successModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    var closeSuccessFunc = function (evt) {
      if (evt) evt.stopPropagation();
      successModal.classList.remove('active');
      successModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    if (closeSuccessBtn) {
      closeSuccessBtn.onclick = closeSuccessFunc;
    }

    // Delay backdrop click binding so submit click bubbling doesn't close it instantly
    setTimeout(function () {
      successModal.onclick = function (evt) {
        if (evt.target === successModal) {
          closeSuccessFunc(evt);
        }
      };
    }, 100);
  }

  window.showInquirySuccessModal = showInquirySuccessModal;

  // Handle Trip Modal Form Submission (Stores lead in Supabase trip_inquiries table)
  var tripModalForm = document.getElementById('tripModalForm');
  if (tripModalForm) {
    tripModalForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();

      var modalDestTitleEl = document.getElementById('modalDestTitle');
      var destTitle = modalDestTitleEl ? modalDestTitleEl.textContent.trim() : 'Destination';

      var custName = (document.getElementById('tripModalName')?.value || '').trim();
      var custPhone = (document.getElementById('tripModalPhone')?.value || '').trim();
      var custEmail = (document.getElementById('tripModalEmail')?.value || '').trim();
      var travelDate = (document.getElementById('tripModalDate')?.value || '').trim();
      var travelersInput = document.getElementById('tripModalTravelers')?.value;
      var travelers = parseInt(travelersInput || '1', 10);
      var userMsg = (document.getElementById('tripModalMessage')?.value || '').trim();

      if (custPhone && !custPhone.startsWith('+')) {
        custPhone = '+91-' + custPhone.replace(/[^0-9]/g, '');
      }

      var inquiryPayload = {
        inquiry_id: 'INQ_' + Date.now(),
        trip_id: 'dest_' + destTitle.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        trip_title: destTitle,
        price: 'On Request',
        selected_date: travelDate || 'To be decided',
        selected_package: 'Custom Package',
        selected_sub_package: 'none',
        customer_name: custName,
        phone: custPhone,
        email: custEmail || 'N/A',
        travelers_count: isNaN(travelers) || travelers < 1 ? 1 : travelers,
        message: userMsg || 'Destination inquiry from website modal',
        status: 'new'
      };

      // Asynchronous insert via AwaraDB Local Engine
      if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.submitInquiry) {
        window.AwaraDB.submitInquiry(inquiryPayload);
      }

      // Instantly close the input modal
      closeTripModalFunc();
      tripModalForm.reset();

      // Instantly show success confirmation modal card
      showInquirySuccessModal();
    });
  }

  // Global delegate: Any click on a Connect with Expert button opens the trip modal
  document.body.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-connect-expert');
    if (btn && btn.id !== 'tripModalSubmitBtn' && !btn.closest('#tripModalForm') && !btn.closest('#bookingForm')) {
      e.preventDefault();
      openTripModal('Plan Your Custom Trip', 'assets/images/trips/gonbo-rangjon.jpg');
    }
  });
});
