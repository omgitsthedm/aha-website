import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "After Hours Agenda",
  description: "After Hours Agenda",
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return (
    <section className="flex min-h-[100dvh] items-end px-5 pb-6 pt-24 sm:px-8 sm:pb-8 lg:px-12 lg:pb-10">
      <h1 className="max-w-[12ch] font-display text-[clamp(4rem,15vw,13rem)] font-bold uppercase leading-[0.72] tracking-[-0.07em] text-cream">
        After Hours Agenda
      </h1>
    </section>
  );
}
