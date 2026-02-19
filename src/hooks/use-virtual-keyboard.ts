import { useEffect } from "react";

/**
 * Detects the mobile virtual keyboard via the visualViewport API.
 * Sets `data-keyboard-open` on <html> and a `--vkb-height` CSS custom
 * property so the rest of the app can react with pure CSS.
 */
export function useVirtualKeyboard() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Threshold in px — small resizes (e.g. URL bar hiding) should be ignored
    const KEYBOARD_THRESHOLD = 150;

    const update = () => {
      const keyboardHeight = window.innerHeight - vv.height;
      const isOpen = keyboardHeight > KEYBOARD_THRESHOLD;

      document.documentElement.style.setProperty(
        "--vkb-height",
        `${Math.max(0, keyboardHeight)}px`,
      );

      if (isOpen) {
        document.documentElement.setAttribute("data-keyboard-open", "");
      } else {
        document.documentElement.removeAttribute("data-keyboard-open");
      }
    };

    vv.addEventListener("resize", update);
    // Run once on mount in case a keyboard is already open
    update();

    return () => {
      vv.removeEventListener("resize", update);
      document.documentElement.removeAttribute("data-keyboard-open");
      document.documentElement.style.removeProperty("--vkb-height");
    };
  }, []);
}
