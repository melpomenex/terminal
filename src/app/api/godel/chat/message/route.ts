import { sendChatMessage } from "@/lib/godel";
export async function POST(req: Request) {
  const body = await req.json();
  const data = await sendChatMessage(body);
  return Response.json(data);
}
