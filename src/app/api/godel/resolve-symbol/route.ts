import { resolveSymbol } from "@/lib/godel";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "AAPL";
  const source = url.searchParams.get("source") ?? undefined;
  const data = await resolveSymbol(symbol, source);
  return Response.json(data);
}
