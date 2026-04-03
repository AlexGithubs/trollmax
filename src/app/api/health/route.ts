import {
  getProductionDependencyIssues,
  shouldEnforceProductionDeps,
} from "@/lib/runtime/check-production-deps"

export async function GET() {
  const ts = new Date().toISOString()
  const mockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true"

  if (!shouldEnforceProductionDeps()) {
    return Response.json({
      ok: true as const,
      ts,
      mockMode,
      productionDeps: "skipped" as const,
    })
  }

  const { ok, issues } = getProductionDependencyIssues()
  return Response.json(
    {
      ok,
      ts,
      mockMode,
      issues,
      ...(ok
        ? {}
        : {
            hint: "Set missing variables on Vercel → Production. See .env.example and grep logs for ref= on failed /api/soundboard/*/generate requests.",
          }),
    },
    { status: ok ? 200 : 503 }
  )
}
