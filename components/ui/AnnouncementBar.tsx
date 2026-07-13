export function AnnouncementBar() {
  return (
    <aside aria-label="Store announcement" className="fixed inset-x-0 top-0 z-[110] flex h-8 items-center justify-center border-b border-accent bg-accent text-white">
      <p className="truncate px-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.04em] sm:text-[11px]">
        Shipping included / Made to order / 30-day returns
      </p>
    </aside>
  );
}

export default AnnouncementBar;
