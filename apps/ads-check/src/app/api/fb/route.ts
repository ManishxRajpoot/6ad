import { NextRequest, NextResponse } from 'next/server'

const FB_GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  const token = searchParams.get('token')

  if (!path || !token) {
    return NextResponse.json({ error: 'Missing path or token' }, { status: 400 })
  }

  if (!path.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  // Build Facebook Graph API URL
  const fbUrl = new URL(`${FB_GRAPH_BASE}${path}`)
  fbUrl.searchParams.set('access_token', token)

  // Forward additional query params (fields, limit, summary, etc.)
  searchParams.forEach((value, key) => {
    if (key !== 'path' && key !== 'token') {
      fbUrl.searchParams.set(key, value)
    }
  })

  try {
    const response = await fetch(fbUrl.toString(), {
      headers: { 'User-Agent': '6AD-AdsChecker/1.0' },
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch from Facebook', details: error.message },
      { status: 502 }
    )
  }
}
