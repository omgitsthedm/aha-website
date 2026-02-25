interface WhiteBandProps {
  strong?: boolean;
  className?: string;
}

export function WhiteBand({ strong = false, className = "" }: WhiteBandProps) {
  return (
    <div
      className={`w-full ${strong ? "white-band-strong" : "white-band"} ${className}`}
      role="separator"
    />
  );
}
