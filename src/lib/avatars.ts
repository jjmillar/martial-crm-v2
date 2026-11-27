import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

// Profile photos (private "avatars" bucket, see migration 20261127000004). The DB keeps the object path; the app
// shows it through short-lived signed URLs. Every photo is re-encoded here: a centred square, 512 px, JPEG. That also
// drops EXIF data (camera, GPS) before anything leaves the device.

const BUCKET = 'avatars'
const SIZE = 512
const TTL = 60 * 60 // seconds a signed URL lives

/** 'Camila Medel' → 'CM' */
export const initialsOf = (name: string | null | undefined) =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

/** Folder of each kind of photo (the database and the storage policies check the same layout). */
export const avatarFolder = {
  student: (schoolId: string, studentId: string) => `${schoolId}/students/${studentId}`,
  teacher: (schoolId: string, teacherId: string) => `${schoolId}/teachers/${teacherId}`,
  user: (userId: string) => `users/${userId}`,
}

/** Centre-crops an image (file or a camera frame) to a square and encodes it as a 512 px JPEG. */
export async function squareJpeg(source: Blob | HTMLVideoElement): Promise<Blob> {
  let img: CanvasImageSource, w: number, h: number
  if (source instanceof Blob) {
    if (!source.type.startsWith('image/')) throw new Error('Elige una imagen (JPG, PNG o similar).')
    if (source.size > 20 * 1024 * 1024) throw new Error('La imagen es muy pesada (máximo 20 MB).')
    const bmp = await loadImage(source)
    img = bmp; w = bmp.naturalWidth; h = bmp.naturalHeight
  } else {
    img = source; w = source.videoWidth; h = source.videoHeight
  }
  if (!w || !h) throw new Error('No se pudo leer la imagen.')
  const side = Math.min(w, h)
  const out = Math.min(SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = out; canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Tu navegador no puede procesar la imagen.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', 0.86))
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir esa imagen. Prueba con una foto JPG o PNG.')) }
    img.src = url
  })
}

/** Uploads a processed photo under the folder with a random name; returns its path. */
export async function uploadAvatar(folder: string, photo: Blob): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' })
  if (error) throw new Error(error.message.toLowerCase().includes('row-level') ? 'No tienes permiso para cambiar esta foto.' : 'No se pudo subir la foto.')
  return path
}

/** Deletes an old photo (best effort: a leftover file is harmless, it is private). */
export async function removeAvatar(path: string | null | undefined): Promise<void> {
  if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined)
}

/** Signed URLs for many photos at once (lists). Paths are unique per upload, so each URL can be reused for its life. */
export function useAvatarUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))].sort()
  const q = useQuery({
    queryKey: ['avatar-urls', list],
    enabled: list.length > 0,
    staleTime: (TTL - 300) * 1000,
    gcTime: (TTL - 300) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(list, TTL)
      if (error) throw error
      return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])))
    },
  })
  return q.data ?? new Map<string, string>()
}

export function useAvatarUrl(path: string | null | undefined): string | null {
  const map = useAvatarUrls([path])
  return path ? map.get(path) ?? null : null
}

/**
 * Replaces (or removes, with null) a photo: uploads the new file, stores its path through `apply`, then deletes the old
 * file. If storing the path fails, the uploaded file is deleted again.
 */
export async function savePhoto({ folder, photo, old, apply }: { folder: string; photo: Blob | null; old?: string | null; apply: (path: string | null) => Promise<unknown> }): Promise<string | null> {
  const path = photo ? await uploadAvatar(folder, photo) : null
  try { await apply(path) } catch (e) { await removeAvatar(path); throw e }
  if (old && old !== path) await removeAvatar(old)
  return path
}
