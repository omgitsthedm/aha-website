import Image from "next/image";

export function Entrance() {
  return (
    <section className="min-h-screen bg-void flex flex-col items-center justify-center px-6 border-b-2 border-line-yellow">
      {/* Sheep silhouette */}
      <div className="max-w-[280px] md:max-w-[400px] w-full opacity-15">
        <Image
          src="/brand/sheep-full.svg"
          alt="After Hours Agenda"
          width={400}
          height={400}
          className="w-full h-auto"
          priority
        />
      </div>

      {/* Headline */}
      <h1 className="font-display font-bold text-hero uppercase text-cream text-center mt-8">
        Built for the ones still moving
      </h1>

      {/* Subline */}
      <p className="font-mono text-sm text-muted tracking-[0.2em] text-center mt-6 uppercase">
        after hours agenda &mdash; est. nyc
      </p>
    </section>
  );
}

export default Entrance;
