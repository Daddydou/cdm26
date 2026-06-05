import { testSofascore } from '@/app/scripts/test-sofascore'

export async function GET() {
  try {
    const result = await testSofascore()
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
