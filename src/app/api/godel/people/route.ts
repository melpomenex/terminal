import { searchPeople } from "@/lib/godel";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const data = await searchPeople(q);
  return Response.json(data);
}
