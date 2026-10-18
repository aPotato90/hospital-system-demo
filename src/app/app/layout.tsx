import type { Metadata } from "next";
import { AppGate } from "@/components/app/app-gate";

// Everything under /app waits on client-side anonymous auth and Firestore, so
// navigations into it are not expected to be instant.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "App", template: "%s · Demo Hospital Manager" },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <AppGate>{children}</AppGate>;
}
