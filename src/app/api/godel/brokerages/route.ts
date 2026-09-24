import { getBrokerages } from "@/lib/godel";
export async function GET() {
  const data = await getBrokerages();
  return Response.json(data);
}
