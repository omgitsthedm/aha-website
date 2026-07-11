import Image from "next/image";

const photos = [
  { src: "/brand/lifestyle/lifestyle-1.jpeg", alt: "After Hours Agenda campaign portrait", className: "md:col-span-7 md:row-span-2" },
  { src: "/brand/lifestyle/lifestyle-2.jpg", alt: "After Hours Agenda clothing in New York", className: "md:col-span-5" },
  { src: "/brand/lifestyle/lifestyle-3.jpg", alt: "After Hours Agenda streetwear detail", className: "md:col-span-5" },
];

export function EditorialGallery() {
  return (
    <section className="relative z-[2] px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 max-w-2xl border-t-2 border-accent pt-5">
          <h2 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">AHA in the city</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted">Clothing shown in the world it was made for.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-12 md:grid-rows-2">
          {photos.map((photo, index) => (
            <div key={photo.src} className={`relative min-h-[320px] overflow-hidden border border-border/40 ${photo.className}`}>
              <Image src={photo.src} alt={photo.alt} fill priority={index === 0} className="object-cover" sizes={index === 0 ? "(max-width: 768px) 100vw, 58vw" : "(max-width: 768px) 100vw, 42vw"} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
