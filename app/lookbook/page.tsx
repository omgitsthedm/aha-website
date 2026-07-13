import Link from "next/link";
import { DesignFiles } from "@/components/homepage/DesignFiles";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = {
  title: "Outside Hours - Design Issues",
  description: "Browse After Hours Agenda design issues and product artwork connected directly to active product pages.",
  alternates: { canonical: "/lookbook" },
};

export default function LookbookPage() {
  return (
    <div className="pb-20 pt-28 md:pt-32">
      <div className="px-4 md:px-6">
        <div className="mx-auto max-w-[1440px]">
          <PageHeader eyebrow="Outside Hours" title="Design issues" description="Product artwork, previews, and future campaign material organized as a visual index. Every published issue uses verified store assets and links back to the product." />
          <Link href="/lookbook/design-files" className="mt-7 inline-flex min-h-11 items-center border border-accent px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-accent hover:bg-accent hover:text-cream">Open Issue 001 / Design files</Link>
        </div>
      </div>
      <DesignFiles compact />
    </div>
  );
}
