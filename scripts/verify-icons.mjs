import { readFile } from 'node:fs/promises'

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512]

function pngDimensions(buffer, path) {
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`${path} is not a PNG file.`)
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

const sourcePath = 'icon.png'
const source = pngDimensions(await readFile(sourcePath), sourcePath)
if (source.width !== source.height || source.width < 512) {
  throw new Error(`${sourcePath} must be a square PNG at least 512px wide.`)
}

for (const size of iconSizes) {
  const path = `public/icon-${size}x${size}.png`
  const dimensions = pngDimensions(await readFile(path), path)
  if (dimensions.width !== size || dimensions.height !== size) {
    throw new Error(
      `${path} must be ${size}x${size}; found ${dimensions.width}x${dimensions.height}.`,
    )
  }
}

console.log(`Verified icon.png and ${iconSizes.length} generated PWA icons.`)
