import { z } from "zod";
import { credentialsSchema } from "@/lib/auth/schemas";
import { isExpoPushToken } from "@/modules/notifications/push-messages";

/** What the app says about itself on every sign-in. `deviceId` is its own random value per install. */
const device = {
  deviceId: z.string().min(16).max(200),
  deviceName: z.string().trim().max(100).optional(),
  platform: z.enum(["ios", "android"]),
};

export const passwordSignInSchema = credentialsSchema.extend(device);

export const codeSignInSchema = z.object({
  ...device,
  challengeId: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, "validation.invalidCode"),
  trustDevice: z.boolean().default(false),
});

/** The Expo push token the app got from the phone, after the person allowed notifications. */
export const pushDeviceSchema = z.object({
  token: z.string().trim().refine(isExpoPushToken, "validation.invalid"),
  platform: device.platform,
});

export type DeviceInput = { deviceId: string; deviceName?: string; platform: "ios" | "android" };
export type PasswordSignIn = z.infer<typeof passwordSignInSchema>;
export type CodeSignIn = z.infer<typeof codeSignInSchema>;
