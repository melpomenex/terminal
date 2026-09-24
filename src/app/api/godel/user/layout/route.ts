import { getUserLayout } from "@/lib/godel";
export async function GET() {
	const data = await getUserLayout();
	return Response.json(data);
}
