export type { SettingDef, SettingCategory, SettingType, SettingOption } from "./settings-schema-types";
export { ALL_CATEGORIES } from "./settings-schema-types";
export { WEB_SETTINGS } from "./settings-schema-web";
export { KIOSK_SETTINGS } from "./settings-schema-kiosk";
export { DEVICE_SETTINGS } from "./settings-schema-device";

import { WEB_SETTINGS } from "./settings-schema-web";
import { KIOSK_SETTINGS } from "./settings-schema-kiosk";
import { DEVICE_SETTINGS } from "./settings-schema-device";
import type { SettingDef } from "./settings-schema-types";

/** Full merged schema — all known Fully Kiosk settings. */
export const SETTINGS_SCHEMA: SettingDef[] = [
  ...WEB_SETTINGS,
  ...KIOSK_SETTINGS,
  ...DEVICE_SETTINGS,
];

/** Look up a setting definition by its key. */
export function getSettingDef(key: string): SettingDef | undefined {
  return SETTINGS_SCHEMA.find((s) => s.key === key);
}
