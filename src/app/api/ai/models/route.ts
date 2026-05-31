import { getFreeOpenRouterModels } from "@/lib/ai-builder/free-models";

export async function GET() {
  const models = await getFreeOpenRouterModels();

  return Response.json({
    ok: true,
    models,
  });
}
