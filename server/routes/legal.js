import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Terms & Conditions are generated from the Word document by legal/build-terms.mjs.
// The version embeds a hash of the published wording, so every acceptance record
// proves exactly which text the user agreed to.
const legalDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'legal');
const termsHtml = fs.readFileSync(path.join(legalDir, 'terms-and-conditions.html'), 'utf8');
const termsMeta = JSON.parse(fs.readFileSync(path.join(legalDir, 'terms-meta.json'), 'utf8'));
export const TERMS_CONTENT_HASH = crypto.createHash('sha256').update(termsHtml).digest('hex');

export const TERMS_VERSION = `${termsMeta.effectiveDate}.${TERMS_CONTENT_HASH.slice(0, 8)}`;

const router = Router();

router.get('/terms', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ ...termsMeta, version: TERMS_VERSION, contentHash: TERMS_CONTENT_HASH, html: termsHtml });
});

export default router;
