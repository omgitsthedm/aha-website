export function AnnouncementBar() {
  return (
    <aside aria-label="Store announcement" className="fixed inset-x-0 top-0 z-[110] flex h-8 items-center justify-center border-b border-accent bg-accent text-void">
      <p className="px-4 text-center font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
        Shipping included / 2-5 business days in production / Secure Square checkout
      </p>
    </aside>
  );
}

export default AnnouncementBar;
