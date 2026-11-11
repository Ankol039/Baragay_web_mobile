import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { ApiError } from '../errors.js'
export const decodedBytes = base64 => Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
export async function choosePhoto() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) throw new ApiError('Please allow photo access to select a profile photo.')
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 })
  if (picked.canceled) return null
  const image = picked.assets[0], edge = Math.min(image.width, image.height)
  const crop = { originX: Math.floor((image.width - edge) / 2), originY: Math.floor((image.height - edge) / 2), width: edge, height: edge }
  for (const quality of [0.88, 0.75, 0.6, 0.45, 0.3]) {
    const output = await manipulateAsync(image.uri, [{ crop }, { resize: { width: 256, height: 256 } }], { compress: quality, format: SaveFormat.JPEG, base64: true })
    if (output.base64 && decodedBytes(output.base64) <= 60 * 1024) return `data:image/jpeg;base64,${output.base64}`
  }
  throw new ApiError('The selected photo is too large.')
}
