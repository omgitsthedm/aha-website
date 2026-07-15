import { NeonBand } from "@/components/homepage/NeonBand";

// TEMPORARY preview to tune the neon treatment. Remove after it's placed.
export const metadata = { title: "Neon preview", robots: { index: false, follow: false } };

export default function NeonPreviewPage() {
  return (
    <div className="pt-24">
      <NeonBand />
    </div>
  );
}
