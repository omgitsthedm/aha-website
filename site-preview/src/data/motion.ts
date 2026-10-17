// Short collection films, keyed by the campaign photo they play over. The photo stays
// the page's main image; the film fades in over it after load (src/scripts/motion.ts).
// Each film cuts high-angle New York night footage (real, Pexels license) with
// sub-second torso shots of the pieces (AI-generated from the campaign photos).
import films from "./motion.json" with { type: "json" };

export interface Motion {
  /** Film for wider screens. */
  large: string;
  /** Lighter film for phones. */
  small: string;
  seconds: number;
  /** Caption while the film plays; says what is real and what is AI-generated. */
  label: string;
  /** City footage, for the record (Pexels license; credit not required). */
  city: { pexels: number; creator: string }[];
  /** Garment shots: how each was made and from which campaign photo. */
  garments: { photo: string; seed: number; generator: string }[];
}

export const motionFor = (src: string): Motion | undefined => (films as Record<string, Motion>)[src];
