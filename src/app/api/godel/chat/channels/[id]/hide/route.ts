import { hideChannel } from "@/lib/godel";
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const data = await hideChannel(id);
	return Response.json(data);
}
