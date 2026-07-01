/**
 * Provider resolver.
 * Use getProvider() to obtain a KioskProvider instance for a device.
 * Use getCapabilities() to read static capabilities without instantiating.
 * Use assertCapability() in route handlers to gate unsupported operations.
 */

import { Provider } from "@/lib/provider.types";
import { FullyKioskProvider } from "./fully-kiosk";
import { FreeKioskProvider } from "./free-kiosk";
import {
  BaseKioskProvider,
  ProviderCapabilities,
  ProviderCapabilityError,
} from "@/lib/provider.types";

interface ProviderCls {
  new(): BaseKioskProvider;
  capabilities: ProviderCapabilities;
}

const PROVIDERS: Record<Provider, ProviderCls> = {
  [Provider.FULLY_KIOSK]: FullyKioskProvider,
  [Provider.FREE_KIOSK]: FreeKioskProvider,
};

export function getProvider(provider: Provider): BaseKioskProvider {
  const Cls = PROVIDERS[provider];
  return new Cls();
}

export function getCapabilities(provider: Provider): ProviderCapabilities {
  const Cls = PROVIDERS[provider];
  return Cls.capabilities;
}

export function assertCapability(
  provider: Provider,
  cap: keyof ProviderCapabilities,
): void {
  const caps = getCapabilities(provider);
  if (!caps[cap]) {
    throw new ProviderCapabilityError(String(provider), String(cap));
  }
}
