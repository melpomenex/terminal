import { getLegalEntities } from "@/lib/godel";
export async function GET(_req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const data = await getLegalEntities(seriesId);
  return Response.json(data);
}
