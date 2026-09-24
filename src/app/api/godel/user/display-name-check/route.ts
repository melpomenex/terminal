import { checkDisplayName } from "@/lib/godel";
export async function GET(req: Request) {
	const dn = new URL(req.url).searchParams.get("displayName") ?? "";
	const data = await checkDisplayName(dn);
	return Response.json(data);
}
