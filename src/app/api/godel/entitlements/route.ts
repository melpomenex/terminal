import { getEntitlements } from "@/lib/godel";
export async function GET() {
  const data = await getEntitlements();
  return Response.json(data);
}
