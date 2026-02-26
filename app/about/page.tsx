import { ScrollReveal } from "@/components/ui/ScrollReveal";

export const metadata = {
  title: "About | After Hours Agenda",
  description: "The story behind After Hours Agenda. Premium streetwear from New York City.",
};

export default function AboutPage() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <span className="font-mono text-label text-cream uppercase tracking-[0.2em] block mb-3 text-center">
            Our Story
          </span>
          <h1 className="font-display font-bold text-hero text-center mb-8">
            ABOUT
          </h1>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="space-y-8 font-body text-cream/80 leading-relaxed">
            <p className="text-lg">
              After Hours Agenda started in New York City &mdash; built in the hours
              that matter most, the ones after the world clocks out.
            </p>

            <p>
              We believe the clothes you wear should carry intention. Not just look good &mdash;
              but mean something. Every collection is built around an idea, a perspective,
              a way of seeing the world that doesn&apos;t follow the crowd.
            </p>

            <blockquote className="border-l-2 border-muted pl-6 py-2 font-body italic text-2xl text-cream">
              &ldquo;Fashion with a point of view. Made for the ones who have one.&rdquo;
            </blockquote>

            <p>
              <strong className="text-cream">Black Sheep</strong> is for the ones who stand apart.{" "}
              <strong className="text-cream">No Kings</strong> is for those who lead themselves.{" "}
              <strong className="text-cream">Night Mode</strong> is for the hours between midnight and dawn.{" "}
              <strong className="text-cream">NYC Forever</strong> carries the energy of the city that made us.
            </p>

            <p>
              Every piece is made to order &mdash; printed on premium blanks and shipped
              directly to you. No overproduction, no waste, no compromises. Quality
              streetwear that&apos;s worth the wait.
            </p>

            <p>
              Based in New York. Shipped worldwide.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
