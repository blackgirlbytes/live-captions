import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { WatchShell } from "./WatchShell";

export async function generateMetadata(): Promise<Metadata> {
  const { common } = await getMessages();
  return { title: common.meta.watchTitle };
}

export default async function WatchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const raw = params.url;
  const url = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return <WatchShell url={url} />;
}
