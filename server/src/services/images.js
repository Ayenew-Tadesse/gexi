// Product photos: every upload is converted to WebP in three sizes so phones download as little as possible.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { randomToken } from '../lib/codes.js';

export const IMAGE_SIZES = { small: 320, medium: 640, large: 1200 };

export async function saveProductImage(buffer) {
  const dir = path.join(config.uploadDir, 'products');
  await fs.mkdir(dir, { recursive: true });
  const base = randomToken(10);
  const urls = {};
  for (const [size, width] of Object.entries(IMAGE_SIZES)) {
    const file = `${base}-${size}.webp`;
    await sharp(buffer)
      .rotate() // respect phone camera orientation
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: size === 'small' ? 60 : 72 })
      .toFile(path.join(dir, file));
    urls[`${size}_url`] = `/uploads/products/${file}`;
  }
  return urls;
}

export async function deleteProductImageFiles(image) {
  for (const url of [image.small_url, image.medium_url, image.large_url]) {
    if (!url?.startsWith('/uploads/')) continue;
    await fs.rm(path.join(config.uploadDir, url.replace('/uploads/', '')), { force: true });
  }
}
