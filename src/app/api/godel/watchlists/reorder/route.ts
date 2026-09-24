import { reorderWatchlists } from "@/lib/godel";
export async function POST(req: Request) {
	const body = await req.json();
	const data = await reorderWatchlists(body);
	return Response.json(data);
}
