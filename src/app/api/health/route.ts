export async function GET() {
  const base = {
    ok: true as const,
    ts: new Date().toISOString(),
  }
  if (process.env.NODE_ENV === "production") {
    return Response.json(base)
  }
  return Response.json({
    ...base,
    mockMode: process.env.NEXT_PUBLIC_MOCK_MODE === "true",
  })
}
