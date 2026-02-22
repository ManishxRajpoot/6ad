/**
 * Human-like random delay helpers for browser automation.
 * Using random delays instead of fixed waits prevents Facebook
 * from detecting automation patterns.
 */

/** Human-like random delay between min and max milliseconds */
export function humanDelay(minMs: number = 2000, maxMs: number = 6000): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs)
  return new Promise(resolve => setTimeout(resolve, Math.round(delay)))
}

/** Longer delay after page navigations (4-8 seconds) */
export function navigationDelay(): Promise<void> {
  return humanDelay(4000, 8000)
}

/** Short delay after clicks and minor actions (1-3 seconds) */
export function actionDelay(): Promise<void> {
  return humanDelay(1000, 3000)
}

/**
 * Type text character-by-character with human-like random delays.
 * Mimics real typing speed (50-200ms per character).
 */
export async function typeWithDelay(input: any, text: string): Promise<void> {
  for (const char of text) {
    await input.type(char)
    await humanDelay(50, 200)
  }
}
