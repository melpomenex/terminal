import { getInstrument } from "@/lib/godel";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getInstrument(id);
  return Response.json(data);
}
