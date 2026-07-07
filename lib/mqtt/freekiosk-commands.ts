/**
 * FreeKiosk MQTT command mapping.
 *
 * FreeKiosk commands are sent to: {baseTopic}/{deviceId}/set/{entity}
 * with a plain string payload (not JSON).
 *
 * Also maintains a runtime cache of baseTopic per mqttDeviceId,
 * populated when incoming state messages are received.
 */

// Runtime map: mqttDeviceId → baseTopic (e.g. "tab-2" → "kiosk")
const baseTopicCache = new Map<string, string>();

export function cacheBaseTopic(mqttDeviceId: string, baseTopic: string): void {
  baseTopicCache.set(mqttDeviceId, baseTopic);
}

export function getBaseTopic(mqttDeviceId: string): string | undefined {
  return baseTopicCache.get(mqttDeviceId);
}

interface CommandMapping {
  entity: string;
  payload: (params?: Record<string, string>) => string;
}

// Maps our internal command names → FreeKiosk set/{entity} + payload
const COMMAND_MAP: Record<string, CommandMapping> = {
  // Screen
  screenOn:           { entity: "screen",       payload: () => "ON" },
  screenOff:          { entity: "screen",       payload: () => "OFF" },
  forceSleep:         { entity: "screen",       payload: () => "OFF" },
  // URL / web
  loadUrl:            { entity: "url",          payload: (p) => p?.url ?? "" },
  loadStartUrl:       { entity: "reload",       payload: () => "PRESS" },
  reloadStartUrl:     { entity: "reload",       payload: () => "PRESS" },
  refreshTab:         { entity: "reload",       payload: () => "PRESS" },
  reload:             { entity: "reload",       payload: () => "PRESS" },
  clearCache:         { entity: "clear_cache",  payload: () => "PRESS" },
  // Screensaver
  startScreensaver:   { entity: "screensaver",  payload: () => "ON" },
  stopScreensaver:    { entity: "screensaver",  payload: () => "OFF" },
  startDaydream:      { entity: "screensaver",  payload: () => "ON" },
  stopDaydream:       { entity: "screensaver",  payload: () => "OFF" },
  // Volume
  setVolume:          { entity: "volume",       payload: (p) => p?.level ?? p?.value ?? "50" },
  setAudioVolume:     { entity: "volume",       payload: (p) => p?.level ?? p?.value ?? "50" },
  // TTS
  textToSpeech:       { entity: "tts",          payload: (p) => p?.text ?? "" },
  // App control
  restartApp:         { entity: "restart_ui",   payload: () => "PRESS" },
  // Kiosk lock
  lockKiosk:          { entity: "lock",         payload: () => "PRESS" },
  // Overlay / toast (standard name: setOverlayMessage)
  setOverlayMessage:  { entity: "toast",        payload: (p) => p?.message ?? p?.text ?? "" },
  toast:              { entity: "toast",        payload: (p) => p?.message ?? p?.text ?? "" },
  // JS injection
  injectJavascript:   { entity: "execute_js",   payload: (p) => p?.script ?? p?.code ?? "" },
  injectJS:           { entity: "execute_js",   payload: (p) => p?.script ?? p?.code ?? "" },
  // Media
  playSound:          { entity: "audio_play",   payload: (p) => JSON.stringify({ url: p?.url ?? "" }) },
  playVideo:          { entity: "audio_play",   payload: (p) => JSON.stringify({ url: p?.url ?? "" }) },
  playFile:           { entity: "audio_play",   payload: (p) => JSON.stringify({ url: p?.url ?? "" }) },
  stopSound:          { entity: "audio_stop",   payload: () => "PRESS" },
  stopVideo:          { entity: "audio_stop",   payload: () => "PRESS" },
  stopMedia:          { entity: "audio_stop",   payload: () => "PRESS" },
  beep:               { entity: "audio_beep",   payload: () => "PRESS" },
  // App launcher
  startApplication:   { entity: "launch_app",   payload: (p) => p?.package ?? "" },
  // Remote control
  remoteUp:           { entity: "remote_up",       payload: () => "PRESS" },
  remoteDown:         { entity: "remote_down",     payload: () => "PRESS" },
  remoteLeft:         { entity: "remote_left",     payload: () => "PRESS" },
  remoteRight:        { entity: "remote_right",    payload: () => "PRESS" },
  remoteSelect:       { entity: "remote_select",   payload: () => "PRESS" },
  remoteBack:         { entity: "remote_back",     payload: () => "PRESS" },
  remoteHome:         { entity: "remote_home",     payload: () => "PRESS" },
  remoteMenu:         { entity: "remote_menu",     payload: () => "PRESS" },
  remotePlayPause:    { entity: "remote_playpause",payload: () => "PRESS" },
  keyboardText:       { entity: "keyboard_text",   payload: (p) => p?.text ?? "" },
};

/**
 * Returns { topic, payload } for a FreeKiosk MQTT command,
 * or null if the command has no MQTT mapping.
 */
export function getFreeKioskCommandTopic(
  baseTopic: string,
  deviceId: string,
  cmd: string,
  params?: Record<string, string>,
): { topic: string; payload: string } | null {
  const mapping = COMMAND_MAP[cmd];
  if (!mapping) return null;
  return {
    topic: `${baseTopic}/${deviceId}/set/${mapping.entity}`,
    payload: mapping.payload(params),
  };
}
