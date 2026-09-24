import { getUnreadCount } from "@/lib/godel";
export async function GET() {
  const data = await getUnreadCount();
  return Response.json(data);
}
