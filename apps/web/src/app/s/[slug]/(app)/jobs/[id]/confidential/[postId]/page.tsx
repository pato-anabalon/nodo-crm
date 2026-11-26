import { BoardPostPage, boardMetadata } from "@/modules/jobs/board/pages";

export async function generateMetadata() {
  return boardMetadata("CONFIDENTIAL", "list");
}

export default async function Page({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  return <BoardPostPage board="CONFIDENTIAL" jobId={id} postId={postId} />;
}
