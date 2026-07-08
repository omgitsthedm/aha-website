interface WhiteBandProps {
  strong?: boolean;
  dark?: boolean;
  className?: string;
}

export function WhiteBand({ strong = false, dark = false, className = "" }: WhiteBandProps) {
  // In dark sections (footer, agenda, nav), override to use light divider colors
  if (dark) {
    return (
      <div
        className={`w-full ${className}`}
        style={{ borderBottom: strong ? "4px solid #E9E1D4" : "3px solid rgba(233, 225, 212, 0.55)" }}
        role="separator"
      />
    );
  }

  return (
    <div
      className={`w-full ${strong ? "white-band-strong" : "white-band"} ${className}`}
      role="separator"
    />
  );
}
