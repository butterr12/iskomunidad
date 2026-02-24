import { useEffect } from "react";

/**
 * Detects the mobile virtual keyboard via the visualViewport API.
 * Sets `data-keyboard-open` on <html> and CSS custom properties:
 *
 *   --vkb-height     keyboard height in px (0 when closed)
 *   --vvp-page-top   how many px iOS has panned the visual viewport upward (0 on non-iOS)
 *   --vvp-height     visual viewport height in px (shrinks when keyboard appears)
 *
 * The explorer layout reads --vvp-page-top and --vvp-height to counteract
 * iOS's "overlay + pan" keyboard behaviour, keeping position:fixed children
 * (NavBar, bottom nav) pinned to the visual viewport.
 */
export function useVirtualKeyboard() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Threshold in px — small resizes (e.g. URL bar hiding) should be ignored
    const KEYBOARD_THRESHOLD = 150;

    const update = () => {
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      const isOpen = keyboardHeight > KEYBOARD_THRESHOLD;

      document.documentElement.style.setProperty(
        "--vkb-height",
        `${Math.max(0, keyboardHeight)}px`,
      );
      document.documentElement.style.setProperty(
        "--vvp-page-top",
        `${vv.pageTop}px`,
      );
      document.documentElement.style.setProperty(
        "--vvp-height",
        `${vv.height}px`,
      );

      if (isOpen) {
        document.documentElement.setAttribute("data-keyboard-open", "");
      } else {
        document.documentElement.removeAttribute("data-keyboard-open");
      }
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update); // iOS panning fires "scroll" on visualViewport
    // Run once on mount in case a keyboard is already open
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.removeAttribute("data-keyboard-open");
      document.documentElement.style.removeProperty("--vkb-height");
      document.documentElement.style.removeProperty("--vvp-page-top");
      document.documentElement.style.removeProperty("--vvp-height");
    };
  }, []);
}
