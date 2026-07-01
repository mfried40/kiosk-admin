# 003 — Provider Abstraction: Requirements

## User Stories

### US-003-1: Unified provider interface
As a developer, I want all device communication to go through a common interface, so that adding a new kiosk provider requires only one new file and zero changes to routes or UI.

**Acceptance criteria**
- The system shall define a `KioskProvider` interface that every provider class must satisfy.
- WHEN a new provider is added, the system SHALL only require: (1) a new class in `lib/providers/`, (2) a new enum value in `Provider`, and (3) a mapping entry in the provider resolver — no other files shall need changes.
- IF a provider method is called for an unsupported operation, it SHALL throw a typed `ProviderCapabilityError` rather than silently failing.

### US-003-2: Static capability flags
As a developer, I want each provider to declare its capabilities at class level (not instance level), so that the UI can conditionally render controls before making any device call.

**Acceptance criteria**
- The system shall expose `static readonly capabilities: ProviderCapabilities` on each provider class.
- WHEN the UI renders device controls, it SHALL read the capabilities of the device's provider and hide controls for capabilities that are `false`.
- WHEN a capability is `false` and an API route that requires it is called anyway, the system SHALL return `501 Not Implemented` rather than forwarding the call to the device.

### US-003-3: Fully Kiosk provider
As an admin, I want to manage Fully Kiosk devices using their Remote Admin REST API, so that I have full control over those devices.

**Acceptance criteria**
- WHERE the device provider is `FULLY_KIOSK`, the system SHALL communicate with the device on the configured port using the Fully Kiosk REST API format (`?cmd=...&password=...`).
- The Fully Kiosk provider SHALL declare all capabilities as `true` (full feature set).
- IF the device responds with HTTP 4xx or 5xx, the provider SHALL surface a `ProviderError` with the status and body.

### US-003-4: Free Kiosk provider stub
As a developer, I want a Free Kiosk stub in place, so that the provider system is proven extensible even before the Free Kiosk API is documented.

**Acceptance criteria**
- WHERE the device provider is `FREE_KIOSK`, all `KioskProvider` methods SHALL throw `ProviderCapabilityError` with message "Free Kiosk API not yet implemented".
- The Free Kiosk provider SHALL declare all capabilities as `false` except `getDeviceInfo` once the API is known.

---

## Non-functional Requirements
- Provider resolution must be synchronous (no async import). The resolver is a plain `switch` or `Map`.
- The `KioskProvider` interface must be defined purely in TypeScript — no decorators or framework-specific patterns.

## Out of Scope
- Plugin system or runtime registration of providers — providers are compiled in.
- Support for Fully Cloud API (only direct-to-device REST).
