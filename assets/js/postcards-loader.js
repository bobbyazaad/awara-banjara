/**
 * Awara Banjara — Watch & Read / Postcards Loader (Reels & Blogs)
 * Handles dynamic rendering on index.html and postcards.html with interactive Modals
 */

(function () {
  'use strict';

  let allPostcards = [];
  let activeFilter = 'all';

  // Inject Video and Blog Modal Markup if not present
  function ensureModalsExist() {
    if (!document.getElementById('postcardMediaModal')) {
      const modalHTML = `
        <!-- INSTAGRAM VIDEO / REEL MODAL -->
        <div id="postcardMediaModal" class="ab-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); align-items:center; justify-content:center; padding:20px;">
          <div class="ab-modal-content" style="background:#14140f; border:1px solid rgba(255,255,255,0.15); border-radius:20px; width:100%; max-width:440px; overflow:hidden; position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);">
            <button type="button" class="ab-modal-close" onclick="closePostcardModal()" style="position:absolute; top:14px; right:14px; background:rgba(255,255,255,0.2); border:none; color:#fff; width:36px; height:36px; border-radius:50%; font-size:20px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">✕</button>
            <div id="reelEmbedContainer" style="width:100%; min-height:480px; background:#000; display:flex; align-items:center; justify-content:center;">
              <!-- Dynamic iFrame Embed -->
            </div>
            <div class="ab-modal-body" style="padding:16px 20px 20px 20px; color:#fff;">
              <h3 id="reelModalTitle" style="font-size:18px; font-weight:700; margin-bottom:6px;"></h3>
              <p id="reelModalAuthor" style="font-size:13px; color:rgba(255,255,255,0.7); margin-bottom:14px;"></p>
              <a id="reelExternalBtn" href="#" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:12px; background:linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); color:#fff; font-weight:700; font-size:14px; border-radius:12px; text-decoration:none; text-align:center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                Watch Original Reel on Instagram
              </a>
            </div>
          </div>
        </div>

        <!-- TRAVEL BLOG READER MODAL -->
        <div id="blogArticleModal" class="ab-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); align-items:center; justify-content:center; padding:20px; overflow-y:auto;">
          <div class="ab-modal-content" style="background:#fff; color:#14140f; border-radius:24px; width:100%; max-width:760px; max-height:90vh; overflow-y:auto; position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <button type="button" class="ab-modal-close" onclick="closeBlogModal()" style="position:sticky; top:14px; float:right; margin-right:14px; background:rgba(0,0,0,0.6); border:none; color:#fff; width:36px; height:36px; border-radius:50%; font-size:20px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center;">✕</button>
            <div style="width:100%; max-height:340px; overflow:hidden; border-top-left-radius:24px; border-top-right-radius:24px;">
              <img id="blogModalHeaderImg" src="" alt="" style="width:100%; height:340px; object-fit:cover;">
            </div>
            <div style="padding:28px 32px 36px 32px;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
                <span id="blogModalCategory" style="background:var(--color-black, #14140f); color:#fff; font-size:12px; font-weight:700; padding:4px 12px; border-radius:20px; text-transform:uppercase;"></span>
                <span id="blogModalReadTime" style="font-size:13px; color:#666; font-weight:500;"></span>
              </div>
              <h2 id="blogModalTitle" style="font-family:'Outfit', sans-serif; font-size:clamp(22px, 3vw, 32px); font-weight:800; line-height:1.25; margin-bottom:8px;"></h2>
              <p id="blogModalSubtitle" style="font-size:16px; color:#555; font-weight:500; margin-bottom:20px; border-left:3px solid var(--color-lime, #d6ff3f); padding-left:12px;"></p>
              
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid #eee;">
                <img id="blogModalAuthorAvatar" src="" alt="" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <div>
                  <div id="blogModalAuthor" style="font-weight:700; font-size:14px;"></div>
                  <div style="font-size:12px; color:#888;">Awara Banjara Explorer</div>
                </div>
              </div>

              <div id="blogModalBodyText" style="font-size:16px; line-height:1.75; color:#2c2c2c;">
                <!-- Blog content paragraphs -->
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
  }

  window.closePostcardModal = function () {
    const modal = document.getElementById('postcardMediaModal');
    if (modal) {
      modal.style.display = 'none';
      const container = document.getElementById('reelEmbedContainer');
      if (container) container.innerHTML = '';
    }
  };

  window.closeBlogModal = function () {
    const modal = document.getElementById('blogArticleModal');
    if (modal) modal.style.display = 'none';
  };

  window.openReelModal = function (reelId) {
    ensureModalsExist();
    const item = allPostcards.find(p => String(p.id) === String(reelId));
    if (!item) return;

    const modal = document.getElementById('postcardMediaModal');
    const container = document.getElementById('reelEmbedContainer');
    const titleEl = document.getElementById('reelModalTitle');
    const authorEl = document.getElementById('reelModalAuthor');
    const btnEl = document.getElementById('reelExternalBtn');

    titleEl.textContent = item.title || 'Instagram Reel';
    authorEl.textContent = item.author ? `By ${item.author}` : 'Awara Banjara';
    btnEl.href = item.video_url || item.embed_url || 'https://instagram.com';

    let embedUrl = item.embed_url || item.video_url;
    if (embedUrl && !embedUrl.includes('/embed')) {
      embedUrl = embedUrl.split('?')[0].replace(/\/$/, '') + '/embed';
    }

    container.innerHTML = `
      <iframe src="${embedUrl}" width="100%" height="480" frameborder="0" scrolling="no" allowtransparency="true" style="border:none; border-radius:12px; background:#000;"></iframe>
    `;

    modal.style.display = 'flex';
  };

  window.openBlogModal = function (blogId) {
    ensureModalsExist();
    const item = allPostcards.find(p => String(p.id) === String(blogId));
    if (!item) return;

    const modal = document.getElementById('blogArticleModal');
    document.getElementById('blogModalHeaderImg').src = item.image_url || 'assets/images/trips/spiti-grit-expedition.jpg';
    document.getElementById('blogModalCategory').textContent = item.category || 'Travel Story';
    document.getElementById('blogModalReadTime').textContent = item.read_time || '5 min read';
    document.getElementById('blogModalTitle').textContent = item.title;
    document.getElementById('blogModalSubtitle').textContent = item.subtitle || '';
    document.getElementById('blogModalAuthor').textContent = item.author || 'Team Awara Banjara';
    document.getElementById('blogModalAuthorAvatar').src = item.author_avatar || 'assets/images/placeholder-avatar.svg';

    let bodyHTML = (item.content || '').split('\n\n').map(para => {
      if (para.startsWith('### ')) {
        return `<h3 style="font-size:20px; font-weight:700; margin:24px 0 12px 0;">${para.replace('### ', '')}</h3>`;
      }
      if (para.startsWith('- ')) {
        const items = para.split('\n').map(li => `<li>${li.replace(/^- \*\*(.*?)\*\*:/, '<strong>$1:</strong>').replace(/^- /, '')}</li>`).join('');
        return `<ul style="margin-left:20px; margin-bottom:16px;">${items}</ul>`;
      }
      return `<p style="margin-bottom:16px;">${para}</p>`;
    }).join('');

    document.getElementById('blogModalBodyText').innerHTML = bodyHTML;
    modal.style.display = 'flex';
  };

  // Render on index.html
  function renderHomePagePostcards() {
    const carouselEl = document.getElementById('watch-read-carousel');
    const carouselStage = carouselEl ? carouselEl.querySelector('.carousel-stage') : null;
    const blogGrid = document.querySelector('#watch-read-section .card-grid');

    const reels = allPostcards.filter(p => p.type === 'reel');
    const blogs = allPostcards.filter(p => p.type === 'blog');

    // 1. Render Carousel Reels — only replace if we have CMS data
    if (carouselStage && reels.length > 0) {
      let stageHTML = '';
      reels.forEach((reel, idx) => {
        const offset = idx - Math.floor(reels.length / 2);
        stageHTML += `
          <article class="trip-card dest-card-simple" data-offset="${offset}" onclick="openReelModal('${reel.id}')" style="cursor:pointer; overflow:hidden;">
            <div class="thumb" style="position:relative; width:100%; height:100%;">
              <img src="${reel.image_url || 'assets/images/destinations/domestic/spiti.jpg'}" alt="${reel.title}" onerror="this.onerror=null;this.src='assets/images/placeholder-card-1.svg'" style="width:100%; height:100%; object-fit:cover;">
              <div class="reel-play-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.3); display:flex; flex-direction:column; align-items:center; justify-content:center; transition:background 0.3s;">
                <div style="width:48px; height:48px; border-radius:50%; background:rgba(255,255,255,0.9); color:#14140f; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(0,0,0,0.3); margin-bottom:8px;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <span style="color:#fff; font-size:12px; font-weight:700; text-shadow:0 2px 4px rgba(0,0,0,0.8); padding:2px 8px; background:rgba(0,0,0,0.4); border-radius:10px;">${reel.title}</span>
              </div>
            </div>
          </article>
        `;
      });
      carouselStage.innerHTML = stageHTML;

      // Clear existing auto-scroll timer before re-init
      if (carouselEl && carouselEl._autoTimer) {
        clearInterval(carouselEl._autoTimer);
        carouselEl._autoTimer = null;
      }
      if (typeof window.initCarousels === 'function') {
        window.initCarousels();
      }
    }
    // If no CMS reels, keep existing static HTML cards as fallback — do nothing

    // 2. Render Blog Cards — only replace if we have CMS data
    if (blogGrid && blogs.length > 0) {
      let gridHTML = '';
      blogs.slice(0, 4).forEach(blog => {
        gridHTML += `
          <article class="postcard-card" onclick="openBlogModal('${blog.id}')" style="cursor:pointer;">
            <div class="thumb">
              <img src="${blog.image_url || 'assets/images/postcards/zanskar-full-circuit.jpg'}" alt="${blog.title}" onerror="this.onerror=null;this.src='assets/images/placeholder-card-1.svg'">
              <span class="badge"><svg><use href="#icon-book"/></svg></span>
            </div>
            <div class="body">
              <div class="author-row">
                <img src="${blog.author_avatar || 'assets/images/placeholder-avatar.svg'}" alt="${blog.author || ''}">
                <span>${blog.author || 'Team Awara Banjara'}</span>
              </div>
              <h3>${blog.title}</h3>
            </div>
          </article>
        `;
      });
      blogGrid.innerHTML = gridHTML;
    }
    // If no CMS blogs, keep existing static HTML cards as fallback — do nothing
  }

  // Render on postcards.html
  function renderPostcardsPage() {
    const grid = document.querySelector('.postcards-4col-grid');
    if (!grid) return;

    let items = allPostcards;
    if (activeFilter === 'blog') {
      items = allPostcards.filter(p => p.type === 'blog');
    } else if (activeFilter === 'reel') {
      items = allPostcards.filter(p => p.type === 'reel');
    }

    if (items.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:#888;">No postcards found in this category.</div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      const isReel = item.type === 'reel';
      return `
        <article class="postcard-card" onclick="${isReel ? `openReelModal('${item.id}')` : `openBlogModal('${item.id}')`}" style="cursor:pointer;">
          <div class="thumb" style="position:relative;">
            <img src="${item.image_url || 'assets/images/postcards/zanskar-full-circuit.jpg'}" alt="${item.title}" onerror="this.onerror=null;this.src='assets/images/placeholder-card-1.svg'">
            <span class="badge" style="${isReel ? 'background:linear-gradient(45deg, #f09433, #dc2743); color:#fff;' : ''}">
              ${isReel ? '▶' : '<svg><use href="#icon-book"/></svg>'}
            </span>
          </div>
          <div class="body">
            <div class="author-row">
              <img src="${item.author_avatar || 'assets/images/placeholder-avatar.svg'}" alt="${item.author || ''}">
              <span>${item.author || 'Awara Banjara'}</span>
            </div>
            <h3>${item.title}</h3>
            ${item.subtitle ? `<p style="font-size:12px; color:#777; margin-top:4px;">${item.subtitle}</p>` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  // Add filter tab bar on postcards.html if missing
  function initPostcardPageFilters() {
    const heroSection = document.querySelector('.postcards-hero');
    if (heroSection && !document.getElementById('postcardFilterBar')) {
      const filterBarHTML = `
        <div id="postcardFilterBar" style="display:flex; gap:12px; margin:24px 0 32px 0; flex-wrap:wrap;">
          <button type="button" class="pc-filter-btn active" data-filter="all" onclick="setPostcardFilter('all')" style="padding:10px 20px; border-radius:30px; font-weight:700; font-size:14px; border:none; cursor:pointer; background:#14140f; color:#fff;">✨ All Stories (${allPostcards.length})</button>
          <button type="button" class="pc-filter-btn" data-filter="blog" onclick="setPostcardFilter('blog')" style="padding:10px 20px; border-radius:30px; font-weight:700; font-size:14px; border:1px solid #ddd; cursor:pointer; background:#fff; color:#14140f;">📖 Travel Blogs (${allPostcards.filter(p=>p.type==='blog').length})</button>
          <button type="button" class="pc-filter-btn" data-filter="reel" onclick="setPostcardFilter('reel')" style="padding:10px 20px; border-radius:30px; font-weight:700; font-size:14px; border:1px solid #ddd; cursor:pointer; background:#fff; color:#14140f;">🎬 Instagram Reels (${allPostcards.filter(p=>p.type==='reel').length})</button>
        </div>
      `;
      const titleEl = heroSection.querySelector('p') || heroSection.querySelector('h1');
      if (titleEl) titleEl.insertAdjacentHTML('afterend', filterBarHTML);
    }
  }

  window.setPostcardFilter = function (filterType) {
    activeFilter = filterType;
    document.querySelectorAll('.pc-filter-btn').forEach(btn => {
      if (btn.dataset.filter === filterType) {
        btn.style.background = '#14140f';
        btn.style.color = '#fff';
        btn.style.border = 'none';
      } else {
        btn.style.background = '#fff';
        btn.style.color = '#14140f';
        btn.style.border = '1px solid #ddd';
      }
    });
    renderPostcardsPage();
  };

  async function init(forceRefresh = false) {
    ensureModalsExist();
    if (typeof window.AwaraDB !== 'undefined' && window.AwaraDB.getPostcards) {
      try {
        allPostcards = await window.AwaraDB.getPostcards(forceRefresh);
      } catch (e) {}
    }

    renderHomePagePostcards();
    if (document.querySelector('.postcards-4col-grid')) {
      initPostcardPageFilters();
      renderPostcardsPage();
    }
  }

  window.addEventListener('awaraCmsUpdated', function() {
    init(true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
