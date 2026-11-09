import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useRef, useState } from "react";
import { api, ApiError, type Auth } from "./api";
import { useAuth } from "./session";
import { blobPut, mediaName, pickedKind, planPhoto, thumbnailName, thumbnailSize, type UploadGrant } from "./upload-rules";

/**
 * Photos, videos and documents from the phone into a job, the way the web's uploader
 * does it: the file goes **straight to the store**, never through a function
 * (4.5 MB is less than one photo). The server hands out a token for one file
 * at a path it builds, the phone PUTs the bytes, and what came back travels
 * with the message, the comment or the Docs filing — where it is checked all
 * over again before a row is written.
 */

/** What a to-do, a comment, a chat message or Docs is sent: the web's `UploadedFile`. */
export type UploadedFile = {
  url: string;
  pathname: string;
  name: string;
  width: number | null;
  height: number | null;
  thumbnail: { url: string; pathname: string } | null;
};

/** A file chosen on the phone, whichever picker it came from. */
export type PickedFile = {
  uri: string;
  name: string | null;
  mimeType: string | null;
  size: number | null;
  /** Zero when the picker doesn't know, as for a photo chosen from Files. */
  width: number;
  height: number;
  kind: "image" | "video" | "document";
};

export type PickResult = { files: PickedFile[] } | { denied: true };

function fromMedia(asset: ImagePicker.ImagePickerAsset): PickedFile {
  return {
    uri: asset.uri,
    name: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
    size: asset.fileSize ?? null,
    width: asset.width,
    height: asset.height,
    kind: asset.type === "video" || asset.type === "pairedVideo" ? "video" : "image",
  };
}

/** The camera asks first; the library uses the system picker, which needs no permission to choose from. */
export async function pickMedia(source: "camera" | "library"): Promise<PickResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images", "videos"],
    quality: 1,
    exif: false,
    // A HEIC photo arrives as a JPEG, which the store takes; drawn again below if it's large.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { denied: true };
    const result = await ImagePicker.launchCameraAsync(options);
    return { files: result.canceled ? [] : result.assets.map(fromMedia) };
  }
  const result = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 20 });
  return { files: result.canceled ? [] : result.assets.map(fromMedia) };
}

/** Plans, PDFs and spreadsheets from Files, Drive or wherever the phone keeps them; copied to the cache so they can be streamed. */
export async function pickDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
    width: 0,
    height: 0,
    kind: pickedKind(asset.name),
  }));
}

/**
 * One file, prepared and put in the store: a photo with its gallery copy
 * beside it, a video or a document as it is. A document gets no picture — the
 * web draws a PDF's cover in the browser, which a phone has no light way to do.
 */
export async function uploadFile(auth: Auth, jobId: string, file: PickedFile, onProgress: (fraction: number) => void): Promise<UploadedFile> {
  if (file.kind !== "image") {
    const name = file.kind === "video" ? mediaName({ name: file.name, mimeType: file.mimeType, kind: "video" }, new Date()) : (file.name ?? "file");
    const size = file.size ?? (await sizeOf(file.uri));
    const stored = await put(auth, jobId, { uri: file.uri, name, size }, false, onProgress);
    return { ...stored, name, width: file.width || null, height: file.height || null, thumbnail: null };
  }

  const name = mediaName({ name: file.name, mimeType: file.mimeType, kind: "image" }, new Date());
  // Files doesn't say how big a photo is; drawing it once does.
  const source = file.width ? file : { ...file, ...(await measure(file.uri)) };
  const plan = planPhoto({ name, mimeType: file.mimeType, kind: "image", size: file.size ?? 0, width: source.width, height: source.height });
  const photo = plan.reencode ? await draw(file.uri, plan.resize, plan.format === "webp" ? SaveFormat.WEBP : SaveFormat.JPEG) : source;
  const thumb = await draw(photo.uri, thumbnailSize(photo.width, photo.height), SaveFormat.JPEG, 0.7);

  const thumbnail = await put(auth, jobId, { uri: thumb.uri, name: thumbnailName(plan.name), size: await sizeOf(thumb.uri) }, true);
  const size = plan.reencode ? await sizeOf(photo.uri) : (file.size ?? (await sizeOf(file.uri)));
  const stored = await put(auth, jobId, { uri: photo.uri, name: plan.name, size }, false, onProgress);
  return { ...stored, name: plan.name, width: photo.width, height: photo.height, thumbnail };
}

async function measure(uri: string) {
  const image = await ImageManipulator.manipulate(uri).renderAsync();
  return { width: image.width, height: image.height };
}

async function draw(uri: string, size: { width: number; height: number } | null, format: SaveFormat, compress = 0.82) {
  const context = ImageManipulator.manipulate(uri);
  if (size) context.resize(size);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format, compress });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

async function sizeOf(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? info.size : 0;
}

/**
 * Asks for the token — which is where a type or a size the job won't take is
 * refused, before a byte goes anywhere — then streams the file from disk.
 */
async function put(
  auth: Auth,
  jobId: string,
  file: { uri: string; name: string; size: number },
  thumbnail: boolean,
  onProgress?: (fraction: number) => void,
): Promise<{ url: string; pathname: string }> {
  const grant = await api<UploadGrant>(`/jobs/${jobId}/uploads`, {
    method: "POST",
    body: { name: file.name, size: file.size, thumbnail },
    auth,
  });
  const { url, headers } = blobPut(grant, file.size);
  const task = FileSystem.createUploadTask(
    url,
    file.uri,
    { httpMethod: "PUT", uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers },
    onProgress ? ({ totalBytesSent, totalBytesExpectedToSend }) => onProgress(totalBytesSent / (totalBytesExpectedToSend || 1)) : undefined,
  );
  const result = await task.uploadAsync().catch(() => null);
  if (!result) throw new ApiError(0, "network");
  if (result.status < 200 || result.status >= 300) throw new ApiError(result.status, "upload_failed");
  const stored = JSON.parse(result.body) as { url: string; pathname: string };
  return { url: stored.url, pathname: stored.pathname };
}

export type Attachment = {
  key: string;
  /** What the strip shows while it goes up: the picked file itself. */
  preview: string;
  name: string | null;
  kind: PickedFile["kind"];
  status: "uploading" | "done" | "failed";
  progress: number;
  error?: unknown;
  upload?: UploadedFile;
};

/**
 * The files being attached to something still being written. They start going
 * up the moment they're picked, as on the web, so pressing Send only sends the
 * words; `ready` is what to post, and `busy` holds the button until it's all up.
 */
export function useAttachments(jobId: string) {
  const auth = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const assets = useRef(new Map<string, PickedFile>());

  const patch = useCallback((key: string, change: Partial<Attachment>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  const start = useCallback(
    async (key: string): Promise<UploadedFile | null> => {
      const asset = assets.current.get(key);
      if (!asset) return null;
      patch(key, { status: "uploading", progress: 0, error: undefined });
      try {
        const upload = await uploadFile(auth, jobId, asset, (progress) => patch(key, { progress }));
        patch(key, { status: "done", progress: 1, upload });
        return upload;
      } catch (error) {
        patch(key, { status: "failed", error });
        return null;
      }
    },
    [auth, jobId, patch],
  );

  /** Resolves with what went up, once every one of these has finished or failed. */
  const add = useCallback(
    async (picked: PickedFile[]): Promise<UploadedFile[]> => {
      const added = picked.map((file, index): Attachment => {
        const key = `${Date.now()}-${index}-${file.uri}`;
        assets.current.set(key, file);
        return { key, preview: file.uri, name: file.name, kind: file.kind, status: "uploading", progress: 0 };
      });
      setItems((current) => [...current, ...added]);
      const done = await Promise.all(added.map((item) => start(item.key)));
      return done.filter((upload): upload is UploadedFile => upload !== null);
    },
    [start],
  );

  const remove = useCallback((key: string) => {
    assets.current.delete(key);
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  /** Takes off the ones that were sent with something, leaving any that failed. */
  const drop = useCallback((sent: UploadedFile[]) => {
    const urls = new Set(sent.map((upload) => upload.url));
    setItems((current) => current.filter((item) => !(item.upload && urls.has(item.upload.url))));
  }, []);

  const clear = useCallback(() => {
    assets.current.clear();
    setItems([]);
  }, []);

  return {
    items,
    ready: items.flatMap((item) => (item.upload ? [item.upload] : [])),
    busy: items.some((item) => item.status === "uploading"),
    failed: items.some((item) => item.status === "failed"),
    add,
    retry: start,
    remove,
    drop,
    clear,
  };
}
