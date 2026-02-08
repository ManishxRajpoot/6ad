import sharp from 'sharp'

const EMAIL_LOGO_MAX_WIDTH = 280
const EMAIL_LOGO_MAX_HEIGHT = 56

/**
 * Generates an optimized email-sized version of a base64 logo image.
 * Resizes to fit within 280x56px, outputs compressed PNG (preserves transparency).
 * Returns base64 data URL string or null on failure.
 */
export async function generateEmailLogo(base64DataUrl: string): Promise<string | null> {
  try {
    const matches = base64DataUrl.match(/^data:image\/([\w+]+);base64,(.+)$/)
    if (!matches) return null

    const rawBase64 = matches[2]
    const inputBuffer = Buffer.from(rawBase64, 'base64')

    const outputBuffer = await sharp(inputBuffer)
      .resize({
        width: EMAIL_LOGO_MAX_WIDTH,
        height: EMAIL_LOGO_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ compressionLevel: 6 })
      .toBuffer()

    return `data:image/png;base64,${outputBuffer.toString('base64')}`
  } catch (error) {
    console.error('[IMAGE] Failed to generate email logo:', error)
    return null
  }
}
