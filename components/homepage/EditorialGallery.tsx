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
    <section ref={sectionRef} className="relative z-[2] py-20 md:py-28 px-6 bg-[#E8E4D8]">
      <div className="max-w-7xl mx-auto">
        {/* NYCTA Sign Panel */}
        <div className="mb-10">
          <div className="mosaic-border" />
          <div className="sign-panel-station">
            <span className="sign-panel-station-text">In the Wild</span>
          </div>
          <div className="mosaic-border" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
          {photos.map((photo, i) => (
            <div
              key={i}
              data-parallax={photo.row}
              className={`relative overflow-hidden ${photo.colSpan} ${photo.aspect} border border-cream/[0.12]`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover"
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
          className="font-body font-medium text-muted uppercase mt-8 text-center"
          style={{
            fontSize: "clamp(0.5rem, 0.7vw, 0.6rem)",
            letterSpacing: "0.2em",
          }}
        >
          Shot on Location &mdash; New York City
        </p>
      </div>
    </section>
  );
}
