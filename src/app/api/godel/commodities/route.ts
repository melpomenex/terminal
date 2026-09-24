import { getCommodities } from "@/lib/godel";
export async function GET() {
	const data = await getCommodities();
	return Response.json(data);
}
