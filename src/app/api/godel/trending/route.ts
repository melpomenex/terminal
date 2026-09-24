import { getTrending } from "@/lib/godel";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getTrending(url.searchParams.get("timeframe") ?? "day");
  return Response.json(data);
}
