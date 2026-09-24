import { getMostActive } from "@/lib/godel";
export async function GET() {
  const data = await getMostActive();
  return Response.json(data);
}
