"use client";

import Image from "next/image";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const photos = [
  { src: "/brand/lifestyle/lifestyle-1.jpeg", alt: "AHA lifestyle", span: "col-span-2 row-span-2" },
  { src: "/brand/lifestyle/lifestyle-2.jpg", alt: "AHA lifestyle", span: "col-span-1 row-span-1" },
  { src: "/brand/lifestyle/lifestyle-3.jpg", alt: "AHA lifestyle", span: "col-span-1 row-span-1" },
  { src: "/brand/lifestyle/lifestyle-4.jpg", alt: "AHA lifestyle", span: "col-span-2 row-span-1" },
];

export function EditorialGallery() {
  return (
    <section className="py-16 md:py-24 px-6 bg-charcoal">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
            {photos.map((photo, i) => (
              <div
                key={i}
                className={`relative overflow-hidden ${
                  i === 0
                    ? "md:col-span-2 md:row-span-2 aspect-[4/5] md:aspect-auto md:min-h-[500px]"
                    : i === 3
                    ? "md:col-span-2 aspect-[16/9]"
                    : "aspect-square"
                }`}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  className="object-cover"
                  sizes={i === 0 ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
