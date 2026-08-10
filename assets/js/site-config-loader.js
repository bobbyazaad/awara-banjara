// =========================================================
// AwaraBanjara — Site Config & Header Hydration Loader
// Consumes AwaraDB to update site banners & contact numbers
// =========================================================

document.addEventListener('DOMContentLoaded', function () {
  loadSiteConfig();
});

async function loadSiteConfig(forceRefresh = false) {
  let configMap = {};

  if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB) {
    configMap = await window.AwaraDB.getSiteConfig(forceRefresh);
  }

  applySiteConfig(configMap);
}

function applySiteConfig(config) {
  if (!config) return;

  // 1. Header Phone Number
  if (config.site_phone) {
    document.querySelectorAll('.header-contact span:last-child').forEach(el => {
      el.textContent = config.site_phone;
    });
  }

  // 2. WhatsApp Numbers & Links
  if (config.whatsapp_number) {
    const waClean = config.whatsapp_number.replace(/[^0-9]/g, '');
    document.querySelectorAll('.wa-left, a[href*="wa.me"]').forEach(el => {
      if (el.tagName === 'A') {
        const textParam = el.href.includes('text=') ? el.href.substring(el.href.indexOf('text=')) : '';
        el.href = `https://wa.me/${waClean}${textParam ? '?' + textParam : ''}`;
      }
    });
  }

  // 3. Announcement Bar
  if (config.announcement_bar) {
    document.querySelectorAll('.announcement-bar, .site-announcement').forEach(el => {
      el.textContent = config.announcement_bar;
    });
  }

  // 4. Hero Headline
  if (config.hero_headline) {
    document.querySelectorAll('.hero-headline, [data-config="hero_headline"]').forEach(el => {
      el.textContent = config.hero_headline;
    });
  }

  // 5. Hero Subtitle
  if (config.hero_subtitle) {
    document.querySelectorAll('.hero-subtitle, [data-config="hero_subtitle"]').forEach(el => {
      el.textContent = config.hero_subtitle;
    });
  }
}

window.loadSiteConfig = loadSiteConfig;

window.addEventListener('awaraCmsUpdated', function () {
  loadSiteConfig(true);
});
