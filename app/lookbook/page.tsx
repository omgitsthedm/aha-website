import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Lookbook", description: "After Hours Agenda campaign images and streetwear editorial.", alternates: { canonical: "/lookbook" } };

const images = [
  { src: "/brand/lifestyle/lifestyle-1.jpeg", alt: "After Hours Agenda campaign portrait", layout: "md:col-span-7 md:row-span-2" },
  { src: "/brand/lifestyle/lifestyle-2.jpg", alt: "After Hours Agenda clothing in New York", layout: "md:col-span-5" },
  { src: "/brand/lifestyle/lifestyle-3.jpg", alt: "After Hours Agenda streetwear detail", layout: "md:col-span-5" },
];

export default function LookbookPage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-7xl"><PageHeader eyebrow="Campaign / New York" title="Lookbook" description="The label in the city that shaped it. Product photography lives in the catalog; this page stays editorial." /><div className="grid gap-4 md:grid-cols-12 md:grid-rows-2">{images.map((image, index) => <figure key={image.src} className={`relative min-h-[360px] overflow-hidden border border-border/40 ${image.layout}`}><Image src={image.src} alt={image.alt} fill priority={index === 0} className="object-cover" sizes={index === 0 ? "(max-width: 768px) 100vw, 58vw" : "(max-width: 768px) 100vw, 42vw"} /></figure>)}</div><div className="mt-8 flex justify-end"><Link href="/shop" className="primary-action min-h-11 px-5 py-3 text-xs">Shop the catalog</Link></div></div></div>;
}
