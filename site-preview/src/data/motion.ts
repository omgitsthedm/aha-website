// Short collection films resolved by a stable collection ID, with legacy photo keys retained. The photo stays
// the page's main image; the film fades in over it after load (src/scripts/motion.ts).
// Each film cuts high-angle New York night footage (real, Pexels license) with
// sub-second torso shots of the pieces (AI-generated from the campaign photos).
import films from "./motion.json" with { type: "json" };

export interface Motion {
  collectionId: string;
  /** Film for wider screens. */
  large: string;
  /** Lighter film for phones (home and collection heroes). */
  small: string;
  /** Phone film for the full-screen lookbook, whose crop keeps only the middle of the frame;
   *  its time stamp sits lower, under the print. */
  tall: string;
  seconds: number;
  /** Caption while the film plays; says what is real and what is AI-generated. */
  label: string;
  /** City footage, for the record (Pexels license; credit not required). */
  city: { pexels: number; creator: string }[];
  /** Garment shots: how each was made and from which campaign photo. */
  garments: { photo: string; seed: number; generator: string }[];
}

export const motionFor = (key: string): Motion | undefined => Object.values(films).find(film => film.collectionId === key) ?? (films as Record<string, Motion>)[key];
