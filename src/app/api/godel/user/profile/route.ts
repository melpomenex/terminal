import { getUserProfile } from "@/lib/godel";
export async function GET() {
  const data = await getUserProfile();
  return Response.json(data);
}
