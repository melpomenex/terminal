import { getNewsSources } from "@/lib/godel";
export async function GET() {
  const data = await getNewsSources();
  return Response.json(data);
}
