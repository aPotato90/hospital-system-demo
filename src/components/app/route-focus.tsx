"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Focus the main heading (or the main landmark) of the current page. */
export function focusMainHeading() {
  const main = document.getElementById("main-content");
  const heading = main?.querySelector<HTMLElement>("h1");
  const target = heading ?? main;
  if (!target) return;
  if (heading && !heading.hasAttribute("tabindex")) {
    heading.setAttribute("tabindex", "-1");
  }
  target.focus();
}

/**
 * Moves focus to the page heading after client-side navigation so screen
 * reader and keyboard users start at the new content.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    focusMainHeading();
  }, [pathname]);

  return null;
}
