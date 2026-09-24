import { getInstruments } from "@/lib/godel";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });
  const data = await getInstruments(params);
  return Response.json(data);
}
