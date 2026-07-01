# 010 — Device Settings View: Design

## Route

```
/devices/[id]/settings   → app/(app)/devices/[id]/settings/page.tsx
```

The existing device detail page (`/devices/[id]`) removes `DeviceSettingsPanel` and replaces it with a link button:
```tsx
<Link href={`/devices/${device.id}/settings`}>
  <Button variant="outline" size="sm">View Settings →</Button>
</Link>
```

---

## Settings Schema

Defined in `lib/settings-schema.ts`. Maps Fully Kiosk setting keys to display metadata.

```ts
export type SettingType =
  | "boolean"
  | "string"
  | "number"
  | "url"
  | "color"
  | "multiline"
  | "password"
  | "select";

export interface SettingOption {
  value: string;
  label: string;
}

export interface SettingDef {
  key: string;
  label: string;
  description?: string;
  type: SettingType;
  options?: SettingOption[];   // for "select" type
  min?: number;                // for "number" type
  max?: number;
  category: SettingCategory;
  plusOnly?: boolean;
}

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
```

### Schema entries by category (representative — not exhaustive)

#### Web Content
| Key | Label | Type | Notes |
|---|---|---|---|
| `startUrl` | Start URL | `multiline` | Supports multiple URLs (one per line) |
| `urlUsername` | HTTP Auth Username | `string` | Basic auth for Start URL |
| `urlPassword` | HTTP Auth Password | `password` | |
| `enableFullscreen` | Enable Fullscreen Videos | `boolean` | |
| `autoplayVideos` | Autoplay Videos | `boolean` | |
| `autoplayAudio` | Autoplay Audio | `boolean` | |
| `enableJavascript` | Enable JavaScript Alerts | `boolean` | |
| `allowPopups` | Enable Popups | `boolean` | PLUS |
| `enableWebcam` | Enable Webcam Access | `boolean` | PLUS |
| `enableMicrophone` | Enable Microphone Access | `boolean` | PLUS |
| `enableGeolocation` | Enable Geolocation Access | `boolean` | PLUS |
| `urlWhitelist` | URL Whitelist | `multiline` | One URL per line, * wildcard |
| `urlBlacklist` | URL Blacklist | `multiline` | One URL per line, * wildcard |
| `userAgent` | Fake User Agent String | `select` | Default, Chrome, Edge, Firefox options |
| `customUserAgent` | Custom User Agent String | `string` | PLUS |
| `clearCacheOnReload` | Clear Cache on Auto Reload | `boolean` | |
| `clearCookiesOnReload` | Clear Cookies on Auto Reload | `boolean` | |
| `clearWebstorageOnReload` | Clear Web Storage on Auto Reload | `boolean` | |

#### Browsing
| Key | Label | Type |
|---|---|---|
| `enableBackButton` | Enable Back Button | `boolean` |
| `enablePullToRefresh` | Enable Pull to Refresh | `boolean` |
| `enableTapSound` | Enable Tap Sound | `boolean` |
| `waitForNetwork` | Wait for Network Connection | `boolean` |
| `autoReloadOnIdle` | Auto Reload on Idle (seconds) | `number` | min: 0 |
| `autoReloadOnError` | Auto Reload after Page Error (seconds) | `number` | min: 0 |
| `autoReloadOnScreenOn` | Auto Reload on Screen On | `boolean` |
| `autoReloadOnNetworkReconnect` | Auto Reload on Network Reconnect | `boolean` |
| `loadCurrentOnReload` | Reload Current Page (not Start URL) | `boolean` |
| `enableZoom` | Enable Zoom | `boolean` |
| `loadInOverviewMode` | Load in Overview Mode | `boolean` |
| `initialScale` | Initial Scale (%) | `number` | min: 10, max: 500 |
| `fontScale` | Font Size Scale (%) | `number` | min: 10, max: 300 |
| `viewInDesktopMode` | View in Desktop Mode | `boolean` |
| `customErrorUrl` | Custom Error URL | `url` |
| `injectJavascript` | Inject JavaScript (on page load) | `multiline` | PLUS |

#### Kiosk Mode
| Key | Label | Type |
|---|---|---|
| `kioskMode` | Enable Kiosk Mode | `boolean` | PLUS |
| `kioskPassword` | Kiosk PIN | `password` | |
| `wifiPassword` | Wifi/Settings PIN | `password` | |
| `disableStatusBar` | Disable Status Bar | `boolean` | |
| `disableVolumeButtons` | Disable Volume Buttons | `boolean` | |
| `disablePowerButton` | Disable Power Button | `boolean` | |
| `disableHomeButton` | Disable Home Button | `boolean` | |
| `disableOtherApps` | Disable Other Apps | `boolean` | |
| `appWhitelist` | App Whitelist | `multiline` | One package per line |
| `appBlacklist` | App Blacklist | `multiline` | One package per line |
| `disableNotifications` | Disable Notifications | `boolean` | |
| `disableIncomingCalls` | Disable Incoming Calls | `boolean` | |
| `disableOutgoingCalls` | Disable Outgoing Calls | `boolean` | |
| `disableCamera` | Disable Camera | `boolean` | |
| `disableScreenshots` | Disable Screenshots | `boolean` | |
| `kioskExitGesture` | Kiosk Exit Gesture | `select` | swipeLeft, fiveTaps, sevenTaps, cornerTaps |

#### Screen & Display
| Key | Label | Type |
|---|---|---|
| `keepScreenOn` | Keep Screen On | `boolean` |
| `screenBrightness` | Screen Brightness (0–255) | `number` | min: 0, max: 255 |
| `screenOrientation` | Force Screen Orientation | `select` | auto, portrait, landscape, reversePortrait, reverseLandscape |
| `screenOffTimer` | Screen Off Timer (seconds, 0=disabled) | `number` | min: 0; PLUS |
| `unlockScreen` | Show Above Lock Screen | `boolean` |
| `launchOnBoot` | Launch on Boot | `boolean` |
| `showNavigationBar` | Show Navigation Bar | `boolean` |
| `navigationBarColor` | Navigation Bar Color | `color` |
| `showStatusBar` | Show Status Bar | `boolean` |
| `statusBarColor` | Status Bar Color | `color` |
| `showActionBar` | Show Action Bar | `boolean` |
| `actionBarTitle` | Action Bar Title | `string` |
| `actionBarColor` | Action Bar Background Color | `color` |
| `actionBarTextColor` | Action Bar Text Color | `color` |
| `showTabs` | Show Browser Tabs | `boolean` |
| `showAddressBar` | Show Address Bar | `boolean` |
| `showProgressBar` | Show Progress Bar | `boolean` |
| `progressBarColor` | Progress Bar Color | `color` |
| `wifiMode` | WiFi Mode | `select` | noChange, enable, disable |
| `bluetoothMode` | Bluetooth Mode | `select` | noChange, enable, disable |

#### Audio & Media
| Key | Label | Type |
|---|---|---|
| `soundVolume` | Sound Volume (0–100) | `number` | min: 0, max: 100 |
| `volumeLevels` | Set Volume Levels on Start | `string` | e.g. 3:80,4:50; PLUS |
| `ttsLocale` | TTS Default Locale | `string` | e.g. en-US |
| `ttsEngine` | TTS Engine Package | `string` | |
| `videoPlayerEngine` | Video Player Engine | `select` | mediaPlayer, exoplayer |
| `enableFullscreenVideos` | Enable Fullscreen Videos | `boolean` |
| `autoplayVideos` | Autoplay Videos | `boolean` |
| `resumePlaybackOnForeground` | Resume Playback on Foreground | `boolean` |
| `redirectAudioToEarpiece` | Redirect Audio to Earpiece | `boolean` | PLUS |

#### Motion Detection
| Key | Label | Type |
|---|---|---|
| `motionDetection` | Enable Visual Motion Detection | `boolean` | PLUS |
| `motionSensitivity` | Detector Sensitivity (0–100) | `number` | min: 0, max: 100 |
| `motionFrameRate` | Detector Frame Rate (1–25) | `number` | min: 1, max: 25 |
| `darknessLevel` | Darkness Level (0–100) | `number` | min: 0, max: 100 |
| `showCamPreview` | Show Cam Preview | `boolean` |
| `detectFaces` | Detect Faces | `boolean` |
| `turnScreenOnOnMotion` | Turn Screen On on Motion | `boolean` |
| `exitScreensaverOnMotion` | Exit Screensaver on Motion | `boolean` |
| `turnScreenOffInDarkness` | Turn Screen Off in Darkness | `boolean` |
| `acousticMotionDetection` | Enable Acoustic Motion Detection | `boolean` | PLUS |
| `acousticSensitivity` | Acoustic Sensitivity (0–100) | `number` | min: 0, max: 100 |

#### Screensaver
| Key | Label | Type |
|---|---|---|
| `screensaverTimer` | Screensaver Timer (seconds) | `number` | min: 0; PLUS |
| `screensaverBrightness` | Screensaver Brightness (0–255) | `number` | min: 0, max: 255 |
| `screensaverWallpaper` | Screensaver Wallpaper URL | `url` | |
| `screensaverFadeDuration` | Fade In/Out Duration (ms) | `number` | min: 0 |
| `useAndroidScreensaver` | Use Android Screen Saver (Daydream) | `boolean` |

#### Remote & MQTT
| Key | Label | Type |
|---|---|---|
| `remoteAdmin` | Enable Remote Administration | `boolean` | PLUS |
| `remoteAdminPassword` | Remote Admin Password | `password` | |
| `remoteAdminLocalNetwork` | Allow from Local Network | `boolean` |
| `remoteAdminFileManagement` | Enable File Management | `boolean` |
| `remoteAdminScreenshot` | Enable Screenshot | `boolean` |
| `remoteAdminCamshot` | Enable Camshot | `boolean` |
| `mqttEnabled` | Enable MQTT | `boolean` | PLUS |
| `mqttBrokerUrl` | MQTT Broker URL | `url` | e.g. ssl://host:8883 |
| `mqttBrokerUsername` | MQTT Username | `string` |
| `mqttBrokerPassword` | MQTT Password | `password` |
| `mqttClientId` | MQTT Client ID | `string` | |
| `mqttDeviceInfoTopic` | MQTT Device Info Topic | `string` |
| `mqttEventTopic` | MQTT Event Topic | `string` |

#### App Management
| Key | Label | Type |
|---|---|---|
| `dailyUsageStats` | Daily Usage Statistics | `boolean` | PLUS |
| `restartOnCrash` | Restart Fully After Crash | `boolean` | PLUS |
| `restartOnUpdate` | Restart Fully After Update | `boolean` | PLUS |
| `runAsPriorityApp` | Run as Priority App | `boolean` |
| `regainFocusTimer` | Regain Focus Timer (seconds, 0=off) | `number` | min: 0; PLUS |
| `loadZipUrl` | Load Content from ZIP File URL | `url` | PLUS |
| `apkFilesToInstall` | APK Files to Install (one URL per line) | `multiline` | Device Owner |
| `apkUpdateInterval` | APK Update Interval (minutes) | `number` | min: 15 |
| `customLocale` | Custom Locale | `string` | e.g. en-US; PLUS |
| `enableVersionInfo` | Show Version Info on Start | `boolean` |

#### Security
| Key | Label | Type |
|---|---|---|
| `enableJavascriptInterface` | Enable JavaScript Interface | `boolean` | PLUS; security warning |
| `localhostFileAccess` | Localhost File Access | `boolean` | PLUS; security warning |
| `ignoreSSLErrors` | Ignore SSL Errors | `boolean` | security warning |
| `enableSafeBrowsing` | Enable Safe Browsing | `boolean` |
| `enableWebFilter` | Enable Web Filter | `boolean` | PLUS |
| `disableADB` | Disable ADB | `boolean` | Device Owner |
| `disableUsbStorage` | Disable USB Storage | `boolean` | Device Owner |
| `disableBootInSafeMode` | Disable Boot in Safe Mode | `boolean` | Device Owner |
| `enableRootFeatures` | Enable Root Features | `boolean` | PLUS, rooted only |

#### Other
| Key | Label | Type |
|---|---|---|
| `deviceName` | Device Name | `string` |
| `enableEnvironmentSensors` | Enable Environment Sensors | `boolean` | PLUS |
| `darkMode` | Dark Mode | `select` | system, light, dark |
| `customTextVariable` | Custom Text Variable | `string` |
| `confirmExit` | Confirm Exit | `boolean` |
| `renderInCutoutArea` | Render in Notch/Cutout Area | `boolean` |

---

## Page Layout

```
/devices/[id]/settings

← Back to [device name]

[device name] — Settings             [Refresh ↺]

Search: [________________________]

┌─────────────────────────────────────────────────────────────────┐
│ All │ Web Content │ Browsing │ Kiosk Mode │ Screen & Display │ … │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Setting Name               │ Control              │ Description   │
│ Start URL                  │ [textarea▼]          │ Home URL…     │
│ Autoplay Videos            │ [toggle]             │ Autoplay…     │
│ URL Whitelist              │ [textarea▼]          │ One URL…      │
│ …                          │                      │               │
└──────────────────────────────────────────────────────────────────┘

▼ Import from URL
  URL: [_______________________________]  [Import]
```

- **Skeleton loader** while settings fetch in progress.
- **Offline banner** if device returns 503.
- **Saved ✓** inline confirmation (green, fades after 2s) replaces the Save button after success.
- **Error text** in red appears below the input on save failure.
- `boolean` toggles → save immediately on change (no Save button needed).
- All other inputs → "Save" button appears on change; disappears after save.

---

## File Layout

```
app/(app)/devices/[id]/settings/
  page.tsx                   ← Client Component, loads settings + renders page
lib/
  settings-schema.ts         ← SettingDef[] — full schema (split into categories)
  settings-schema-web.ts     ← Web Content + Browsing categories
  settings-schema-kiosk.ts   ← Kiosk Mode + Security categories
  settings-schema-device.ts  ← Screen, Audio, Motion, Screensaver, Remote, Other
components/
  SettingsTable.tsx           ← category-filtered table + edit controls
  SettingControl.tsx          ← renders the right input type for a SettingDef
  SettingsImportPanel.tsx     ← Import from URL collapsible
```

The `page.tsx` fetches the device (to get the name) and the settings list, then passes them to `SettingsTable`.

---

## Data flow

```
page.tsx (Client Component)
  ├─ GET /api/devices/[id]              → device name + provider
  ├─ GET /api/devices/[id]/device-settings → flat { key: value } map
  └─ renders:
       ├─ SettingsTable (receives schema + live values)
       │     ├─ tab filter + search filter
       │     └─ SettingControl per row
       │           └─ PUT /api/devices/[id]/device-settings on change
       └─ SettingsImportPanel
             └─ POST /api/devices/[id]/command { cmd: importSettingsFile }
```
