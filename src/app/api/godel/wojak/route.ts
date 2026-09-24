import { getWojak } from "@/lib/godel";
export async function GET() {
  const data = await getWojak();
  return Response.json(data);
}
