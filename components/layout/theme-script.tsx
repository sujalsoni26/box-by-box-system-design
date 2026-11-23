import { STORAGE_KEYS } from "@/lib/storage/adapter";

/**
 * Runs before first paint: applies the saved theme and animation speed to <html>
 * so there is no light/dark flash, no unwanted motion on load, and no hydration mismatch.
 * Animation speed: an explicit choice wins; otherwise prefers-reduced-motion decides.
 * (Older saves kept it as companion.animations "reduced" | "off".)
 */
const script = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.preferences)});var s=raw?JSON.parse(raw).state||{}:{};var t=s.theme||"system";var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",dark);var m=s.animationSpeed;if(m!=="normal"&&m!=="slow"&&m!=="reduced"){var legacy=s.companion&&s.companion.animations;m=legacy==="reduced"||legacy==="off"||window.matchMedia("(prefers-reduced-motion: reduce)").matches?"reduced":"normal";}r.setAttribute("data-motion",m);}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
