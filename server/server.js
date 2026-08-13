// =========================================================
// Awara Banjara — Zero-Dependency Express-Compatible REST API Server v2.0
// Built with Node.js Native HTTP Engine (Zero npm package dependencies)
// Serves REST API Endpoints & Static Website Files on localhost:3000
// =========================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db');
const auth = require('./auth');
const prerender = require('./prerender');
const gitSync = require('./git-sync');

const PORT = process.env.PORT || auth.config.PORT || 8085;
const HOST = process.env.HOST || auth.config.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, '..');

// MIME types mapping for static file server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf'
};

// Helper: send JSON response
function sendJSON(res, statusCode, data) {
  auth.setSecurityHeaders(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': auth.config.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Helper: check admin authentication for protected endpoints
function requireAuth(req, res) {
  const token = auth.extractTokenFromReq(req);
  if (!auth.isValidToken(token)) {
    sendJSON(res, 401, { success: false, error: 'Unauthorized: Admin authentication token required' });
    return false;
  }
  return true;
}

// Helper: parse request body JSON
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({ raw: body });
      }
    });
    req.on('error', err => reject(err));
  });
}

// HTTP Request Handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight handling
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Log API calls
  if (pathname.startsWith('/api/')) {
    console.log(`📡 [API ${method}] ${pathname}`);
  }

  // =========================================================
  // REST API ROUTES
  // =========================================================

  // 0. AUTHENTICATION API
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const ip = req.socket.remoteAddress || '127.0.0.1';
      if (auth.isRateLimited(ip)) {
        return sendJSON(res, 429, { success: false, error: 'Too many failed login attempts. Please wait 30 seconds before retrying.' });
      }
      const payload = await parseRequestBody(req);
      if (auth.verifyPassword(payload.username, payload.password)) {
        const session = auth.createSession(payload.username);
        console.log(`🔑 Admin Authenticated: ${payload.username}`);
        return sendJSON(res, 200, {
          success: true,
          message: 'Authentication successful',
          token: session.token,
          expiresAt: session.expiresAt
        });
      }
      return sendJSON(res, 401, { success: false, error: 'Invalid admin username or password' });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname === '/api/auth/verify' && method === 'GET') {
    const token = auth.extractTokenFromReq(req);
    const valid = auth.isValidToken(token);
    return sendJSON(res, 200, { success: true, authenticated: valid });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = auth.extractTokenFromReq(req);
    auth.destroySession(token);
    return sendJSON(res, 200, { success: true, message: 'Logged out successfully' });
  }

  // 1. TRIPS API
  if (pathname === '/api/trips' && method === 'GET') {
    try {
      const includeInactive = parsedUrl.query.includeInactive !== 'false';
      const trips = db.getTrips(includeInactive);
      return sendJSON(res, 200, { success: true, count: trips.length, data: trips });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/trips/') && method === 'GET') {
    const id = pathname.replace('/api/trips/', '');
    const trip = db.getTripById(id);
    if (trip) {
      return sendJSON(res, 200, { success: true, data: trip });
    }
    return sendJSON(res, 404, { success: false, error: 'Trip not found' });
  }

function triggerPrerender() {
  try {
    const trips = db.getTrips(true);
    prerender.prerenderAllTrips(trips);
    console.log(`✨ Auto-regenerated ${trips.length} static trip HTML page(s) from CMS update`);
  } catch (err) {
    console.error('⚠️ Auto pre-render error:', err.message);
  }
}

  if (pathname === '/api/trips' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const payload = await parseRequestBody(req);
      const saved = db.saveTrip(payload);
      triggerPrerender();
      return sendJSON(res, 200, { success: true, message: 'Trip saved successfully', data: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/trips/') && method === 'PUT') {
    if (!requireAuth(req, res)) return;
    try {
      const id = pathname.replace('/api/trips/', '');
      const payload = await parseRequestBody(req);
      payload.id = id;
      const saved = db.saveTrip(payload);
      triggerPrerender();
      return sendJSON(res, 200, { success: true, message: 'Trip updated successfully', data: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/trips/') && method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    try {
      const id = pathname.replace('/api/trips/', '');
      const ok = db.deleteTrip(id);
      if (ok) {
        triggerPrerender();
        return sendJSON(res, 200, { success: true, message: 'Trip deleted successfully' });
      }
      return sendJSON(res, 404, { success: false, error: 'Trip not found' });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // 2. DESTINATIONS API
  if (pathname === '/api/destinations' && method === 'GET') {
    const dests = db.getDestinations();
    return sendJSON(res, 200, { success: true, count: dests.length, data: dests });
  }

  if (pathname === '/api/destinations' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const payload = await parseRequestBody(req);
      const saved = db.saveDestination(payload);
      triggerPrerender();
      return sendJSON(res, 200, { success: true, message: 'Destination saved successfully', data: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/destinations/') && method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    try {
      const id = pathname.replace('/api/destinations/', '');
      const success = db.deleteDestination(id);
      if (success) {
        triggerPrerender();
        return sendJSON(res, 200, { success: true, message: 'Destination deleted successfully' });
      }
      return sendJSON(res, 404, { success: false, error: 'Destination not found' });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // 3. REVIEWS API
  if (pathname === '/api/reviews' && method === 'GET') {
    const reviews = db.getReviews();
    return sendJSON(res, 200, { success: true, count: reviews.length, data: reviews });
  }

  if (pathname === '/api/reviews' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const payload = await parseRequestBody(req);
      const saved = db.saveReview(payload);
      triggerPrerender();
      return sendJSON(res, 200, { success: true, message: 'Review saved successfully', data: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/reviews/') && method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    try {
      const id = pathname.replace('/api/reviews/', '');
      const success = db.deleteReview(id);
      if (success) {
        triggerPrerender();
        return sendJSON(res, 200, { success: true, message: 'Review deleted successfully' });
      }
      return sendJSON(res, 404, { success: false, error: 'Review not found' });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // 4. INQUIRIES API (Bookings & Leads - PII Protected)
  if (pathname === '/api/inquiries' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const inquiries = db.getInquiries();
    return sendJSON(res, 200, { success: true, count: inquiries.length, data: inquiries });
  }

  if (pathname === '/api/inquiries' && method === 'POST') {
    try {
      const payload = await parseRequestBody(req);
      const saved = db.addInquiry(payload);
      console.log(`📩 New Lead Received: ${saved.name} (${saved.phone}) for ${saved.trip_title}`);
      return sendJSON(res, 200, { success: true, message: 'Inquiry submitted successfully', data: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/inquiries/') && method === 'PUT') {
    if (!requireAuth(req, res)) return;
    try {
      const id = pathname.replace('/api/inquiries/', '');
      const payload = await parseRequestBody(req);
      const updated = db.updateInquiryStatus(id, payload.status || 'Contacted');
      if (updated) {
        return sendJSON(res, 200, { success: true, message: 'Inquiry status updated', data: updated });
      }
      return sendJSON(res, 404, { success: false, error: 'Inquiry not found' });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/inquiries/') && method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    try {
      const id = pathname.replace('/api/inquiries/', '');
      const success = db.deleteInquiry(id);
      if (success) {
        return sendJSON(res, 200, { success: true, message: 'Inquiry deleted successfully' });
      }
      return sendJSON(res, 404, { success: false, error: 'Inquiry not found' });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // 4.5. POSTCARDS (REELS & BLOGS) API
  if (pathname === '/api/postcards' && method === 'GET') {
    const postcards = db.getPostcards();
    return sendJSON(res, 200, { success: true, count: postcards.length, data: postcards });
  }

  if (pathname.startsWith('/api/postcards/') && method === 'GET') {
    const id = pathname.replace('/api/postcards/', '');
    const item = db.getPostcardById(id);
    if (item) {
      return sendJSON(res, 200, { success: true, data: item });
    }
    return sendJSON(res, 404, { success: false, error: 'Postcard not found' });
  }

  if (pathname === '/api/postcards' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const payload = await parseRequestBody(req);
      const saved = db.savePostcard(payload);
      triggerPrerender();
      return sendJSON(res, 200, { success: true, message: 'Postcard saved successfully', data: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/postcards/') && method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    try {
      const id = pathname.replace('/api/postcards/', '');
      const success = db.deletePostcard(id);
      if (success) {
        triggerPrerender();
        return sendJSON(res, 200, { success: true, message: 'Postcard deleted successfully' });
      }
      return sendJSON(res, 404, { success: false, error: 'Postcard not found' });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // 5. IMAGE UPLOAD API (Saves dropped/picked images to assets/images/trips/)
  if (pathname === '/api/upload' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const payload = await parseRequestBody(req);
      if (!payload.dataUrl && !payload.data) {
        return sendJSON(res, 400, { success: false, error: 'No image data provided' });
      }

      const rawData = payload.dataUrl || payload.data;
      const matches = rawData.match(/^data:image\/([a-zA-Z0-9+\-+.]+);base64,(.+)$/);
      
      let ext = 'jpg';
      let base64Data = rawData;
      
      if (matches) {
        ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        base64Data = matches[2];
      }

      const rawName = (payload.filename || 'uploaded_image').replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const baseNameWithoutExt = rawName.includes('.') ? rawName.substring(0, rawName.lastIndexOf('.')) : rawName;
      const timeStamp = Date.now();
      const fileName = `img_${timeStamp}_${baseNameWithoutExt}.${ext}`;
      
      const targetDir = path.join(__dirname, '../assets/images/trips');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, fileName);
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      const relativePath = `assets/images/trips/${fileName}`;
      console.log(`📸 Image uploaded and saved to disk: ${relativePath} (${buffer.length} bytes)`);

      // Local disk alone doesn't survive the next redeploy (the filesystem
      // rebuilds from the last GitHub commit) - push it to the live-data
      // branch too, same as CMS data. Fire-and-forget: don't make the
      // uploader wait on a GitHub round-trip, and a sync failure shouldn't
      // fail the upload itself.
      gitSync.pushImage(fileName);

      return sendJSON(res, 200, {
        success: true,
        message: 'Image uploaded successfully',
        relativePath: relativePath,
        filename: fileName
      });
    } catch (e) {
      console.error('❌ Image Upload Error:', e);
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // 6. SITE CONFIG API
  if (pathname === '/api/site-config' && method === 'GET') {
    const config = db.getSiteConfig();
    return sendJSON(res, 200, { success: true, data: config });
  }

  if (pathname === '/api/site-config' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const payload = await parseRequestBody(req);
      const updated = db.updateSiteConfig(payload);
      triggerPrerender();
      return sendJSON(res, 200, { success: true, message: 'Site config updated', data: updated });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // 7. BACKUP EXPORT & IMPORT
  if (pathname === '/api/export' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const fullData = db.exportFullData();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=awara_banjara_db_backup_${Date.now()}.json`
    });
    return res.end(JSON.stringify(fullData, null, 2));
  }

  if (pathname === '/api/import' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const bundle = await parseRequestBody(req);
      const ok = db.importFullData(bundle);
      if (ok) {
        return sendJSON(res, 200, { success: true, message: 'JSON Data imported successfully!' });
      }
      return sendJSON(res, 400, { success: false, error: 'Invalid JSON bundle payload' });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // =========================================================
  // STATIC WEBSITE FILE SERVING
  // =========================================================
  let reqPath = path.normalize(pathname);
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(PUBLIC_DIR, reqPath);

  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    // Only fall back to index.html for extensionless routes (client-side style navigation,
    // e.g. deep links into the SPA-ish pages). A missing path with a real extension
    // (.jpg/.js/.css/.html/etc.) or any other unmatched route gets a genuine 404 instead of
    // silently returning the homepage with a 200 status.
    let statusCode = 200;
    if (err || !stats.isFile()) {
      const looksLikeFile = path.extname(reqPath) !== '';
      if (looksLikeFile) {
        statusCode = 404;
        filePath = path.join(PUBLIC_DIR, '404.html');
      } else {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server File Error');
      }
      res.writeHead(statusCode, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
});

let currentPort = Number(PORT);

function startServer(portToTry) {
  server.listen(portToTry, HOST, () => {
    console.log('=========================================================');
    console.log(`🚀 Awara Banjara Unified Node.js Server running at http://${HOST}:${portToTry}`);
    console.log(`🌐 Website URL: http://${HOST}:${portToTry}`);
    console.log(`⚙️ Admin CMS URL: http://${HOST}:${portToTry}/admin.html`);
    console.log(`📡 REST API Base: http://${HOST}:${portToTry}/api/trips`);
    console.log('=========================================================');

    // Backfill any CMS-uploaded images missing from this (possibly freshly
    // rebuilt) filesystem. Runs after listen() on purpose - the image set is
    // unbounded, unlike the small fixed set of data/*.json files pulled
    // before listen() in db.js, so it must not gate request-serving readiness.
    gitSync.pullMissingImagesOnBoot();
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !process.env.PORT) {
    currentPort += 1;
    console.warn(`⚠️ Port in use, retrying on port ${currentPort}...`);
    startServer(currentPort);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

// Wait for the database (including any git-sync pull of the latest live CMS
// data) to finish loading before accepting requests, so early requests never
// race a still-loading dataset.
db.ready
  .then(() => startServer(currentPort))
  .catch((err) => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });

