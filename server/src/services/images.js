// Product photos: every upload is converted to WebP in three sizes so phones download as little as possible.
// The files are kept in the database (table stored_files) and served at /uploads/<path>.
import sharp from 'sharp';
import { db } from '../db/knex.js';
import { randomToken } from '../lib/codes.js';

export const IMAGE_SIZES = { small: 320, medium: 640, large: 1200 };

export async function saveProductImage(buffer) {
  const base = randomToken(10);
  const urls = {};
  const rows = [];
  for (const [size, width] of Object.entries(IMAGE_SIZES)) {
    const data = await sharp(buffer)
      .rotate() // respect phone camera orientation
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: size === 'small' ? 60 : 72 })
      .toBuffer();
    const path = `products/${base}-${size}.webp`;
    rows.push({ path, content_type: 'image/webp', data });
    urls[`${size}_url`] = `/uploads/${path}`;
  }
  await db('stored_files').insert(rows);
  return urls;
}

export async function deleteProductImageFiles(image) {
  const paths = [image.small_url, image.medium_url, image.large_url]
    .filter((url) => url?.startsWith('/uploads/'))
    .map((url) => url.replace('/uploads/', ''));
  if (paths.length) await db('stored_files').whereIn('path', paths).delete();
}

export async function readStoredFile(path) {
  return db('stored_files').where({ path }).first();
}
