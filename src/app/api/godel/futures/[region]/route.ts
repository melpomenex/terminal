import { getFutures } from "@/lib/godel";
export async function GET(_req: Request, { params }: { params: Promise<{ region?: string }> }) {
	const { region } = await params;
	const data = await getFutures(region);
	return Response.json(data);
}
