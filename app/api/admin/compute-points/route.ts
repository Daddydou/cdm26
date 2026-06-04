import { computeMatchPoints } from '@/app/actions/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get('matchId')
  if (!matchId) return Response.json({ error: 'matchId requis' }, { status: 400 })

  const result = await computeMatchPoints(matchId)
  return Response.json(result)
}
