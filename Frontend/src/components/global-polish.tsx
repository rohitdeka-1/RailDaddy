import { useRef } from "react";
import { flushSync } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { motionTokens, themeRevealRadius } from "@/lib/motion";
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes

export function ThemeToggle({ theme, onChange }: { theme: "light" | "dark"; onChange: (theme: "light" | "dark") => void }) {
  const reduced = useReducedMotion();
  const busy = useRef(false);
  const dark = theme === "dark";
  async function toggle(button: HTMLButtonElement) {
    if (busy.current) return;
    const next = dark ? "light" : "dark";
    const apply = () => {
      flushSync(() => onChange(next));
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    if (reduced || !document.startViewTransition) { apply(); return; }
    busy.current = true;
    const bounds = button.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
    const radius = themeRevealRadius(x, y, window.innerWidth, window.innerHeight);
    document.documentElement.classList.add("theme-revealing");
    try {
      const transition = document.startViewTransition(apply);
      await transition.ready;
      await document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, {
        duration: motionTokens.duration.entrance * 1000,
        easing: `cubic-bezier(${motionTokens.easing.entrance.join(",")})`,
        pseudoElement: "::view-transition-new(root)",
      }).finished;
      await transition.finished;
    } catch { /* Unsupported capture: the theme is still applied immediately. */ }
    finally { busy.current = false; document.documentElement.classList.remove("theme-revealing"); }
  }
  const transition = { duration: reduced ? 0 : motionTokens.duration.standard, ease: motionTokens.easing.entrance };
  // Sun and crescent morph by cross-fading with a rotate + scale transition;
  // each glyph stays inside the 24-unit view box so nothing is clipped.
  return <Button variant="ghost" type="button" className="theme-toggle" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"} onClick={event => void toggle(event.currentTarget)}>
    <svg className="theme-glyph" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <motion.g
        initial={false}
        animate={dark ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.55, rotate: -45 }}
        style={{ transformOrigin: "12px 12px" }}
        transition={transition}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </motion.g>
      <motion.g
        initial={false}
        animate={dark ? { opacity: 0, scale: 0.55, rotate: 45 } : { opacity: 1, scale: 1, rotate: 0 }}
        style={{ transformOrigin: "12px 12px" }}
        transition={transition}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M5.4 18.6l1.7-1.7M16.9 7.1l1.7-1.7" />
      </motion.g>
    </svg>
  </Button>;
}