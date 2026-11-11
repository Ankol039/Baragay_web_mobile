import { ApiError } from '../../api/client.js'

const limit = 60 * 1024
const failed = 'Unable to prepare the resized photo. Please try again.'
export async function compressProfilePhoto(file) {
  if (!(file instanceof Blob) || !file.size) throw new ApiError('Please select a photo to upload.')
  const image = new Image(), url = URL.createObjectURL(file)
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new ApiError('Uploaded file must be a valid image.'))
      image.src = url
    })
    // The existing cropper supplies a square JPEG. Do not upscale small crops.
    const size = Math.min(256, image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    // Resize the entire square crop, preserving the user's composition.
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, size, size)
    let blob
    for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.26, 0.16]) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= limit) break
    }
    if (!blob || blob.size > limit) throw new ApiError(failed)
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new ApiError(failed))
      reader.readAsDataURL(blob)
    })
  } finally { URL.revokeObjectURL(url) }
}
