import { realpath, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { ROOT, inside, requireSafe } from './safety.mjs'
import { uid } from './model.mjs'
export async function exportPhotos(tables) {
  const photos = [], warnings = { missingPhotoFiles: 0 }
  const allowedRoot = resolve(ROOT, 'uploads')
  for (const kind of ['resident', 'staff']) for (const r of tables[kind === 'resident' ? 'residents' : 'staff']) {
    if (!r.photo_path) continue
    const candidate = resolve(ROOT, r.photo_path)
    requireSafe(inside(allowedRoot, candidate), 'UNSAFE_SOURCE_PHOTO_PATH')
    let path
    try { path = await realpath(candidate) } catch (e) { if (e.code !== 'ENOENT') throw e; warnings.missingPhotoFiles++; continue }
    requireSafe(inside(await realpath(allowedRoot), path), 'UNSAFE_SOURCE_PHOTO_PATH')
    const input = await readFile(path)
    const encoded = await compressAvatar(input)
    photos.push({ ownerUid: uid(kind, r[`${kind}_id`]), mimeType: 'image/jpeg', base64: encoded, sourceCreatedAt: r.created_at })
  }
  return { photos, warnings }
}

export async function compressAvatar(input) {
  let encoded
  for (const quality of [80, 65, 45]) {
    encoded = (await sharp(input, { limitInputPixels: 40000000 }).rotate().resize(320, 320, { fit: 'cover', withoutEnlargement: true }).jpeg({ quality }).toBuffer()).toString('base64')
    if (encoded.length <= 131072) return encoded
  }
  requireSafe(false, 'PHOTO_TOO_LARGE_AFTER_COMPRESSION')
}
