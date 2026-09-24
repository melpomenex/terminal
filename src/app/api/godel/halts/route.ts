import { getHalts } from "@/lib/godel";
export async function GET() {
  const data = await getHalts();
  return Response.json(data);
}
