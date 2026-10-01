import TeamDetail from "./team-detail";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamDetail id={id} />;
}