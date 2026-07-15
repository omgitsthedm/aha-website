import { SheepMark } from "@/components/ui/SheepMark";

const DASH = "600 34"; // periodic small breaks — tube breaks / mounting supports

/**
 * The black-sheep mark rendered as a rose neon glass tube: haze → glass tube →
 * lit core, with a plexiglass gloss sweep. Pure CSS/SVG. Wrap it in a
 * `.neon-sign` ancestor (sets the color) and optionally `.neon-flicker` (life).
 */
export function NeonSheep({ className = "" }: { className?: string }) {
  const sheep = `w-full h-full`;
  return (
    <div className={`neon2 ${className}`}>
      <SheepMark outline strokeWidth={168} className={`${sheep} neon2-haze`} />
      <SheepMark outline strokeWidth={150} strokeDasharray={DASH} className={`${sheep} neon2-tube`} />
      <SheepMark outline strokeWidth={62} strokeDasharray={DASH} title="After Hours Agenda black sheep, in neon" className={`${sheep} neon2-core`} />
      <span className="neon2-gloss" aria-hidden="true" />
    </div>
  );
}
