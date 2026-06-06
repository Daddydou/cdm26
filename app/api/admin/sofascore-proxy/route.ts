const SOFA_HEADERS = {
  'User-Agent':        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':            'application/json, text/plain, */*',
  'Accept-Language':   'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding':   'gzip, deflate, br',
  'Referer':           'https://www.sofascore.com/',
  'Origin':            'https://www.sofascore.com',
  'sec-ch-ua':         '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile':  '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest':    'empty',
  'sec-fetch-mode':    'cors',
  'sec-fetch-site':    'same-site',
  'Cache-Control':     'no-cache',
  'Pragma':            'no-cache',
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
