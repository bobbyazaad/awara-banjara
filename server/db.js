// =========================================================
// Awara Banjara — Local Database Manager Engine v2.0
// High-performance Local Persistence Engine with Automatic Seeding
// =========================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'awarabanjara.json');

// Memory store for instant sub-millisecond API response
let _db = {
  trips: [],
  destinations: [],
  reviews: [],
  inquiries: [],
  site_config: {},
  packages: [],
  postcards: []
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSONFile(filename, fallback = []) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`⚠️ Error reading ${filename}:`, err.message);
  }
  return fallback;
}

function saveJSONFile(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`❌ Error writing ${filename}:`, err.message);
  }
}

// Initialize database from disk or seed files
function initDatabase() {
  console.log('⚡ Initializing Awara Banjara Local Database Engine...');

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      _db = JSON.parse(raw);
      console.log('📦 Loaded database from awarabanjara.json');
    } catch (e) {
      console.warn('⚠️ Could not parse awarabanjara.json, re-seeding from /data/*.json files');
    }
  }

  // Seed trips if empty
  if (!_db.trips || !Array.isArray(_db.trips) || _db.trips.length === 0) {
    _db.trips = loadJSONFile('trips.json', []);
  }

  // Seed destinations if empty
  if (!_db.destinations || !Array.isArray(_db.destinations) || _db.destinations.length === 0) {
    _db.destinations = loadJSONFile('destinations.json', []);
  }

  // Seed reviews if empty
  if (!_db.reviews || !Array.isArray(_db.reviews) || _db.reviews.length === 0) {
    _db.reviews = loadJSONFile('reviews.json', []);
  }

  // Seed inquiries if empty
  if (!_db.inquiries || !Array.isArray(_db.inquiries) || _db.inquiries.length === 0) {
    _db.inquiries = loadJSONFile('inquiries.json', []);
  }

  // Seed postcards if empty
  if (!_db.postcards || !Array.isArray(_db.postcards) || _db.postcards.length === 0) {
    _db.postcards = loadJSONFile('postcards.json', []);
  }

  // Seed site_config if empty
  if (!_db.site_config || typeof _db.site_config !== 'object' || Object.keys(_db.site_config).length === 0) {
    _db.site_config = loadJSONFile('site_config.json', {
      site_phone: '+91- 9103910523',
      whatsapp_number: '+91-9103910523',
      announcement_bar: '✨ Escape the ordinary — Explore handpicked Himalayan group trips!',
      hero_headline: 'Awara Banjara',
      hero_subtitle: 'Curated Himalayan Escapes, Motorbike Expeditions & Offbeat Group Trips'
    });
  }

  if (Array.isArray(_db.site_config)) {
    const mapObj = {};
    _db.site_config.forEach(item => { if (item.key) mapObj[item.key] = item.value; });
    _db.site_config = mapObj;
  }

  // Seed packages if empty
  if (!_db.packages || !Array.isArray(_db.packages) || _db.packages.length === 0) {
    _db.packages = loadJSONFile('packages.json', []);
  }

  saveDatabase();
  console.log(`✅ Local DB Ready: ${_db.trips.length} trips, ${_db.destinations.length} destinations, ${_db.reviews.length} reviews, ${_db.inquiries.length} inquiries, ${(_db.postcards || []).length} postcards.`);
}

function saveDatabase() {
  saveJSONFile('awarabanjara.json', _db);
  // Also sync back to individual JSON files for maximum backward compatibility
  saveJSONFile('trips.json', _db.trips);
  saveJSONFile('destinations.json', _db.destinations);
  saveJSONFile('reviews.json', _db.reviews);
  saveJSONFile('inquiries.json', _db.inquiries);
  saveJSONFile('postcards.json', _db.postcards);
  saveJSONFile('site_config.json', _db.site_config);
  saveJSONFile('packages.json', _db.packages);
}

// TRIPS OPERATIONS
function getTrips(includeInactive = true) {
  if (!includeInactive) {
    return _db.trips.filter(t => t.active !== false);
  }
  return _db.trips;
}

function getTripById(id) {
  const strId = String(id);
  return _db.trips.find(t => String(t.id) === strId) || null;
}

const prerender = require('./prerender');

function saveTrip(tripData) {
  if (!tripData) return null;
  const strId = String(tripData.id || Date.now());
  tripData.id = isNaN(strId) ? strId : Number(strId);
  tripData.updated_at = new Date().toISOString();

  const idx = _db.trips.findIndex(t => String(t.id) === String(tripData.id));
  if (idx !== -1) {
    _db.trips[idx] = { ..._db.trips[idx], ...tripData };
    tripData = _db.trips[idx];
  } else {
    tripData.created_at = new Date().toISOString();
    _db.trips.unshift(tripData);
  }
  saveDatabase();

  // Automatically pre-render updated static HTML page in /trips/
  try {
    const pageUrl = prerender.prerenderTrip(tripData);
    if (pageUrl) tripData.link = pageUrl;
  } catch (e) {
    console.error('⚠️ Pre-render error:', e.message);
  }

  return tripData;
}

function deleteTrip(id) {
  const strId = String(id);
  const initialLen = _db.trips.length;
  _db.trips = _db.trips.filter(t => String(t.id) !== strId);
  if (_db.trips.length !== initialLen) {
    saveDatabase();
    return true;
  }
  return false;
}

// DESTINATIONS OPERATIONS
function getDestinations() {
  return _db.destinations;
}

function saveDestination(destData) {
  if (!destData) return null;
  const strId = String(destData.id || `dest_${Date.now()}`);
  destData.id = strId;

  const idx = _db.destinations.findIndex(d => String(d.id) === strId);
  if (idx !== -1) {
    _db.destinations[idx] = { ..._db.destinations[idx], ...destData };
  } else {
    _db.destinations.push(destData);
  }
  saveDatabase();
  return destData;
}

function deleteDestination(id) {
  const strId = String(id);
  const initialLen = _db.destinations.length;
  _db.destinations = _db.destinations.filter(d => String(d.id) !== strId);
  if (_db.destinations.length !== initialLen) {
    saveDatabase();
    return true;
  }
  return false;
}

// REVIEWS OPERATIONS
function getReviews() {
  return _db.reviews;
}

function addReview(reviewData) {
  if (!reviewData) return null;
  const newReview = {
    id: reviewData.id || `rev_${Date.now()}`,
    customer_name: reviewData.customer_name || 'Happy Traveler',
    trip_name: reviewData.trip_name || 'Himalayan Expedition',
    trip_url: reviewData.trip_url || 'tour-packages.html',
    rating: Number(reviewData.rating) || 5,
    date_text: reviewData.date_text || 'Recently',
    review_text: reviewData.review_text || '',
    avatar_url: reviewData.avatar_url || '',
    featured: reviewData.featured !== false,
    created_at: new Date().toISOString()
  };
  _db.reviews.unshift(newReview);
  saveDatabase();
  return newReview;
}

// INQUIRIES OPERATIONS
function getInquiries() {
  return _db.inquiries;
}

function addInquiry(inquiryData) {
  if (!inquiryData) return null;
  const inqId = inquiryData.inquiry_id || inquiryData.id || `inq_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const custName = inquiryData.customer_name || inquiryData.name || inquiryData.customerName || 'Guest User';
  const travelDate = inquiryData.selected_date || inquiryData.travel_date || inquiryData.date || inquiryData.selectedBatch || 'Flexible';
  const selPackage = inquiryData.selected_package || inquiryData.package_option || inquiryData.packageOption || 'Standard Package';
  const selSubPackage = inquiryData.selected_sub_package || inquiryData.sub_package_option || inquiryData.subPackageOption || 'N/A';
  const priceVal = inquiryData.price || inquiryData.selected_price || inquiryData.selectedPrice || 'On Request';
  const msgText = inquiryData.message || inquiryData.special_requests || inquiryData.specialRequests || '';

  const newInquiry = {
    id: inqId,
    inquiry_id: inqId,
    name: custName,
    customer_name: custName,
    phone: inquiryData.phone || inquiryData.mobile || '',
    email: inquiryData.email || '',
    travel_date: travelDate,
    selected_date: travelDate,
    selected_package: selPackage,
    selected_sub_package: selSubPackage,
    price: priceVal,
    travelers_count: parseInt(inquiryData.travelers_count || inquiryData.travelers || 1, 10),
    trip_title: inquiryData.trip_title || inquiryData.tripName || inquiryData.packageId || 'General Inquiry',
    special_requests: msgText,
    message: msgText,
    created_at: inquiryData.created_at || new Date().toISOString(),
    status: inquiryData.status || 'Pending'
  };
  _db.inquiries.unshift(newInquiry);
  saveDatabase();
  return newInquiry;
}

function updateInquiryStatus(id, status) {
  const strId = String(id);
  const inq = _db.inquiries.find(i => String(i.id) === strId);
  if (inq) {
    inq.status = status;
    inq.updated_at = new Date().toISOString();
    saveDatabase();
    return inq;
  }
  return null;
}

function deleteReview(id) {
  const strId = String(id);
  const initialLen = _db.reviews.length;
  _db.reviews = _db.reviews.filter(r => String(r.id) !== strId);
  if (_db.reviews.length !== initialLen) {
    saveDatabase();
    return true;
  }
  return false;
}

function deleteInquiry(id) {
  const strId = String(id);
  const initialLen = _db.inquiries.length;
  _db.inquiries = _db.inquiries.filter(i => String(i.id || i.inquiry_id) !== strId);
  if (_db.inquiries.length !== initialLen) {
    saveDatabase();
    return true;
  }
  return false;
}

// SITE CONFIG OPERATIONS
function getSiteConfig() {
  return _db.site_config;
}

function updateSiteConfig(key, value) {
  if (typeof key === 'object') {
    _db.site_config = { ..._db.site_config, ...key };
  } else if (key) {
    _db.site_config[key] = value;
  }
  saveDatabase();
  return _db.site_config;
}

// EXPORT & IMPORT BUNDLE
function exportFullData() {
  return _db;
}

function importFullData(bundle) {
  if (!bundle || typeof bundle !== 'object') return false;
  if (Array.isArray(bundle.trips)) _db.trips = bundle.trips;
  if (Array.isArray(bundle.destinations)) _db.destinations = bundle.destinations;
  if (Array.isArray(bundle.reviews)) _db.reviews = bundle.reviews;
  if (Array.isArray(bundle.inquiries)) _db.inquiries = bundle.inquiries;
  if (bundle.site_config && typeof bundle.site_config === 'object') _db.site_config = bundle.site_config;
  if (Array.isArray(bundle.packages)) _db.packages = bundle.packages;
  saveDatabase();
  try {
    prerender.prerenderAllTrips(_db.trips);
  } catch (e) {}
  return true;
}

// POSTCARDS (REELS & BLOGS) OPERATIONS
function getPostcards() {
  return _db.postcards || [];
}

function getPostcardById(id) {
  const strId = String(id);
  return (_db.postcards || []).find(p => String(p.id) === strId) || null;
}

function savePostcard(item) {
  if (!item) return null;
  if (!_db.postcards) _db.postcards = [];
  const strId = String(item.id || ('post_' + Date.now()));
  item.id = strId;
  item.updated_at = new Date().toISOString();

  // Extract Instagram Embed URL if video_url provided
  if (item.type === 'reel' && item.video_url && !item.embed_url) {
    let cleanUrl = item.video_url.split('?')[0].replace(/\/$/, '');
    item.embed_url = cleanUrl + '/embed';
  }

  const idx = _db.postcards.findIndex(p => String(p.id) === strId);
  if (idx !== -1) {
    _db.postcards[idx] = { ..._db.postcards[idx], ...item };
    item = _db.postcards[idx];
  } else {
    item.created_at = new Date().toISOString();
    _db.postcards.unshift(item);
  }
  saveDatabase();
  return item;
}

function deletePostcard(id) {
  if (!_db.postcards) return false;
  const strId = String(id);
  const initialLen = _db.postcards.length;
  _db.postcards = _db.postcards.filter(p => String(p.id) !== strId);
  if (_db.postcards.length !== initialLen) {
    saveDatabase();
    return true;
  }
  return false;
}

// Boot on import
initDatabase();

module.exports = {
  getTrips,
  getTripById,
  saveTrip,
  deleteTrip,
  getDestinations,
  saveDestination,
  deleteDestination,
  getReviews,
  addReview,
  deleteReview,
  getInquiries,
  addInquiry,
  updateInquiryStatus,
  deleteInquiry,
  getPostcards,
  getPostcardById,
  savePostcard,
  deletePostcard,
  getSiteConfig,
  updateSiteConfig,
  exportFullData,
  importFullData
};
