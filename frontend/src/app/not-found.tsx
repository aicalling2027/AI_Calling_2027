import type { Metadata } from "next";

import { NotFoundPanel } from "@/components/layout/not-found-panel";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function RootNotFound() {
  return <NotFoundPanel />;
}
