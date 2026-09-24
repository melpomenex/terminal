import { getAggregates } from "@/lib/godel";
export async function GET() {
  const data = await getAggregates();
  return Response.json(data);
}
