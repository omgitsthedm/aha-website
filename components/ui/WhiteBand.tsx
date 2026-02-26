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
        style={{ borderBottom: strong ? "2px solid #E8E4DE" : "2px solid rgba(232, 228, 222, 0.15)" }}
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
