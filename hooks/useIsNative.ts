import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";

// False while prerendering, the real value on the device: no hydration mismatch
const subscribeNever = () => () => {};

/** True inside the Capacitor app, where downloads and printing don't work. */
export function useIsNative(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => Capacitor.isNativePlatform(),
    () => false
  );
}
