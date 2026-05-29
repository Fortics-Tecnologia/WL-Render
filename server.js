'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app = express();
const PORT         = process.env.PORT         || 3000;
const NFS_BASE_PATH = process.env.NFS_BASE_PATH || path.join(__dirname, 'storage_local');

// ─── Multer: store uploaded files in memory, we'll write them manually ────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
});

// ─── Static: serve index.html + any other static assets ──────────────────────
app.use(express.static(__dirname, { index: 'index.html' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitise a product name into a safe directory slug.
 * Keeps letters, digits, and hyphens; collapses spaces to hyphens.
 */
function toSlug(name) {
  return (name || 'produto')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64) || 'produto';
}

/**
 * Find the next available versioned directory for a given slug.
 * Returns the full path for the new version and the version label (e.g. "v3").
 */
function resolveVersionedPath(slug) {
  const base = path.join(NFS_BASE_PATH, slug);
  let n = 1;
  while (true) {
    const candidate = path.join(base, `v${n}`);
    if (!fs.existsSync(candidate)) return { dir: candidate, version: `v${n}` };
    n++;
    if (n > 9999) throw new Error('Too many versions for this product');
  }
}

/**
 * Infer a safe canonical filename from the original file name and the field key.
 * E.g. field "logo_lm_lg", originalname "MyLogo.SVG" → "logo_lm_lg.svg"
 */
function canonicalName(fieldname, originalname) {
  const ext = path.extname(originalname || '').toLowerCase() || '.bin';
  return `${fieldname}${ext}`;
}

// ─── POST /api/submit ─────────────────────────────────────────────────────────
const KNOWN_FILE_FIELDS = [
  { name: 'logo_lm_lg', maxCount: 1 },
  { name: 'logo_dm_lg', maxCount: 1 },
  { name: 'logo_lm_sm', maxCount: 1 },
  { name: 'logo_dm_sm', maxCount: 1 },
  { name: 'favicon',    maxCount: 1 },
  { name: 'banner',     maxCount: 1 },
];

app.post('/api/submit', upload.fields(KNOWN_FILE_FIELDS), (req, res) => {
  // ── 1. Parse metadata ──────────────────────────────────────────────────────
  let meta;
  try {
    meta = JSON.parse(req.body.meta || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid meta JSON' });
  }

  const productName = (meta.product_name || '').trim();
  if (!productName) {
    return res.status(400).json({ error: 'product_name is required' });
  }

  // ── 2. Resolve destination directory ──────────────────────────────────────
  const slug = toSlug(productName);
  let dir, version;
  try {
    ({ dir, version } = resolveVersionedPath(slug));
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('mkdir error:', err);
    return res.status(500).json({ error: `Failed to create directory: ${err.message}` });
  }

  // ── 3. Save uploaded image files ──────────────────────────────────────────
  const savedLogos = {};
  const files = req.files || {};
  for (const fieldname of ['logo_lm_lg', 'logo_dm_lg', 'logo_lm_sm', 'logo_dm_sm', 'favicon', 'banner']) {
    const uploaded = files[fieldname]?.[0];
    if (!uploaded) { savedLogos[fieldname] = null; continue; }
    const filename = canonicalName(fieldname, uploaded.originalname);
    try {
      fs.writeFileSync(path.join(dir, filename), uploaded.buffer);
      savedLogos[fieldname] = filename;
    } catch (err) {
      console.error(`writeFile ${fieldname} error:`, err);
      return res.status(500).json({ error: `Failed to save ${fieldname}: ${err.message}` });
    }
  }

  // ── 4. Build and save manifest.json ───────────────────────────────────────
  const manifest = {
    product_name:       productName,
    company_name:       meta.company_name       || '',
    company_cnpj:       meta.company_cnpj       || '',
    footer_content:     meta.footer_content     || '',
    website_url:        meta.website_url        || '',
    terms_of_use:       meta.terms_of_use       || '',
    privacy_policy_url: meta.privacy_policy_url || '',
    app_public_url:     meta.app_public_url     || '',
    logos: {
      LM_LOGO_LG: savedLogos.logo_lm_lg,
      DM_LOGO_LG: savedLogos.logo_dm_lg,
      LM_LOGO_SM: savedLogos.logo_lm_sm,
      DM_LOGO_SM: savedLogos.logo_dm_sm,
      FAVICON:    savedLogos.favicon,
      BANNER:     savedLogos.banner,
    },
    light_mode: meta.light_mode || {},
    dark_mode:  meta.dark_mode  || {},
  };

  try {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  } catch (err) {
    console.error('manifest write error:', err);
    return res.status(500).json({ error: `Failed to save manifest: ${err.message}` });
  }

  // ── 5. Respond ─────────────────────────────────────────────────────────────
  const storagePath = `${NFS_BASE_PATH}/${slug}/${version}`;
  console.log(`[submit] saved → ${storagePath}`);
  return res.json({ success: true, path: storagePath, version, slug });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Theme Lab running on http://0.0.0.0:${PORT}`);
  console.log(`NFS base path: ${NFS_BASE_PATH}`);
});
