import { ScrollReveal } from "@/components/ui/ScrollReveal";

export const metadata = {
  title: "About | After Hours Agenda",
  description: "The story behind After Hours Agenda. NYC-born streetwear for the ones who think different.",
};

export default function AboutPage() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <span className="font-mono text-label text-glow uppercase tracking-[0.2em] block mb-3 text-center">
            Our Story
          </span>
          <h1 className="font-display font-bold text-hero text-center mb-8">
            ABOUT
          </h1>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="space-y-8 font-body text-cream/80 leading-relaxed">
            <p className="text-lg">
              After Hours Agenda was born in the late-night energy of New York City &mdash;
              in the hours when the rest of the world sleeps and the real ones come alive.
            </p>

            <p>
              We started with a simple belief: the clothes you wear should mean something.
              Not just look good &mdash; but carry a message. Every collection we drop is
              built around an idea, a mindset, a way of moving through the world.
            </p>

            <blockquote className="border-l-2 border-glow pl-6 py-2 font-editorial italic text-2xl text-cream">
              &ldquo;For the ones who stay out late. For the ones who think different.
              For the ones who write their own rules.&rdquo;
            </blockquote>

            <p>
              <strong className="text-cream">Black Sheep</strong> is for the ones who stand apart.{" "}
              <strong className="text-cream">No Kings</strong> is for those who lead themselves.{" "}
              <strong className="text-cream">Night Mode</strong> is for the hours between midnight and dawn.{" "}
              <strong className="text-cream">NYC Forever</strong> carries the energy of the city that made us.
            </p>

            <p>
              Every piece is made to order &mdash; printed on premium blanks, shipped directly
              to you. No overproduction. No waste. No shortcuts. Just quality streetwear
              with a story behind every stitch.
            </p>

            <p>
              Based in NYC. Made for everywhere.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
