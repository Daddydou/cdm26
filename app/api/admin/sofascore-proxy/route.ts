const SOFA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')

  if (!path) {
    return Response.json({ error: 'param path requis' }, { status: 400 })
  }

  const res = await fetch(`https://api.sofascore.com/api/v1/${path}`, {
    headers: SOFA_HEADERS,
    cache: 'no-store',
  })

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
