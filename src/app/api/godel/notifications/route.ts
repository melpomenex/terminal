import { getNotifications } from "@/lib/godel";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getNotifications({
    size: Number(url.searchParams.get("size")) || undefined,
    beforeCursor: url.searchParams.get("beforeCursor") ?? undefined,
  });
  return Response.json(data);
}
