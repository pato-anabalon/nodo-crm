import { BoardListPage, boardMetadata } from "@/modules/jobs/board/pages";

export async function generateMetadata() {
  return boardMetadata("CONFIDENTIAL", "list");
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <BoardListPage board="CONFIDENTIAL" jobId={id} query={query} />;
}
