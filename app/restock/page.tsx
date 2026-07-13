import type { Metadata } from "next";
import Link from "next/link";
import { RestockRequestForm } from "@/components/forms/RestockRequestForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Request a Restock Alert",
  description: "Request an availability update for an After Hours Agenda product, size, color, or variant without joining the general marketing list.",
  alternates: { canonical: "/restock" },
};

export default async function RestockPage({ searchParams }: { searchParams: Promise<{ product?: string; size?: string }> }) {
  const { product = "", size = "" } = await searchParams;
  return <main className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-3xl"><PageHeader eyebrow="Availability request" title="Ask for the one you missed" description="Tell us which product and variant you want. If it becomes available again, we can send an update to the address below." /><RestockRequestForm initialProduct={product} initialSize={size} /><p className="mt-6 text-sm leading-relaxed text-muted">Want release notes as well? <Link href="/newsletter" className="text-accent underline underline-offset-4">Join the general email list separately</Link>.</p></div></main>;
}
