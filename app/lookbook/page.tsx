import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Lookbook", description: "After Hours Agenda campaign images and streetwear editorial.", alternates: { canonical: "/lookbook" } };

const images = [
  { src: "/brand/lifestyle/lifestyle-1.jpeg", alt: "After Hours Agenda campaign portrait", layout: "md:col-span-7 md:row-span-2" },
  { src: "/brand/lifestyle/lifestyle-2.jpg", alt: "After Hours Agenda clothing in New York", layout: "md:col-span-5" },
  { src: "/brand/lifestyle/lifestyle-3.jpg", alt: "After Hours Agenda streetwear detail", layout: "md:col-span-5" },
  { src: "/brand/lifestyle/lifestyle-4.jpg", alt: "After Hours Agenda night street campaign", layout: "md:col-span-12" },
];

export default function LookbookPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-[1440px]">
        <PageHeader eyebrow="Campaign archive / New York" title="Outside the expected frame" description="Four images from the label in the city. The lookbook creates the world; the catalog gives every piece a direct route to purchase." />
        <div className="grid gap-4 md:grid-cols-12 md:grid-rows-[22rem_22rem_32rem]">
          {images.map((image, index) => (
            <figure key={image.src} className={`relative min-h-[380px] overflow-hidden border border-border/40 ${image.layout}`}>
              <Image src={image.src} alt={image.alt} fill priority={index === 0} className="object-cover" sizes={index === 0 ? "(max-width: 768px) 100vw, 58vw" : index === 3 ? "100vw" : "(max-width: 768px) 100vw, 42vw"} />
            </figure>
          ))}
        </div>
        <div className="mt-12 grid gap-8 border-y border-border/40 py-10 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <p className="max-w-3xl font-display text-[clamp(2.4rem,5vw,4.8rem)] font-black uppercase leading-[0.88] tracking-[-0.055em]">The clothes should make sense on the train, on the sidewalk, and at 2 a.m.</p>
          <div className="md:justify-self-end">
            <p className="max-w-sm text-sm leading-relaxed text-muted">Open the full catalog for current sizes, prices, production notes, and delivery expectations.</p>
            <Link href="/shop" className="primary-action mt-5 min-h-11 px-5 py-3 text-xs">Shop all pieces</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
