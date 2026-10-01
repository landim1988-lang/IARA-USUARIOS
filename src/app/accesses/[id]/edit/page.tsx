import AccessForm from "../../access-form";

export default async function EditAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccessForm accessId={id} />;
}