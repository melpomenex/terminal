import { getFxPairs } from "@/lib/godel";
export async function GET() {
	const data = await getFxPairs();
	return Response.json(data);
}
