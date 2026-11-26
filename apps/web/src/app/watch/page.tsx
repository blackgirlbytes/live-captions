import type { Metadata } from "next";
import { WatchShell } from "./WatchShell";

export const metadata: Metadata = { title: "Watch with live captions" };

export default async function WatchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const raw = params.url;
  const url = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return <WatchShell url={url} />;
}
