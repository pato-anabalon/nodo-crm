import { EditBoardPostPage, boardMetadata } from "@/modules/jobs/board/pages";

export async function generateMetadata() {
  return boardMetadata("CONFIDENTIAL", "edit");
}

export default async function Page({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  return <EditBoardPostPage board="CONFIDENTIAL" jobId={id} postId={postId} />;
}
