import { Link, Stack, useLocalSearchParams } from "expo-router";
import { ChevronRight, Folder as FolderIcon } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { AttachButton, AttachmentStrip } from "@/components/attachments";
import { Button } from "@/components/button";
import { FileGrid } from "@/components/files";
import { ErrorText, Failed, Loading } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { canOn, useFileUploads, useFolder, useJob } from "@/lib/queries";
import { useAttachments, type UploadedFile } from "@/lib/uploads";
import type { Folder } from "@/lib/types";

/**
 * Docs & Files: one folder at a time, each opening as its own screen so the
 * back gesture climbs the tree. Photos, videos and documents added here are
 * filed into the folder on screen as soon as they are up — one timeline line
 * for the batch. Moving and deleting stay on the web for now.
 */
export default function FilesScreen() {
  const { id, folder } = useLocalSearchParams<{ id: string; folder?: string }>();
  const folderId = folder || null;
  const t = useTranslations();
  const errorText = useErrorText();
  const job = useJob(id);
  const contents = useFolder(id, folderId);
  const files = useAttachments(id);
  const register = useFileUploads(id, folderId);
  const spinner = useColor("muted-foreground");
  const canUpload = canOn(job.data, "files.create");

  const file = (uploads: UploadedFile[]) => {
    if (uploads.length) register.mutate(uploads, { onSuccess: () => files.drop(uploads) });
  };

  if (contents.isPending) return <Loading />;
  if (!contents.data) return <Failed text={errorText(contents.error)} retry={() => contents.refetch()} retryLabel={t("mobile.retry")} />;

  const { trail, folders, files: stored } = contents.data;
  const empty = folders.length === 0 && stored.length === 0;
  // Filed but not registered: the upload worked and the filing didn't, so it can be tried again on its own.
  const unfiled = !files.busy && !register.isPending && register.isError ? files.ready : [];

  return (
    <>
      <Stack.Screen
        options={{
          title: trail.at(-1)?.name ?? t("jobs.files.title"),
          headerRight: canUpload
            ? () => <AttachButton onPicked={(assets) => void files.add(assets).then(file)} disabled={register.isPending} />
            : undefined,
        }}
      />
      <ScrollView
        contentContainerClassName="gap-section px-gutter pb-section pt-stack"
        refreshControl={<RefreshControl refreshing={contents.isRefetching} onRefresh={() => void contents.refetch()} tintColor={spinner} />}
      >
        {files.items.length ? (
          <View className="gap-stack rounded-xl border border-border bg-card p-card-pad">
            <Text className="text-footnote text-muted-foreground">{t(files.busy || register.isPending ? "jobs.files.uploading" : "jobs.files.upload")}</Text>
            <AttachmentStrip
              items={files.items}
              onRemove={files.remove}
              onRetry={(key) => void files.retry(key).then((upload) => upload && file([upload]))}
            />
            <ErrorText>{register.error ? errorText(register.error) : null}</ErrorText>
            {unfiled.length ? <Button label={t("jobs.files.retry")} variant="secondary" onPress={() => file(unfiled)} /> : null}
          </View>
        ) : null}

        {folders.length ? (
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            {folders.map((child, index) => (
              <FolderRow key={child.id} jobId={id} folder={child} first={index === 0} />
            ))}
          </View>
        ) : null}

        {stored.length ? <FileGrid files={stored} /> : null}
        {empty && !files.items.length ? <Text className="text-center text-callout text-muted-foreground">{t("jobs.files.empty")}</Text> : null}
      </ScrollView>
    </>
  );
}

function FolderRow({ jobId, folder, first }: { jobId: string; folder: Folder; first: boolean }) {
  const t = useTranslations("jobs.files");
  const icon = useColor("brand-ink");
  const chevron = useColor("muted-foreground");
  const counts = [
    folder.fileCount ? t("count", { count: folder.fileCount }) : null,
    folder.folderCount ? t("folderCount", { count: folder.folderCount }) : null,
  ].filter(Boolean);

  return (
    <Link href={{ pathname: "/jobs/[id]/files", params: { id: jobId, folder: folder.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        className={`min-h-16 flex-row items-center gap-3 px-card-pad py-3 active:bg-muted ${first ? "" : "border-t border-border"}`}
      >
        <FolderIcon size={22} color={icon} />
        <View className="flex-1 gap-0.5">
          <Text className="text-headline text-card-foreground">{folder.name}</Text>
          <Text className="text-footnote text-muted-foreground">{counts.length ? counts.join(" · ") : t("empty")}</Text>
        </View>
        <ChevronRight size={20} color={chevron} />
      </Pressable>
    </Link>
  );
}
