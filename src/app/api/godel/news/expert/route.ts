import { getExpertNarratives } from "@/lib/godel";
export async function GET() {
  const data = await getExpertNarratives();
  return Response.json(data);
}
