import { getChatMessagesGlobal } from "@/lib/godel";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokens = url.searchParams.get("tokens") ?? "";
  const data = await getChatMessagesGlobal(tokens, {
    size: Number(url.searchParams.get("size")) || undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  return Response.json(data);
}
