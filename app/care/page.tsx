export const metadata = {
  title: "Care Instructions | After Hours Agenda",
  description: "How to care for your After Hours Agenda pieces.",
};

export default function CarePage() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-chapter text-center mb-8">CARE INSTRUCTIONS</h1>
        <div className="space-y-6">
          {[
            { icon: "🧊", title: "Wash Cold", detail: "Machine wash cold with like colors. Cold water protects the print and the fabric." },
            { icon: "🔄", title: "Inside Out", detail: "Turn garments inside out before washing. This protects the print from friction and fading." },
            { icon: "🌡️", title: "Tumble Dry Low", detail: "Low heat only. High heat can damage prints and shrink fabric." },
            { icon: "⚠️", title: "No Iron on Print", detail: "If you need to iron, avoid the printed area. Iron inside out on low heat." },
            { icon: "🚫", title: "No Bleach", detail: "Never use bleach or harsh chemicals. They'll damage both the fabric and the print." },
            { icon: "📐", title: "No Dry Cleaning", detail: "The chemicals used in dry cleaning can damage direct-to-garment prints." },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 bg-surface border border-border rounded-sm p-6">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <h2 className="font-display font-bold text-base mb-1">{item.title}</h2>
                <p className="font-body text-sm text-cream/70">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
