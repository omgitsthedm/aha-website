import Image from "next/image";
import Link from "next/link";

const photos = [
  { src: "/brand/lifestyle/lifestyle-1.jpeg", alt: "After Hours Agenda campaign portrait", className: "md:col-span-7 md:row-span-2" },
  { src: "/brand/lifestyle/lifestyle-2.jpg", alt: "After Hours Agenda clothing in New York", className: "md:col-span-5" },
  { src: "/brand/lifestyle/lifestyle-3.jpg", alt: "After Hours Agenda streetwear detail", className: "md:col-span-5" },
  { src: "/brand/lifestyle/lifestyle-4.jpg", alt: "After Hours Agenda night street campaign", className: "md:col-span-12" },
];

export function EditorialGallery() {
  return (
    <section className="relative z-[2] border-y border-border/40 bg-charcoal px-4 py-16 md:px-6 md:py-28">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-9 max-w-3xl">
          <h2 className="font-display text-[clamp(2.7rem,6vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Seen after dark</h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-relaxed text-muted">A campaign archive from the city, the train, the sidewalk, and the spaces in between.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-12 md:grid-rows-[22rem_22rem_28rem]">
          {photos.map((photo, index) => (
            <div key={photo.src} className={`relative min-h-[340px] overflow-hidden border border-border/40 ${photo.className}`}>
              <Image src={photo.src} alt={photo.alt} fill className="object-cover" sizes={index === 0 ? "(max-width: 768px) 100vw, 58vw" : index === 3 ? "100vw" : "(max-width: 768px) 100vw, 42vw"} />
            </div>
          ))}
        </div>
        <Link href="/lookbook" className="mt-8 inline-flex min-h-11 items-center border border-border/60 px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-colors hover:border-accent hover:text-accent">Open the lookbook</Link>
      </div>
    </section>
  );
}
