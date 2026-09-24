import { getBrokerageIntegrations } from "@/lib/godel";
export async function GET() {
  const data = await getBrokerageIntegrations();
  return Response.json(data);
}
