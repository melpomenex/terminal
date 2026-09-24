import { getGlobalAum } from "@/lib/godel";
export async function GET() {
  const data = await getGlobalAum();
  return Response.json(data);
}
