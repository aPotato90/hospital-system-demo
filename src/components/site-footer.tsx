import Link from "next/link";
import { portfolioUrl } from "@/lib/firebase/config";
import { AUTHOR_NAME, HOSPITAL_NAME, PRODUCT_NAME } from "./brand";

export function SiteFooter() {
  return (
    <footer className="border-t text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          {PRODUCT_NAME} · {HOSPITAL_NAME} is fictional.
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            className="underline underline-offset-4 hover:text-foreground"
            href="/about"
          >
            About this demo
          </Link>
          <span>
            Built by{" "}
            {portfolioUrl ? (
              <a
                className="font-medium underline underline-offset-4 hover:text-foreground"
                href={portfolioUrl}
                rel="noopener"
              >
                {AUTHOR_NAME}
              </a>
            ) : (
              <span className="font-medium">{AUTHOR_NAME}</span>
            )}
          </span>
        </p>
      </div>
    </footer>
  );
}
