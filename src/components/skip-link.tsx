/** First focusable element on every page. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only z-[100] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
    >
      Skip to main content
    </a>
  );
}
