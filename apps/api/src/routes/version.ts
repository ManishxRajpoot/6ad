import { Hono } from 'hono'

const version = new Hono()

// This will be updated on each deployment
// Format: YYYYMMDDHHMMSS
const BUILD_VERSION = Date.now().toString()

// GET /version - Returns current build version
version.get('/', (c) => {
  return c.json({
    version: BUILD_VERSION,
    timestamp: new Date().toISOString()
  })
})

export default version
export { BUILD_VERSION }
