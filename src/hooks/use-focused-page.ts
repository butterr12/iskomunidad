import { useEffect } from "react";

/**
 * Hides the mobile bottom navbar while this component is mounted.
 * Use on focused/create pages where the nav bar is not needed.
 */
export function useFocusedPage() {
  useEffect(() => {
    document.documentElement.setAttribute("data-focused-page", "");
    return () => {
      document.documentElement.removeAttribute("data-focused-page");
    };
  }, []);
}
