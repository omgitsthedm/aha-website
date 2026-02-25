import Image from "next/image";

const photos = [
  { src: "/brand/lifestyle/lifestyle-1.jpeg", alt: "AHA lifestyle", colSpan: "md:col-span-8", aspect: "aspect-[4/5]" },
  { src: "/brand/lifestyle/lifestyle-2.jpg", alt: "AHA lifestyle", colSpan: "md:col-span-4", aspect: "aspect-square" },
  { src: "/brand/lifestyle/lifestyle-3.jpg", alt: "AHA lifestyle", colSpan: "md:col-span-4", aspect: "aspect-square" },
  { src: "/brand/lifestyle/lifestyle-4.jpg", alt: "AHA lifestyle", colSpan: "md:col-span-8", aspect: "aspect-[16/9]" },
];

export function EditorialGallery() {
  return (
    <section className="py-16 md:py-24 px-6 bg-void">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
          {photos.map((photo, i) => (
            <div
              key={i}
              className={`relative overflow-hidden ${photo.colSpan} ${photo.aspect}`}
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
        <p className="font-mono text-[11px] text-muted tracking-[0.1em] mt-6 text-center">
          shot on location &mdash; new york city
        </p>
      </div>
    </section>
  );
}
