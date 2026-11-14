/** The desktop systems the quick start has an install tab for. */
export type DesktopOperatingSystem = "macos" | "windows" | "linux";

/**
 * The visitor's desktop system from the browser's user agent, or null for a
 * phone, a tablet, ChromeOS or anything else without an install tab.
 */
export function detectOperatingSystem(
  userAgent: string,
): DesktopOperatingSystem | null {
  if (/android|iphone|ipad|ipod|cros/i.test(userAgent)) {
    return null;
  }
  if (/windows/i.test(userAgent)) {
    return "windows";
  }
  if (/macintosh|mac os x/i.test(userAgent)) {
    return "macos";
  }
  if (/linux|x11/i.test(userAgent)) {
    return "linux";
  }

  return null;
}
