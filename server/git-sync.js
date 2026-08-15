// =========================================================
// Awara Banjara — GitHub-backed CMS data persistence
// =========================================================
// Several hosting platforms (Render's free tier, Hostinger's Node.js Web
// App redeploys) run this app on a filesystem that gets rebuilt from the
// last GitHub commit on every deploy/restart - any CMS edit saved to the
// local data/*.json files since then is silently lost.
//
// This module uses GitHub's REST Contents API directly (plain fetch, no
// git binary or .git checkout required - both are uncertain to exist in
// a given host's Node runtime) to:
//   1. Pull the latest committed CMS data into data/*.json on boot, before
//      the local database is loaded, so a fresh/rebuilt filesystem starts
//      from whatever was last saved live rather than a stale deploy snapshot.
//   2. Push data/*.json to a dedicated branch (never `main`, so this never
//      triggers a redeploy loop or conflicts with real code changes) a
//      short debounce window after each CMS write, so rapid edits collapse
//      into one commit instead of spamming history.
//   3. Do the same for images uploaded through the CMS (assets/images/trips/)
//      - these used to only ever be written to local disk, so they silently
//      vanished on the very next redeploy even though the data referencing
//      them (postcards.json, trips.json, ...) was safely synced. Pushed
//      right after upload (no debounce - uploads are already a deliberate,
//      infrequent action) and pulled down on boot like the JSON files, but
//      *after* the server starts listening: the image set is unbounded and
//      grows over time, unlike the fixed small set of data files, so it
//      can't share their pre-listen() boot budget without risking the same
//      "didn't call listen() in time" problem that budget was fixed for.
//
// Entirely opt-in: with no GITHUB_SYNC_TOKEN configured, every function
// here is a silent no-op and the app behaves exactly as it did before.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILES = [
  'awarabanjara.json',
  'trips.json',
  'destinations.json',
  'reviews.json',
  'inquiries.json',
  'postcards.json',
  'site_config.json',
  'packages.json'
];

const IMAGE_REPO_DIR = 'assets/images/trips';
const IMAGE_LOCAL_DIR = path.join(__dirname, '..', IMAGE_REPO_DIR);

// Pre-rendered static trip pages (server/prerender.js) used to only ever be
// written to local disk, same class of bug as the images one above: a trip
// added/edited through the live CMS gets a working page in the moment, but
// since it was never committed anywhere, the very next redeploy (which
// rebuilds the filesystem from the last GitHub commit) silently wipes it and
// the trip's link 404s - falling through to the site's catch-all redirect,
// which looks like "clicking it just takes you back to the homepage".
const TRIPS_REPO_DIR = 'trips';
const TRIPS_LOCAL_DIR = path.join(__dirname, '..', TRIPS_REPO_DIR);

const GITHUB_TOKEN = process.env.GITHUB_SYNC_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_SYNC_REPO || '';
const SYNC_BRANCH = process.env.GIT_SYNC_BRANCH || 'live-data';
const DEBOUNCE_MS = 20 * 1000;
const API_BASE = 'https://api.github.com';

const enabled = !!(GITHUB_TOKEN && GITHUB_REPO);

let debounceTimer = null;
let syncInFlight = false;
let syncQueuedAgain = false;

function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'awara-banjara-cms-sync'
  };
}

async function ensureBranchExists() {
  const branchRes = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/branches/${SYNC_BRANCH}`, {
    headers: ghHeaders()
  });
  if (branchRes.ok) return true;
  if (branchRes.status !== 404) {
    console.warn(`⚠️ Git-sync: could not check branch '${SYNC_BRANCH}' (HTTP ${branchRes.status})`);
    return false;
  }

  // Branch doesn't exist yet - create it off the default branch's current commit.
  const repoRes = await fetch(`${API_BASE}/repos/${GITHUB_REPO}`, { headers: ghHeaders() });
  if (!repoRes.ok) return false;
  const repoInfo = await repoRes.json();
  const defaultBranch = repoInfo.default_branch || 'main';

  const refRes = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/ref/heads/${defaultBranch}`, {
    headers: ghHeaders()
  });
  if (!refRes.ok) return false;
  const refInfo = await refRes.json();

  const createRes = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/refs`, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${SYNC_BRANCH}`, sha: refInfo.object.sha })
  });
  if (!createRes.ok) {
    // 422 here almost always means another server instance won the race and created
    // the branch a moment ago - that's success from this instance's point of view too.
    if (createRes.status === 422) return true;
    console.warn(`⚠️ Git-sync: could not create branch '${SYNC_BRANCH}' (HTTP ${createRes.status})`);
    return false;
  }
  console.log(`✅ Git-sync: created '${SYNC_BRANCH}' branch for CMS data sync`);
  return true;
}

async function getRemoteFile(filename) {
  const res = await fetch(
    `${API_BASE}/repos/${GITHUB_REPO}/contents/data/${filename}?ref=${SYNC_BRANCH}`,
    { headers: ghHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET data/${filename} failed (HTTP ${res.status})`);
  const json = await res.json();
  return { sha: json.sha, content: Buffer.from(json.content, 'base64').toString('utf-8') };
}

async function putRemoteFile(filename, content, sha) {
  const res = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/contents/data/${filename}`, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Auto-sync CMS data: ${filename} — ${new Date().toISOString()}`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: SYNC_BRANCH,
      ...(sha ? { sha } : {})
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PUT data/${filename} failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
}

/**
 * Push one CMS-uploaded image to GitHub right after it's written to local
 * disk. Fire-and-forget from the /api/upload handler - a failure here just
 * means that one image stays local-only (same as the old behavior) until
 * the next successful sync, it never blocks the upload response.
 */
async function pushImage(filename) {
  if (!enabled) return;
  try {
    const localPath = path.join(IMAGE_LOCAL_DIR, filename);
    if (!fs.existsSync(localPath)) return;

    const branchReady = await ensureBranchExists();
    if (!branchReady) return;

    const buffer = fs.readFileSync(localPath);
    const repoPath = `${IMAGE_REPO_DIR}/${filename}`;
    const res = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/contents/${repoPath}`, {
      method: 'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Auto-sync CMS upload: ${filename} — ${new Date().toISOString()}`,
        content: buffer.toString('base64'),
        branch: SYNC_BRANCH
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`PUT ${repoPath} failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }
    console.log(`✅ Git-sync: pushed uploaded image ${filename} to '${SYNC_BRANCH}' branch`);
  } catch (e) {
    console.warn(`⚠️ Git-sync: failed to push image ${filename} -`, e.message);
  }
}

/**
 * Pull down any CMS-uploaded images that exist on the 'live-data' branch but
 * not on this (possibly freshly rebuilt) local disk. Deliberately not part
 * of pullLatestOnBoot()/db.ready - call this after the server is already
 * listening, since the image set is unbounded and this shouldn't gate
 * request-serving readiness. A page whose image hasn't been pulled down yet
 * just briefly 404s and falls back to its placeholder, same as any other
 * still-loading image.
 */
async function pullMissingImagesOnBoot() {
  if (!enabled) return;
  try {
    const res = await fetch(
      `${API_BASE}/repos/${GITHUB_REPO}/contents/${IMAGE_REPO_DIR}?ref=${SYNC_BRANCH}`,
      { headers: ghHeaders() }
    );
    if (res.status === 404) {
      console.log('ℹ️ Git-sync: no synced images yet on GitHub');
      return;
    }
    if (!res.ok) {
      console.warn(`⚠️ Git-sync: could not list ${IMAGE_REPO_DIR} (HTTP ${res.status})`);
      return;
    }
    const entries = await res.json();
    if (!Array.isArray(entries)) return;

    fs.mkdirSync(IMAGE_LOCAL_DIR, { recursive: true });
    const missing = entries.filter((e) => e.type === 'file' && !fs.existsSync(path.join(IMAGE_LOCAL_DIR, e.name)));
    if (missing.length === 0) {
      console.log('✅ Git-sync: all synced images already present locally');
      return;
    }

    const results = await Promise.allSettled(missing.map(async (entry) => {
      const fileRes = await fetch(
        `${API_BASE}/repos/${GITHUB_REPO}/contents/${IMAGE_REPO_DIR}/${entry.name}?ref=${SYNC_BRANCH}`,
        { headers: ghHeaders() }
      );
      if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
      const json = await fileRes.json();
      fs.writeFileSync(path.join(IMAGE_LOCAL_DIR, entry.name), Buffer.from(json.content, 'base64'));
    }));

    const pulled = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - pulled;
    console.log(`✅ Git-sync: pulled ${pulled} image(s) from GitHub${failed ? `, ${failed} failed` : ''}`);
  } catch (e) {
    console.warn('⚠️ Git-sync: image pull failed -', e.message);
  }
}

async function getRemoteTripPage(fileName) {
  const res = await fetch(
    `${API_BASE}/repos/${GITHUB_REPO}/contents/${TRIPS_REPO_DIR}/${fileName}?ref=${SYNC_BRANCH}`,
    { headers: ghHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${TRIPS_REPO_DIR}/${fileName} failed (HTTP ${res.status})`);
  const json = await res.json();
  return { sha: json.sha, content: Buffer.from(json.content, 'base64').toString('utf-8') };
}

async function putRemoteTripPage(fileName, content, sha) {
  const res = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/contents/${TRIPS_REPO_DIR}/${fileName}`, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Auto-sync trip page: ${fileName} — ${new Date().toISOString()}`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: SYNC_BRANCH,
      ...(sha ? { sha } : {})
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PUT ${TRIPS_REPO_DIR}/${fileName} failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
}

/**
 * Push one regenerated static trip page to GitHub right after prerender.js
 * writes it to local disk. Unlike pushImage() (always a brand-new filename,
 * so a blind PUT is safe) a trip's filename is stable across edits, so an
 * update must supply the existing file's sha or GitHub rejects it - fetch it
 * first, same 409/422-retry pattern as doSync() uses for the JSON files.
 */
async function pushTripPage(fileName) {
  if (!enabled) return;
  try {
    const localPath = path.join(TRIPS_LOCAL_DIR, fileName);
    if (!fs.existsSync(localPath)) return;

    const branchReady = await ensureBranchExists();
    if (!branchReady) return;

    const content = fs.readFileSync(localPath, 'utf-8');
    const remote = await getRemoteTripPage(fileName);
    if (remote && remote.content === content) return; // unchanged

    try {
      await putRemoteTripPage(fileName, content, remote ? remote.sha : undefined);
    } catch (e) {
      if (/HTTP 409|HTTP 422/.test(e.message)) {
        const latest = await getRemoteTripPage(fileName);
        await putRemoteTripPage(fileName, content, latest ? latest.sha : undefined);
      } else {
        throw e;
      }
    }
    console.log(`✅ Git-sync: pushed trip page ${fileName} to '${SYNC_BRANCH}' branch`);
  } catch (e) {
    console.warn(`⚠️ Git-sync: failed to push trip page ${fileName} -`, e.message);
  }
}

/**
 * Pull down any pre-rendered trip pages that exist on the 'live-data' branch
 * but not on this (possibly freshly rebuilt) local disk. Same reasoning as
 * pullMissingImagesOnBoot() - runs after listen() since the trip set is
 * unbounded and shouldn't gate request-serving readiness.
 */
async function pullMissingTripPagesOnBoot() {
  if (!enabled) return;
  try {
    const res = await fetch(
      `${API_BASE}/repos/${GITHUB_REPO}/contents/${TRIPS_REPO_DIR}?ref=${SYNC_BRANCH}`,
      { headers: ghHeaders() }
    );
    if (res.status === 404) {
      console.log('ℹ️ Git-sync: no synced trip pages yet on GitHub');
      return;
    }
    if (!res.ok) {
      console.warn(`⚠️ Git-sync: could not list ${TRIPS_REPO_DIR} (HTTP ${res.status})`);
      return;
    }
    const entries = await res.json();
    if (!Array.isArray(entries)) return;

    fs.mkdirSync(TRIPS_LOCAL_DIR, { recursive: true });
    const missing = entries.filter((e) => e.type === 'file' && e.name.endsWith('.html') && !fs.existsSync(path.join(TRIPS_LOCAL_DIR, e.name)));
    if (missing.length === 0) {
      console.log('✅ Git-sync: all synced trip pages already present locally');
      return;
    }

    const results = await Promise.allSettled(missing.map(async (entry) => {
      const fileRes = await fetch(
        `${API_BASE}/repos/${GITHUB_REPO}/contents/${TRIPS_REPO_DIR}/${entry.name}?ref=${SYNC_BRANCH}`,
        { headers: ghHeaders() }
      );
      if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
      const json = await fileRes.json();
      fs.writeFileSync(path.join(TRIPS_LOCAL_DIR, entry.name), Buffer.from(json.content, 'base64').toString('utf-8'));
    }));

    const pulled = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - pulled;
    console.log(`✅ Git-sync: pulled ${pulled} trip page(s) from GitHub${failed ? `, ${failed} failed` : ''}`);
  } catch (e) {
    console.warn('⚠️ Git-sync: trip page pull failed -', e.message);
  }
}

/**
 * Pull the latest committed CMS data down into local data/*.json before the
 * local database loads. Call this once at server startup, before db.js reads
 * any files from disk. Never throws - a failure here just means the app
 * boots from whatever is already on local disk, same as before this feature.
 */
async function pullLatestOnBoot() {
  if (!enabled) return;
  console.log(`🔄 Git-sync: pulling latest CMS data from '${SYNC_BRANCH}' branch...`);

  // Fetch all files in parallel, not sequentially - some hosts (Hostinger's Node.js
  // Web App runtime included) expect listen() to be called within a few seconds of
  // startup, and 8 sequential GitHub API round-trips can eat into that budget enough
  // to trip a "didn't call listen() in time" warning.
  const results = await Promise.allSettled(DATA_FILES.map((filename) => getRemoteFile(filename)));

  let pulled = 0;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  results.forEach((result, i) => {
    const filename = DATA_FILES[i];
    if (result.status === 'fulfilled' && result.value) {
      fs.writeFileSync(path.join(DATA_DIR, filename), result.value.content, 'utf-8');
      pulled++;
    } else if (result.status === 'rejected') {
      console.warn(`⚠️ Git-sync: failed to pull data/${filename} -`, result.reason.message);
    }
  });

  if (pulled > 0) {
    console.log(`✅ Git-sync: pulled ${pulled} data file(s) from GitHub`);
  } else {
    console.log(`ℹ️ Git-sync: nothing to pull yet (branch/files not created on GitHub)`);
  }
}

async function doSync() {
  if (syncInFlight) {
    syncQueuedAgain = true;
    return;
  }
  syncInFlight = true;
  try {
    const branchReady = await ensureBranchExists();
    if (!branchReady) return;

    let pushed = 0;
    for (const filename of DATA_FILES) {
      const localPath = path.join(DATA_DIR, filename);
      if (!fs.existsSync(localPath)) continue;
      const localContent = fs.readFileSync(localPath, 'utf-8');
      try {
        const remote = await getRemoteFile(filename);
        if (remote && remote.content === localContent) continue; // unchanged
        try {
          await putRemoteFile(filename, localContent, remote ? remote.sha : undefined);
        } catch (e) {
          // Multiple server instances can boot around the same time and race to push
          // the same file - a "sha required"/conflict error here usually just means
          // another instance's push landed first. Re-fetch the current sha and retry
          // once before giving up.
          if (/HTTP 409|HTTP 422/.test(e.message)) {
            const latest = await getRemoteFile(filename);
            await putRemoteFile(filename, localContent, latest ? latest.sha : undefined);
          } else {
            throw e;
          }
        }
        pushed++;
      } catch (e) {
        console.warn(`⚠️ Git-sync: failed to push data/${filename} -`, e.message);
      }
    }
    if (pushed > 0) {
      console.log(`✅ Git-sync: pushed ${pushed} changed data file(s) to '${SYNC_BRANCH}' branch`);
    }
  } catch (e) {
    console.warn('⚠️ Git-sync: sync failed -', e.message);
  } finally {
    syncInFlight = false;
    if (syncQueuedAgain) {
      syncQueuedAgain = false;
      doSync();
    }
  }
}

/**
 * Debounced trigger - call this at the end of every CMS write (saveDatabase()).
 * Collapses rapid successive saves into one commit ~DEBOUNCE_MS after the last one.
 */
function scheduleSync() {
  if (!enabled) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    doSync();
  }, DEBOUNCE_MS);
}

if (!enabled) {
  console.log('ℹ️ Git-sync: disabled (set GITHUB_SYNC_TOKEN and GITHUB_SYNC_REPO to enable)');
}

module.exports = { pullLatestOnBoot, scheduleSync, pushImage, pullMissingImagesOnBoot, pushTripPage, pullMissingTripPagesOnBoot, enabled };
