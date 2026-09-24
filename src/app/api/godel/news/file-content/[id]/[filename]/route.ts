import { getNewsFileContent } from "@/lib/godel";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; filename: string }> }) {
  const { id, filename } = await params;
  const data = await getNewsFileContent(id, filename);
  return Response.json(data);
}
