import { getResearchReports } from "@/lib/godel";
export async function GET() {
  const data = await getResearchReports();
  return Response.json(data);
}
