# 003 — Provider Abstraction: Tasks

- [x] Implement `lib/provider.types.ts` — `KioskProvider` interface, `BaseKioskProvider`, `ProviderCapabilities`, error classes
- [x] Implement `lib/providers/fully-kiosk.ts` — all methods, 5 s timeout, `capabilities` all `true`
- [x] Implement `lib/providers/free-kiosk.ts` — stub, all methods throw `ProviderCapabilityError`, capabilities all `false`
- [x] Implement `lib/providers/index.ts` — resolver `getProvider()` and `getCapabilities()`
- [x] Add `assertCapability()` utility to `lib/providers/index.ts`
- [x] Update device API routes to use `getProvider()` and `assertCapability()` before forwarding calls
- [x] Update UI device-controls to call `getCapabilities()` server-side and pass as props; hide unavailable controls
- [ ] Write Vitest tests for Fully Kiosk provider (mock fetch: happy path, 4xx error, timeout)
- [ ] Write Vitest tests for Free Kiosk provider (all methods throw `ProviderCapabilityError`)
- [x] Write Vitest tests for `assertCapability` (passes when capable, throws when not)

**References:** US-003-1, US-003-2, US-003-3, US-003-4
