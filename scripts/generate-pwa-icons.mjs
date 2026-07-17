/**
 * Generate PWA icons using Canvas API.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')

mkdirSync(iconsDir, { recursive: true })

const SIZES = [16, 32, 64, 180, 192, 512]
const BG = '#2563eb'
const WHITE = '#ffffff'
const BAR = '#93c5fd'

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background (rounded rect)
  const r = size * 0.12
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fillStyle = BG
  ctx.fill()

  // Letter 'L'
  const fontSize = Math.floor(size * 0.55)
  ctx.fillStyle = WHITE
  ctx.font = `bold ${fontSize}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('L', size / 2, size / 2 - size * 0.04)

  // Only draw bars for sizes >= 64
  if (size >= 64) {
    const bar1Y = size * 0.70
    const bar1H = Math.max(2, Math.floor(size * 0.035))
    const bar1W = size * 0.50
    const bar1X = (size - bar1W) / 2
    ctx.fillStyle = BAR
    ctx.globalAlpha = 0.8
    ctx.fillRect(bar1X, bar1Y, bar1W, bar1H)

    const bar2Y = bar1Y + bar1H + size * 0.025
    const bar2H = Math.max(1, Math.floor(size * 0.02))
    const bar2W = size * 0.40
    const bar2X = (size - bar2W) / 2
    ctx.globalAlpha = 0.5
    ctx.fillRect(bar2X, bar2Y, bar2W, bar2H)
    ctx.globalAlpha = 1
  }

  return canvas
}

function main() {
  console.log('Generating PWA icons...\n')

  for (const size of SIZES) {
    const canvas = drawIcon(size)
    const buf = canvas.toBuffer('image/png')

    let filename
    if (size === 180) {
      filename = 'apple-touch-icon.png'
    } else {
      filename = `icon_${size}x${size}.png`
    }

    writeFileSync(join(iconsDir, filename), buf)
    console.log(`  ✅ ${filename} (${size}x${size})`)
  }

  // Also create favicon.ico (32x32 PNG)
  const favCanvas = drawIcon(32)
  writeFileSync(join(iconsDir, 'favicon.ico'), favCanvas.toBuffer('image/png'))
  console.log('  ✅ favicon.ico')

  console.log('\n✅ All icons generated!')
}

main()
