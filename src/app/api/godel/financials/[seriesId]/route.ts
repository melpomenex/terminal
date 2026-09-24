import { getFinancials } from "@/lib/godel";
export async function GET(_req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const data = await getFinancials(seriesId);
  return Response.json(data);
}
