import { getInstrumentsV0 } from "@/lib/godel";
export async function POST(req: Request) {
	const body = await req.json();
	const data = await getInstrumentsV0(body);
	return Response.json(data);
}
