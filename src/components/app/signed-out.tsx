"use client";

import Link from "next/link";
import { BrandMark, PRODUCT_NAME } from "@/components/brand";
import { ExploreButton } from "@/components/explore-button";

export function SignedOut() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 items-center justify-center px-4 py-20 outline-none"
    >
      <div className="max-w-md text-center">
        <BrandMark className="mx-auto size-10" />
        <h1 className="mt-4 text-2xl font-semibold">Start a demo session</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {PRODUCT_NAME} opens in a private sandbox with fake data. Your session
          lasts until you close this tab or sign out.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <ExploreButton />
          <Link href="/" className="text-sm underline underline-offset-4">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
