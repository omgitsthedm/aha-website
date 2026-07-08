"use client";

import { useRef } from "react";
import Image from "next/image";

import { gsap, useGSAP } from "@/lib/gsap";

const photos = [
  { src: "/brand/lifestyle/lifestyle-1.jpeg", alt: "AHA lifestyle", colSpan: "md:col-span-8", aspect: "aspect-[4/5]", row: 1 },
  { src: "/brand/lifestyle/lifestyle-2.jpg", alt: "AHA lifestyle", colSpan: "md:col-span-4", aspect: "aspect-square", row: 1 },
  { src: "/brand/lifestyle/lifestyle-3.jpg", alt: "AHA lifestyle", colSpan: "md:col-span-4", aspect: "aspect-square", row: 2 },
  { src: "/brand/lifestyle/lifestyle-4.jpg", alt: "AHA lifestyle", colSpan: "md:col-span-8", aspect: "aspect-[16/9]", row: 2 },
];

export function EditorialGallery() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      // Images have parallax at different speeds based on row
      const images = sectionRef.current.querySelectorAll("[data-parallax]");
      images.forEach((img) => {
        const row = (img as HTMLElement).dataset.parallax;
        const speed = row === "1" ? 30 : 60;

        gsap.fromTo(
          img,
          { y: speed },
          {
            y: -speed,
            ease: "none",
            scrollTrigger: {
              trigger: img,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative z-[2] px-4 py-16 md:px-6 md:py-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <div className="mosaic-border" />
          <div className="sign-panel-station">
            <span className="sign-panel-station-text">Proof of Life</span>
          </div>
          <div className="mosaic-border" />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-7">
          {photos.map((photo, i) => (
            <div
              key={i}
              data-parallax={photo.row}
              className={`zine-block zine-cut relative overflow-hidden ${photo.colSpan} ${photo.aspect}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="xerox-image object-cover"
                sizes={
                  photo.colSpan === "md:col-span-8"
                    ? "(max-width: 768px) 100vw, 66vw"
                    : "(max-width: 768px) 100vw, 33vw"
                }
                priority={i === 0}
              />
            </div>
          ))}
        </div>
        <p
          className="mx-auto mt-8 max-w-xl border-[3px] border-[#E9E1D4] bg-[#15110F] px-4 py-3 text-center font-body font-bold uppercase text-[#E9E1D4]"
          style={{
            fontSize: "clamp(0.65rem, 1vw, 0.85rem)",
            letterSpacing: "0.08em",
          }}
        >
          Shot on location in New York City
        </p>
      </div>
    </section>
  );
}
