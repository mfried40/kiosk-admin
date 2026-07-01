/**
 * Shared types for the settings schema.
 * Each entry maps a Fully Kiosk setting key to display metadata.
 */

export type SettingType =
  | "boolean"
  | "string"
  | "number"
  | "url"
  | "color"
  | "multiline"
  | "password"
  | "select";

export type SettingCategory =
  | "Web Content"
  | "Browsing"
  | "Kiosk Mode"
  | "Screen & Display"
  | "Audio & Media"
  | "Motion Detection"
  | "Screensaver"
  | "Remote & MQTT"
  | "App Management"
  | "Security"
  | "Other";

export const ALL_CATEGORIES: SettingCategory[] = [
  "Web Content",
  "Browsing",
  "Kiosk Mode",
  "Screen & Display",
  "Audio & Media",
  "Motion Detection",
  "Screensaver",
  "Remote & MQTT",
  "App Management",
  "Security",
  "Other",
];

export interface SettingOption {
  value: string;
  label: string;
}

export interface SettingDef {
  key: string;
  label: string;
  description?: string;
  type: SettingType;
  options?: SettingOption[];
  min?: number;
  max?: number;
  category: SettingCategory;
  plusOnly?: boolean;
  /** Setting has security implications — show a warning badge */
  securityWarning?: boolean;
}
