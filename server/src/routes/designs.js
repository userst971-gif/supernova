import { Router } from 'express';
import { unlinkSync } from 'node:fs';
import { db, mapDesign } from '../db.js';
import { requireStaff, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

/* ---------------------------------------------------------------------------
 * AI design generation (multi-provider, kept from the original prototype).
 * ------------------------------------------------------------------------- */

const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

const EDEN_PROVIDER = process.env.EDENAI_PROVIDER || 'openai';
const EDEN_RESOLUTION = process.env.EDENAI_RESOLUTION || '1024x1024';

function buildSystemPrompt(prompt) {
  return (
    'Create a single clean, bold graphic for a premium fashion garment print. ' +
    'Flat screen-print style artwork on a plain white background, strong silhouette, ' +
    'high contrast, no watermark, no border, no mockup, no photorealistic scene. ' +
    `Design brief: ${prompt}`
  );
}

function apiError(status, userMessage, raw) {
  return Object.assign(new Error(userMessage), { status, userMessage, raw });
}

async function generateWithStability(prompt) {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return { skipped: true };

  const form = new FormData();
  form.append('model', process.env.STABILITY_IMAGE_MODEL || 'stable-image-core');
  form.append('prompt', buildSystemPrompt(prompt));
  form.append('aspect_ratio', process.env.STABILITY_ASPECT_RATIO || '1:1');
  form.append('output_format', 'png');

  let resp;
  try {
    resp = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      body: form,
    });
  } catch {
    throw apiError(502, 'AI generation failed — could not reach the Stability AI API.');
  }

  const txt = await resp.text().catch(() => '');
  let data = {};
  try {
    data = JSON.parse(txt);
  } catch {
    data = {};
  }
  if (!resp.ok) {
    const apiMsg = data?.message || data?.error || data?.name || data?.errors?.[0] || '';
    if (resp.status === 401 || resp.status === 403) {
      throw apiError(resp.status, 'AI generation failed — the Stability AI API key was rejected. Check STABILITY_API_KEY in server/.env.', txt);
    }
    if (resp.status === 402 || /no credit|insufficient.*balance|billing|payment/i.test(apiMsg)) {
      throw apiError(402, 'AI generation failed — the Stability AI account has no credit left. Top up the balance at stability.ai, then try again.', txt);
    }
    if (resp.status === 429) {
      throw apiError(429, 'AI generation is temporarily over capacity — the Stability AI rate limit was hit. Wait a moment and try again.', txt);
    }
    throw apiError(resp.status, apiMsg ? `AI generation failed: ${apiMsg}` : 'AI generation failed.', txt);
  }

  const b64 = data.image;
  if (!b64) {
    throw apiError(502, 'The model returned no image. Try a different prompt.', '');
  }
  return { imageDataUrl: `data:image/png;base64,${b64}` };
}

async function generateWithOpenAi(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { skipped: true };

  const resp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      prompt: buildSystemPrompt(prompt),
      n: 1,
      size: '1024x1024',
      quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
      output_format: 'png',
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    let apiMsg = '';
    try {
      apiMsg = JSON.parse(txt)?.error?.message || '';
    } catch {
      apiMsg = txt.slice(0, 300);
    }
    if (resp.status === 401 || resp.status === 403) {
      throw apiError(resp.status, 'AI generation failed — the OpenAI API key was rejected. Check OPENAI_API_KEY in server/.env.', txt);
    }
    if (resp.status === 429) {
      const noCredits = /no credits|billing|balance/i.test(apiMsg);
      throw apiError(
        resp.status,
        noCredits
          ? 'AI generation failed — the OpenAI account has no credits left. Add credits at platform.openai.com, then try again.'
          : 'AI generation is temporarily over capacity — the OpenAI rate limit was hit. Wait a moment and try again.',
        txt
      );
    }
    throw apiError(resp.status, apiMsg ? `AI generation failed: ${apiMsg}` : 'AI generation failed.', txt);
  }

  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw apiError(502, 'The model returned no image. Try a different prompt.', '');
  }
  return { imageDataUrl: `data:image/png;base64,${b64}` };
}

async function generateWithEdenAi(prompt) {
  const apiKey = process.env.EDENAI_API_KEY;
  if (!apiKey) return { skipped: true };

  const resp = await fetch('https://api.edenai.run/v2/image/generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      providers: [EDEN_PROVIDER],
      text: buildSystemPrompt(prompt),
      resolution: EDEN_RESOLUTION,
      num_images: 1,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    let detail = '';
    try {
      detail = JSON.parse(txt)?.detail || txt.slice(0, 300);
    } catch {
      detail = txt.slice(0, 300);
    }
    if (resp.status === 402) {
      throw apiError(402, 'AI generation failed — the Eden AI account has no credit left. Top up the balance at edenai.co, then try again.', txt);
    }
    if (resp.status === 401 || resp.status === 403) {
      throw apiError(resp.status, 'AI generation failed — the Eden AI API key was rejected. Check EDENAI_API_KEY in server/.env.', txt);
    }
    if (resp.status === 429) {
      throw apiError(429, 'AI generation is temporarily over capacity — the Eden AI rate limit was hit. Try again later.', txt);
    }
    throw apiError(resp.status, detail || 'AI generation failed.', txt);
  }

  const data = await resp.json();
  const provider = data?.[EDEN_PROVIDER];
  if (!provider || provider.status !== 'success') {
    const reason = provider?.status || 'unknown';
    throw apiError(502, `The provider returned no image (${reason}). Try a different prompt.`, '');
  }

  let image = provider.items?.[0]?.image;
  if (!image && provider.items?.[0]?.image_resource_url) {
    const imgResp = await fetch(provider.items[0].image_resource_url);
    if (!imgResp.ok) {
      throw apiError(502, 'The generated image could not be downloaded.', '');
    }
    const buf = Buffer.from(await imgResp.arrayBuffer());
    image = buf.toString('base64');
  }
  if (!image) {
    throw apiError(502, 'The provider returned no image. Try a different prompt.', '');
  }
  const dataUrl = /^data:/i.test(image) ? image : `data:image/png;base64,${image}`;
  return { imageDataUrl: dataUrl };
}

async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { skipped: true };

  const buildBody = (extra) => ({
    contents: [{ parts: [{ text: buildSystemPrompt(prompt) }] }],
    generationConfig: { responseModalities: ['IMAGE'], ...extra },
  });

  const call = async (body) => {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      const err = new Error(`Gemini ${resp.status}: ${txt.slice(0, 400)}`);
      err.status = resp.status;
      throw err;
    }
    return resp.json();
  };

  let data;
  try {
    data = await call(buildBody({ imageConfig: { aspectRatio: '1:1' } }));
  } catch (err) {
    if (err.status === 400) {
      data = await call(buildBody({}));
    } else {
      throw err;
    }
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const image = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!image) {
    const reason = data?.candidates?.[0]?.finishReason || 'unknown';
    throw apiError(502, `The model returned no image (${reason}). Try a different prompt.`, '');
  }

  const mime = image.inlineData.mimeType || 'image/png';
  return { imageDataUrl: `data:${mime};base64,${image.inlineData.data}` };
}

/**
 * Keyless free fallback (Pollinations, image.pollinations.ai) — no signup and
 * no credit required, so AI generation keeps working when every paid account is
 * out of balance. Tried last (quality is lower than the paid models). Disable
 * with POLLINATIONS_ENABLED=0.
 */
async function generateWithPollinations(prompt) {
  const model = process.env.POLLINATIONS_MODEL || 'flux';
  const url =
    'https://image.pollinations.ai/prompt/' +
    encodeURIComponent(buildSystemPrompt(prompt)) +
    `?width=1024&height=1024&nologo=true&model=${encodeURIComponent(model)}&seed=random`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let resp;
  try {
    resp = await fetch(url, { headers: { Accept: 'image/*' }, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw apiError(502, 'AI generation timed out — the free fallback service is slow right now. Try again shortly.');
    }
    throw apiError(502, 'AI generation failed — could not reach the free fallback image service.');
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw apiError(resp.status, `AI generation failed — the free fallback service returned HTTP ${resp.status}.`, txt.slice(0, 300));
  }

  const contentType = resp.headers.get('content-type') || '';
  if (!/image/i.test(contentType)) {
    const txt = await resp.text().catch(() => '');
    let msg = 'The free fallback image service returned no image. Try a different prompt.';
    try {
      const j = JSON.parse(txt);
      if (j.error) msg = `AI generation failed — ${j.error}`;
    } catch {
      /* keep default */
    }
    throw apiError(502, msg, txt.slice(0, 300));
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < 1000) {
    throw apiError(502, 'The free fallback image service returned an empty image.');
  }
  const mime = contentType.includes('jpeg') ? 'image/jpeg' : 'image/png';
  return { imageDataUrl: `data:${mime};base64,${buf.toString('base64')}` };
}

const providers = [
  { name: 'Stability AI', key: 'STABILITY_API_KEY', run: generateWithStability },
  { name: 'OpenAI', key: 'OPENAI_API_KEY', run: generateWithOpenAi },
  { name: 'Eden AI', key: 'EDENAI_API_KEY', run: generateWithEdenAi },
  { name: 'Gemini', key: 'GEMINI_API_KEY', run: generateWithGemini },
  { name: 'Pollinations (free)', key: null, run: generateWithPollinations },
];

router.post('/generate', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim().slice(0, 600);
    if (!prompt) return res.status(400).json({ error: 'Describe the design you want to create.' });

    // Pollinations needs no key; the paid providers only count if configured.
    const available = providers.filter((p) => (p.key ? process.env[p.key] : process.env.POLLINATIONS_ENABLED !== '0'));
    if (!available.length) {
      return res.status(501).json({
        error:
          'AI generation is not configured yet. Add STABILITY_API_KEY, OPENAI_API_KEY, EDENAI_API_KEY or GEMINI_API_KEY to server/.env to enable it (a keyless free fallback is always on unless POLLINATIONS_ENABLED=0).',
      });
    }

    // Try every configured provider. A hard failure from one (no credits,
    // rejected key, rate limit…) must NOT abort the chain — fall through to the
    // next provider so a single dead account can't kill generation.
    const hardFailures = [];
    let lastError = null;
    for (const provider of available) {
      try {
        const out = await provider.run(prompt);
        if (!out.skipped) return res.json(out);
      } catch (err) {
        const status = err.status || 502;
        lastError = err;
        if (status < 500 && status >= 400) {
          hardFailures.push({ provider: provider.name, status, message: err.userMessage || err.message });
        }
      }
    }

    // All providers failed. Prefer a concrete 4xx reason (e.g. "no credits")
    // if any provider hit one, otherwise report the generic failure.
    if (hardFailures.length) {
      const hard = hardFailures[0];
      return res.status(hard.status).json({ error: hard.message });
    }
    res.status(502).json({
      error: lastError?.userMessage || 'All configured AI providers failed. Try a different prompt or check the provider keys in server/.env.',
    });
  } catch (err) {
    const status = err.status || 502;
    res.status(status).json({ error: err.userMessage || err.message || 'AI generation failed.' });
  }
});

/* ---------------------------------------------------------------------------
 * Design library (persisted artwork) + customizations (placement on a product).
 * ------------------------------------------------------------------------- */

function mapDesignDetail(row) {
  const design = mapDesign(row);
  design.versions = db
    .prepare('SELECT * FROM design_versions WHERE design_id = ? ORDER BY id ASC')
    .all(design.id);
  design.customizations = db
    .prepare(
      `SELECT c.*, p.name AS product_name, p.slug AS product_slug, v.size, v.color, v.sku, v.price
       FROM customizations c
       JOIN products p ON p.id = c.product_id
       LEFT JOIN product_variants v ON v.id = c.variant_id
       WHERE c.design_id = ?
       ORDER BY c.id DESC`
    )
    .all(design.id)
    .map((c) => ({ ...c, settings: parseSettings(c.settings) }));
  return design;
}

function parseSettings(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function ownsOrStaff(req, design) {
  if (!design) return false;
  return ['admin', 'staff'].includes(req.user?.role) || design.user_id === req.user?.id;
}

router.get('/', optionalAuth, (req, res) => {
  const mine = req.user && !['admin', 'staff'].includes(req.user.role);
  const rows = mine
    ? db.prepare("SELECT * FROM designs WHERE user_id = ? AND archived = 0 ORDER BY updated_at DESC").all(req.user.id)
    : db.prepare("SELECT * FROM designs WHERE archived = 0 ORDER BY updated_at DESC").all();
  res.json({ designs: rows.map(mapDesignDetail) });
});

router.post('/', optionalAuth, upload.single('file'), (req, res) => {
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : String(req.body?.image_url || '').trim();
  if (!imageUrl) {
    if (req.file) { try { unlinkSync(req.file.path); } catch { /* keep going */ } }
    return res.status(400).json({ error: 'An image (uploaded file or image_url) is required' });
  }

  const name = String(req.body?.name || 'Untitled design').trim().slice(0, 120);
  const prompt = String(req.body?.prompt || '').trim().slice(0, 2000);
  const source = req.body?.source === 'AI_GENERATED' ? 'AI_GENERATED' : 'UPLOADED';

  const info = db
    .prepare(
      `INSERT INTO designs (user_id, name, image_url, source, prompt, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(req.user?.id ?? null, name, imageUrl, source, prompt);
  const id = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO design_versions (design_id, image_url, prompt) VALUES (?, ?, ?)').run(id, imageUrl, prompt);

  const design = mapDesignDetail(db.prepare('SELECT * FROM designs WHERE id = ?').get(id));
  res.status(201).json({ design });
});

router.get('/:id', optionalAuth, (req, res) => {
  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(Number(req.params.id));
  if (!design) return res.status(404).json({ error: 'Design not found' });
  if (!ownsOrStaff(req, design)) return res.status(403).json({ error: 'Not your design' });
  res.json({ design: mapDesignDetail(design) });
});

router.patch('/:id', optionalAuth, (req, res) => {
  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(Number(req.params.id));
  if (!design) return res.status(404).json({ error: 'Design not found' });
  if (!ownsOrStaff(req, design)) return res.status(403).json({ error: 'Not your design' });

  const { name, prompt, archived, published } = req.body || {};
  const sets = [];
  const params = [];
  if (name !== undefined) {
    sets.push('name = ?');
    params.push(String(name).trim().slice(0, 120));
  }
  if (prompt !== undefined) {
    sets.push('prompt = ?');
    params.push(String(prompt).trim().slice(0, 2000));
  }
  if (archived !== undefined) {
    sets.push('archived = ?');
    params.push(archived === 'false' || archived === 0 || archived === false ? 0 : 1);
  }
  if (published !== undefined) {
    sets.push('published = ?');
    params.push(published === 'false' || published === 0 || published === false ? 0 : 1);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push("updated_at = datetime('now')");
  params.push(design.id);
  db.prepare(`UPDATE designs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ design: mapDesignDetail(db.prepare('SELECT * FROM designs WHERE id = ?').get(design.id)) });
});

router.post('/:id/versions', optionalAuth, upload.single('file'), (req, res) => {
  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(Number(req.params.id));
  if (!design) return res.status(404).json({ error: 'Design not found' });
  if (!ownsOrStaff(req, design)) return res.status(403).json({ error: 'Not your design' });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : String(req.body?.image_url || '').trim();
  if (!imageUrl) {
    if (req.file) { try { unlinkSync(req.file.path); } catch { /* keep going */ } }
    return res.status(400).json({ error: 'An image is required for a new version' });
  }
  const prompt = String(req.body?.prompt || '').trim().slice(0, 2000);

  db.prepare(
    `INSERT INTO design_versions (design_id, image_url, prompt) VALUES (?, ?, ?)`
  ).run(design.id, imageUrl, prompt);
  db.prepare("UPDATE designs SET image_url = ?, updated_at = datetime('now') WHERE id = ?").run(imageUrl, design.id);
  res.status(201).json({ design: mapDesignDetail(db.prepare('SELECT * FROM designs WHERE id = ?').get(design.id)) });
});

router.delete('/:id', optionalAuth, (req, res) => {
  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(Number(req.params.id));
  if (!design) return res.status(404).json({ error: 'Design not found' });
  if (!ownsOrStaff(req, design)) return res.status(403).json({ error: 'Not your design' });
  db.prepare('DELETE FROM designs WHERE id = ?').run(design.id);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------------------
 * Customizations — a design placed on a garment. No image upload required;
 * colour scheme + print technique are stored as a JSON settings patch, and
 * every edit appends a JSON patch to customization_versions.
 * ------------------------------------------------------------------------- */

const PRINT_AREAS = ['front', 'back', 'sleeve_left', 'sleeve_right', 'chest_left', 'chest_right'];

function applyCustomizationBody(req, body) {
  const { position_x, position_y, scale, rotation, print_area, preview_image_url, settings } = body || {};
  const sets = [];
  const params = [];
  if (position_x !== undefined) { sets.push('position_x = ?'); params.push(Number(position_x) || 0); }
  if (position_y !== undefined) { sets.push('position_y = ?'); params.push(Number(position_y) || 0); }
  if (scale !== undefined) { sets.push('scale = ?'); params.push(Math.max(0.05, Number(scale) || 1)); }
  if (rotation !== undefined) { sets.push('rotation = ?'); params.push(Number(rotation) || 0); }
  if (print_area !== undefined) {
    if (!PRINT_AREAS.includes(String(print_area))) {
      return { error: `print_area must be one of ${PRINT_AREAS.join(', ')}` };
    }
    sets.push('print_area = ?');
    params.push(String(print_area));
  }
  if (preview_image_url !== undefined) { sets.push('preview_image_url = ?'); params.push(String(preview_image_url).slice(0, 1000)); }
  if (settings !== undefined) { sets.push('settings = ?'); params.push(JSON.stringify(settings)); }
  return { sets, params };
}

function customizationDetail(row) {
  if (!row) return null;
  return { ...row, settings: parseSettings(row.settings) };
}

router.post('/customizations', optionalAuth, (req, res) => {
  const { design_id, product_id, variant_id, position_x, position_y, scale, rotation, print_area, preview_image_url, settings } = req.body || {};

  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(Number(design_id));
  if (!design) return res.status(404).json({ error: 'Design not found' });
  if (!ownsOrStaff(req, design)) return res.status(403).json({ error: 'Not your design' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id));
  if (!product) return res.status(404).json({ error: 'Product not found' });

  let variant = null;
  if (variant_id) {
    variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(Number(variant_id), product.id);
    if (!variant) return res.status(404).json({ error: 'Variant not found for this product' });
  }

  const info = db
    .prepare(
      `INSERT INTO customizations
       (design_id, product_id, variant_id, position_x, position_y, scale, rotation, print_area, preview_image_url, settings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      design.id,
      product.id,
      variant?.id ?? null,
      Number(position_x) || 0,
      Number(position_y) || 0,
      Math.max(0.05, Number(scale) || 1),
      Number(rotation) || 0,
      PRINT_AREAS.includes(String(print_area)) ? String(print_area) : 'front',
      String(preview_image_url || '').slice(0, 1000),
      JSON.stringify(settings || {})
    );
  const id = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO customization_versions (customization_id, patch) VALUES (?, ?)').run(id, '{"created":true}');

  const row = db.prepare('SELECT * FROM customizations WHERE id = ?').get(id);
  res.status(201).json({ customization: customizationDetail(row) });
});

router.get('/customizations/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM customizations WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Customization not found' });
  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(row.design_id);
  if (!ownsOrStaff(req, design)) return res.status(403).json({ error: 'Not your customization' });
  row.design = mapDesignDetail(design);
  res.json({ customization: customizationDetail(row) });
});

router.patch('/customizations/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM customizations WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Customization not found' });
  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(row.design_id);
  if (!ownsOrStaff(req, design)) return res.status(403).json({ error: 'Not your customization' });

  const result = applyCustomizationBody(req, req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  if (!result.sets.length) return res.status(400).json({ error: 'Nothing to update' });
  result.params.push(row.id);
  db.prepare(`UPDATE customizations SET ${result.sets.join(', ')} WHERE id = ?`).run(...result.params);

  const patch = JSON.stringify(req.body);
  db.prepare('INSERT INTO customization_versions (customization_id, patch) VALUES (?, ?)').run(row.id, patch);

  const updated = db.prepare('SELECT * FROM customizations WHERE id = ?').get(row.id);
  res.json({ customization: customizationDetail(updated) });
});

router.delete('/customizations/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM customizations WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Customization not found' });
  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(row.design_id);
  if (!ownsOrStaff(req, design)) return res.status(403).json({ error: 'Not your customization' });
  db.prepare('DELETE FROM customizations WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

export default router;
