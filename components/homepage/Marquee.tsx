const PHRASES = [
  "Made after hours",
  "New York City",
  "Printed to order",
  "No permission needed",
  "The Black Sheep",
  "Worn a hundred ways",
  "Est. 2011",
];

/**
 * Infinite scrolling brand marquee — pure CSS motion (GPU translate), reduced-
 * motion safe. The track is duplicated so the loop is seamless. Adds pulse to
 * the homepage without any imagery.
 */
export function Marquee() {
  // Self-contained spans (their own trailing space) so two identical copies loop
  // seamlessly at translateX(-50%).
  const run = (key: string) =>
    PHRASES.map((phrase) => (
      <span key={`${key}-${phrase}`} className="flex items-center gap-6 pr-6 sm:gap-10 sm:pr-10">
        <span className="font-display text-2xl font-black uppercase tracking-[-0.02em] sm:text-3xl">{phrase}</span>
        <span aria-hidden="true" className="text-lg text-void/70">✦</span>
      </span>
    ));

  return (
    <div className="marquee bg-accent py-3 text-void sm:py-4" aria-label={PHRASES.join(", ")}>
      <div className="marquee-track flex w-max items-center">
        {run("a")}
        {run("b")}
      </div>
    </div>
  );
}
