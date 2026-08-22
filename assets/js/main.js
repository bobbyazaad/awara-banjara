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

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.innerHTML = isOpen ? CLOSE_SVG : MENU_SVG;
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

  // Floating WhatsApp button: stays off-screen while the hero sits untouched,
  // then slides in from the right as soon as the visitor starts scrolling.
  var whatsappFloat = document.querySelector('.whatsapp-float');
  if (whatsappFloat) {
    var REVEAL_AT = 120; // px of scroll before the button slides in

    var updateWhatsappFloat = function () {
      whatsappFloat.classList.toggle('is-visible', window.scrollY > REVEAL_AT);
    };
    updateWhatsappFloat();
    window.addEventListener('scroll', updateWhatsappFloat, { passive: true });
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

  // Card-stack (featured escapes) click, keyboard, and swipe handling lives
  // entirely in card-stack.js's CardStackManager — it owns the DOM there
  // (rewrites it from live trip data), so a second controller here used to
  // fight it for the container's onclick and silently win, which is why the
  // stack could only ever be advanced by click, never swiped.

  // Trip detail photo gallery, phone-width only: same flip-card look and
  // tap/swipe-to-dismiss interaction as the homepage's featured card stack,
  // built from the same photos as the desktop bento grid (assets/css/
  // style.css hides the grid and shows this in its place under 860px). A
  // no-op on every page without a .trip-bento-gallery.
  (function initGalleryFlipStack() {
    var gallery = document.querySelector('.trip-bento-gallery');
    if (!gallery) return;

    var images = Array.prototype.slice.call(gallery.querySelectorAll('img'));
    if (images.length < 2) return;

    var stack = document.createElement('div');
    stack.className = 'gallery-flip-stack';
    stack.setAttribute('role', 'button');
    stack.setAttribute('tabindex', '0');
    stack.setAttribute('aria-label', 'Show next photo');

    images.forEach(function (img, i) {
      var item = document.createElement('div');
      item.className = 'gallery-flip-item';
      item.setAttribute('data-pos', String(i));
      var clone = document.createElement('img');
      clone.src = img.currentSrc || img.src;
      clone.alt = img.alt || '';
      clone.loading = i === 0 ? 'eager' : 'lazy';
      clone.decoding = 'async';
      item.appendChild(clone);
      stack.appendChild(item);
    });

    gallery.insertAdjacentElement('afterend', stack);
    gallery.classList.add('has-flip-stack');

    var isAnimating = false;

    function rotatePositions() {
      var items = Array.prototype.slice.call(stack.querySelectorAll('.gallery-flip-item'));
      var total = items.length;
      items.forEach(function (item) {
        var pos = parseInt(item.getAttribute('data-pos'), 10);
        if (isNaN(pos)) pos = 0;
        item.setAttribute('data-pos', String((pos - 1 + total) % total));
      });
    }

    function nextPhoto() {
      if (isAnimating) return;
      isAnimating = true;
      rotatePositions();
      setTimeout(function () { isAnimating = false; }, 420);
    }

    function flyOut(direction, front) {
      if (isAnimating || !front) return;
      isAnimating = true;
      var flyX = direction === 'right' ? '170%' : '-170%';
      var rot = direction === 'right' ? '28deg' : '-28deg';

      front.style.transition = 'transform 0.42s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.42s ease';
      front.style.transform = 'translateX(' + flyX + ') translateY(-18px) rotate(' + rot + ')';
      front.style.opacity = '0';

      setTimeout(function () {
        rotatePositions();
        front.style.transition = 'none';
        front.style.transform = '';
        front.style.opacity = '';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { front.style.transition = ''; });
        });
        isAnimating = false;
      }, 420);
    }

    var suppressClickUntil = 0;
    stack.addEventListener('click', function (e) {
      e.preventDefault();
      if (suppressClickUntil && Date.now() < suppressClickUntil) {
        suppressClickUntil = 0;
        return;
      }
      nextPhoto();
    });
    stack.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextPhoto();
      }
    });

    var drag = null;
    stack.addEventListener('pointerdown', function (e) {
      if (isAnimating) return;
      var front = stack.querySelector('.gallery-flip-item[data-pos="0"]');
      if (!front) return;
      drag = { startX: e.clientX, startY: e.clientY, front: front, moved: false };
      front.style.transition = 'none';
    });
    stack.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.startX;
      var dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      drag.moved = true;
      drag.dx = dx;
      drag.front.style.transform = 'translateX(' + dx + 'px) translateY(' + (dy * 0.15) + 'px) rotate(' + (dx / 16) + 'deg)';
    });
    var release = function () {
      if (!drag) return;
      var front = drag.front;
      var dx = drag.dx || 0;
      var wasDrag = drag.moved;
      drag = null;
      front.style.transition = '';
      if (wasDrag && Math.abs(dx) > 55) {
        suppressClickUntil = Date.now() + 400;
        flyOut(dx > 0 ? 'right' : 'left', front);
      } else {
        front.style.transform = '';
      }
    };
    stack.addEventListener('pointerup', release);
    stack.addEventListener('pointercancel', release);
    stack.addEventListener('pointerleave', function () {
      if (drag && drag.moved) release();
    });
  })();

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
      openTripModal("Let's Plan Your Next Journey.", 'assets/images/trips/zanskar-monastery-gathering.jpg');
    });
  }

  // Deep link: opening the site at #book (e.g. for sharing a direct link
  // straight to the inquiry form) auto-opens the same modal as the hero
  // Book Now button.
  if (window.location.hash === '#book') {
    openTripModal("Let's Plan Your Next Journey.", 'assets/images/trips/zanskar-monastery-gathering.jpg');
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
    tripModalForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();

      var modalDestTitleEl = document.getElementById('modalDestTitle');
      var destTitle = modalDestTitleEl ? modalDestTitleEl.textContent.trim() : 'Destination';

      var destSelect = document.getElementById('tripModalDestination');
      var selectedDestLabel = (destSelect && destSelect.selectedIndex > 0)
        ? destSelect.options[destSelect.selectedIndex].textContent.trim()
        : '';
      // Prefer the destination the visitor actually picked over the modal's
      // own (generic marketing) heading, which no longer names a specific
      // trip/destination now that it reads "Let's Plan Your Next Journey."
      var effectiveTitle = selectedDestLabel || destTitle;

      var custName = (document.getElementById('tripModalName')?.value || '').trim();
      var custPhone = (document.getElementById('tripModalPhone')?.value || '').trim();
      var custEmail = (document.getElementById('tripModalEmail')?.value || '').trim();
      var custCity = (document.getElementById('tripModalCity')?.value || '').trim();

      if (custPhone && !custPhone.startsWith('+')) {
        custPhone = '+91-' + custPhone.replace(/[^0-9]/g, '');
      }

      // The admin inquiries view only renders name/phone/email/message (no
      // dedicated city column), so fold both bits of context into message
      // to make sure they're actually visible there rather than silently
      // sitting in fields nothing displays.
      var messageParts = [];
      messageParts.push(selectedDestLabel ? ('Interested in: ' + selectedDestLabel) : 'Destination inquiry from website modal');
      if (custCity) messageParts.push('Contacting from: ' + custCity);

      var inquiryPayload = {
        inquiry_id: 'INQ_' + Date.now(),
        trip_id: 'dest_' + effectiveTitle.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        trip_title: effectiveTitle,
        price: 'On Request',
        selected_date: 'To be decided',
        selected_package: 'Custom Package',
        selected_sub_package: 'none',
        customer_name: custName,
        phone: custPhone,
        email: custEmail || 'N/A',
        customer_city: custCity || 'N/A',
        travelers_count: 1,
        message: messageParts.join('. '),
        status: 'new'
      };

      // Insert via AwaraDB Local Engine, and actually wait for + check the
      // result before telling the visitor it worked. submitInquiry() has a
      // local-storage fallback for when the server can't be reached, and
      // that fallback used to get reported as success too - the CMS admin
      // panel only ever reads from the server, never from that local
      // buffer, so a submission that silently fell back was invisible in
      // the CMS while the visitor still saw "success" and had no reason to
      // try again.
      var submitBtn = document.getElementById('tripModalSubmitBtn');
      var originalBtnText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      var result = { success: false };
      try {
        if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.submitInquiry) {
          result = await window.AwaraDB.submitInquiry(inquiryPayload);
        }
      } catch (err) {
        result = { success: false, error: err.message };
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }

      if (result && result.serverSynced) {
        closeTripModalFunc();
        tripModalForm.reset();
        showInquirySuccessModal();
      } else {
        alert("Sorry, we couldn't reach our server just now - your details were not saved. Please check your connection and try again, or message us directly on WhatsApp.");
      }
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
