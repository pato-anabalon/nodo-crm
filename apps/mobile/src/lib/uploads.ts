import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useRef, useState } from "react";
import { api, ApiError, type Auth } from "./api";
import { useAuth } from "./session";
import { blobPut, mediaName, planPhoto, thumbnailName, thumbnailSize, type UploadGrant } from "./upload-rules";

/**
 * Photos and videos from the phone into a job, the way the web's uploader
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

export type PickResult = { assets: ImagePicker.ImagePickerAsset[] } | { denied: true };

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
    return { assets: result.canceled ? [] : result.assets };
  }
  const result = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 20 });
  return { assets: result.canceled ? [] : result.assets };
}

/** One photo or video, prepared and put in the store, with its gallery copy beside a photo. */
export async function uploadMedia(
  auth: Auth,
  jobId: string,
  asset: ImagePicker.ImagePickerAsset,
  onProgress: (fraction: number) => void,
): Promise<UploadedFile> {
  const kind = asset.type === "video" || asset.type === "pairedVideo" ? "video" : "image";
  const name = mediaName({ name: asset.fileName ?? null, mimeType: asset.mimeType ?? null, kind }, new Date());

  if (kind === "video") {
    const size = asset.fileSize ?? (await sizeOf(asset.uri));
    const stored = await put(auth, jobId, { uri: asset.uri, name, size }, false, onProgress);
    return { ...stored, name, width: asset.width || null, height: asset.height || null, thumbnail: null };
  }

  const plan = planPhoto({ name, mimeType: asset.mimeType ?? null, kind, size: asset.fileSize ?? 0, width: asset.width, height: asset.height });
  const photo = plan.reencode ? await draw(asset.uri, plan.resize, plan.format === "webp" ? SaveFormat.WEBP : SaveFormat.JPEG) : asset;
  const thumb = await draw(photo.uri, thumbnailSize(photo.width, photo.height), SaveFormat.JPEG, 0.7);

  const thumbnail = await put(auth, jobId, { uri: thumb.uri, name: thumbnailName(plan.name), size: await sizeOf(thumb.uri) }, true);
  const size = plan.reencode ? await sizeOf(photo.uri) : (asset.fileSize ?? (await sizeOf(asset.uri)));
  const stored = await put(auth, jobId, { uri: photo.uri, name: plan.name, size }, false, onProgress);
  return { ...stored, name: plan.name, width: photo.width, height: photo.height, thumbnail };
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
  kind: "image" | "video";
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
  const assets = useRef(new Map<string, ImagePicker.ImagePickerAsset>());

  const patch = useCallback((key: string, change: Partial<Attachment>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  const start = useCallback(
    async (key: string): Promise<UploadedFile | null> => {
      const asset = assets.current.get(key);
      if (!asset) return null;
      patch(key, { status: "uploading", progress: 0, error: undefined });
      try {
        const upload = await uploadMedia(auth, jobId, asset, (progress) => patch(key, { progress }));
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
    async (picked: ImagePicker.ImagePickerAsset[]): Promise<UploadedFile[]> => {
      const added = picked.map((asset, index) => {
        const key = `${Date.now()}-${index}-${asset.uri}`;
        assets.current.set(key, asset);
        return {
          key,
          preview: asset.uri,
          kind: asset.type === "video" ? ("video" as const) : ("image" as const),
          status: "uploading" as const,
          progress: 0,
        };
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
