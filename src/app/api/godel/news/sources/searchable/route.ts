import { getSearchableNewsSources } from "@/lib/godel";
export async function GET() {
  const data = await getSearchableNewsSources();
  return Response.json(data);
}
