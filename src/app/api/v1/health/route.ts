// Health check (mobile-friendly, no auth, no DB).
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    status: 'ok',
    ts: new Date().toISOString(),
    api: 1,
  })
}
