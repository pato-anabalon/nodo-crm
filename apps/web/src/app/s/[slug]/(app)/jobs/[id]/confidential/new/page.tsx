import { NewBoardPostPage, boardMetadata } from "@/modules/jobs/board/pages";

export async function generateMetadata() {
  return boardMetadata("CONFIDENTIAL", "new");
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewBoardPostPage board="CONFIDENTIAL" jobId={id} />;
}
