/**
 * Shared TypeScript types for the kiosk-admin application.
 * Types owned by a specific module live there; shared types live here.
 */

import type { Device, Group, Tag, Role } from "./generated/prisma/client";

// Session user type (extends NextAuth's built-in)
export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

// Device without the encrypted password field
export type DeviceSafe = Omit<Device, "passwordEnc">;

// Device with eager-loaded relations (tags, group)
export type DeviceWithRelations = DeviceSafe & {
  group: Group | null;
  tags: { tag: Tag }[];
};

// Live device status from a provider
export interface DeviceInfo {
  online: boolean;
  batteryLevel?: number;
  screenOn?: boolean;
  currentUrl?: string;
  deviceModel?: string;
  androidVersion?: string;
  appVersion?: string;
  storageTotal?: number;
  storageFree?: number;
  brightness?: number;
  volume?: number;
}

// API error shape returned to clients
export interface ApiError {
  error: string;
}
