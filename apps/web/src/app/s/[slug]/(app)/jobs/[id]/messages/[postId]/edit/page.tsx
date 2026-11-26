import { EditBoardPostPage, boardMetadata } from "@/modules/jobs/board/pages";

export async function generateMetadata() {
  return boardMetadata("TEAM", "edit");
}

export default async function Page({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  return <EditBoardPostPage board="TEAM" jobId={id} postId={postId} />;
}
