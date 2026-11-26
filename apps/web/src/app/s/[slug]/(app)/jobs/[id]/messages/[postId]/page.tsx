import { BoardPostPage, boardMetadata } from "@/modules/jobs/board/pages";

export async function generateMetadata() {
  return boardMetadata("TEAM", "list");
}

export default async function Page({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  return <BoardPostPage board="TEAM" jobId={id} postId={postId} />;
}
