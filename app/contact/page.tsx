export const metadata = {
  title: "Contact | After Hours Agenda",
  description: "Get in touch with After Hours Agenda.",
};

export default function ContactPage() {
  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="misprint font-display text-[clamp(4rem,10vw,8rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] mb-4">CONTACT</h1>
        <p className="font-body text-muted mb-12 max-w-md mx-auto font-bold">
          Questions, feedback, or just saying hey. We&apos;d love to hear from you.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="zine-block p-8">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">Email</h2>
            <p className="font-mono text-sm text-cream">hello@afterhoursagenda.com</p>
            <p className="text-sm text-muted mt-2">We&apos;ll get back to you within 24 hours.</p>
          </div>
          <div className="zine-block p-8">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">Social</h2>
            <p className="font-mono text-sm text-cream">@afterhoursagenda</p>
            <p className="text-sm text-muted mt-2">Slide into our DMs on Instagram or TikTok.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
