export const metadata = {
  title: "Contact | After Hours Agenda",
  description: "Get in touch with After Hours Agenda.",
};

export default function ContactPage() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="font-display font-bold text-chapter mb-4">CONTACT</h1>
        <p className="font-body text-muted mb-12 max-w-md mx-auto">
          Questions, feedback, or just saying hey — we'd love to hear from you.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="bg-surface border border-border rounded-sm p-8">
            <h2 className="font-display font-bold text-lg mb-3">Email</h2>
            <p className="font-mono text-sm text-cream">hello@afterhoursagenda.com</p>
            <p className="text-sm text-muted mt-2">We'll get back to you within 24 hours.</p>
          </div>
          <div className="bg-surface border border-border rounded-sm p-8">
            <h2 className="font-display font-bold text-lg mb-3">Social</h2>
            <p className="font-mono text-sm text-cream">@afterhoursagenda</p>
            <p className="text-sm text-muted mt-2">Slide into our DMs on Instagram or TikTok.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
