import type { Metadata } from "next";
import Link from "next/link";
import { DesignFiles } from "@/components/homepage/DesignFiles";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Design Files - Issue 001",
  description: "Open the first After Hours Agenda design issue: verified product artwork and previews connected directly to active product pages.",
  alternates: { canonical: "/lookbook/design-files" },
};

export default function DesignFilesIssuePage() {
  return <main className="pb-20 pt-28 md:pt-32"><div className="px-4 md:px-6"><div className="mx-auto max-w-[1440px]"><PageHeader eyebrow="Outside Hours / Issue 001" title="Design files" description="Four products viewed through the working artwork archive. Every image below connects to an active product page; no campaign location, model, or collaborator story has been invented." /><div className="mt-7 flex flex-wrap gap-3"><Link href="/lookbook" className="secondary-action min-h-11 px-5 py-3 text-xs">Back to issues</Link><Link href="/shop" className="primary-action min-h-11 px-5 py-3 text-xs">Shop all products</Link></div></div></div><DesignFiles /></main>;
}
