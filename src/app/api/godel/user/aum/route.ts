import { getUserAum } from "@/lib/godel";
export async function GET() {
  const data = await getUserAum();
  return Response.json(data);
}
