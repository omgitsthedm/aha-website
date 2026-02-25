"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { gsap, useGSAP } from "@/lib/gsap";
import { SUBWAY_LINES } from "@/lib/utils/subway-lines";
import { RouteBadge } from "@/components/ui/RouteBadge";
import Link from "next/link";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface Station {
  id: string;
  slug: string;
  label: string;
  x: number;
  y: number;
  color: string;
  lineAbbr: string;
  /** Offset for the text label relative to the station dot */
  labelAnchor?: "start" | "middle" | "end";
  labelDx?: number;
  labelDy?: number;
}

interface MapLine {
  id: string;
  color: string;
  /** SVG path `d` attribute */
  path: string;
  /** Station IDs this line passes through (in order) */
  stations: string[];
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

const STATIONS: Station[] = [
  {
    id: "hub",
    slug: "shop",
    label: "ALL LINES",
    x: 400,
    y: 250,
    color: "#A7A9AC",
    lineAbbr: "AL",
    labelAnchor: "middle",
    labelDx: 0,
    labelDy: -22,
  },
  {
    id: "black-sheep",
    slug: "black-sheep",
    label: "BLACK SHEEP",
    x: 140,
    y: 110,
    color: "#EE352E",
    lineAbbr: "BS",
    labelAnchor: "start",
    labelDx: 20,
    labelDy: -14,
  },
  {
    id: "no-kings",
    slug: "no-kings",
    label: "NO KINGS",
    x: 660,
    y: 160,
    color: "#2850AD",
    lineAbbr: "NK",
    labelAnchor: "end",
    labelDx: -20,
    labelDy: -14,
  },
  {
    id: "night-mode",
    slug: "night-mode",
    label: "NIGHT MODE",
    x: 180,
    y: 390,
    color: "#FF6319",
    lineAbbr: "NM",
    labelAnchor: "start",
    labelDx: 20,
    labelDy: 5,
  },
  {
    id: "nyc-forever",
    slug: "nyc-forever",
    label: "NYC FOREVER",
    x: 620,
    y: 390,
    color: "#00933C",
    lineAbbr: "NY",
    labelAnchor: "end",
    labelDx: -20,
    labelDy: 5,
  },
  {
    id: "new-arrivals",
    slug: "new-arrivals",
    label: "NEW ARRIVALS",
    x: 400,
    y: 440,
    color: "#FCCC0A",
    lineAbbr: "NA",
    labelAnchor: "middle",
    labelDx: 0,
    labelDy: 28,
  },
];

const LINES: MapLine[] = [
  {
    id: "red",
    color: "#EE352E",
    path: "M 140 110 C 200 140, 310 200, 400 250",
    stations: ["black-sheep", "hub"],
  },
  {
    id: "blue",
    color: "#2850AD",
    path: "M 400 250 C 490 220, 570 190, 660 160",
    stations: ["hub", "no-kings"],
  },
  {
    id: "orange",
    color: "#FF6319",
    path: "M 180 390 C 240 350, 310 300, 400 250",
    stations: ["night-mode", "hub"],
  },
  {
    id: "green",
    color: "#00933C",
    path: "M 400 250 C 470 300, 540 340, 620 390",
    stations: ["hub", "nyc-forever"],
  },
  {
    id: "yellow",
    color: "#FCCC0A",
    path: "M 180 390 C 250 430, 320 450, 400 440 C 480 430, 550 420, 620 390",
    stations: ["night-mode", "new-arrivals", "nyc-forever"],
  },
];
/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function SubwayMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);
  const [focusedStation, setFocusedStation] = useState<string | null>(null);
  const router = useRouter();

  /* ---- Navigation ---- */
  const navigateTo = useCallback(
    (slug: string) => {
      if (slug === "shop") {
        router.push("/shop");
      } else {
        router.push(`/collections/${slug}`);
      }
    },
    [router]
  );

  /* ---- GSAP scroll-triggered entrance animation ---- */
  useGSAP(
    () => {
      if (!svgRef.current) return;

      const paths = svgRef.current.querySelectorAll<SVGPathElement>("[data-subway-line]");
      const stationDots = svgRef.current.querySelectorAll<SVGElement>("[data-station-dot]");
      const stationLabels = svgRef.current.querySelectorAll<SVGElement>("[data-station-label]");
      const stationBadges = svgRef.current.querySelectorAll<SVGElement>("[data-station-badge]");

      /* Set initial state: lines hidden via dashoffset, stations invisible */
      paths.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
      });

      gsap.set(stationDots, { scale: 0, transformOrigin: "center center", opacity: 0 });
      gsap.set(stationLabels, { opacity: 0, y: 6 });
      gsap.set(stationBadges, { scale: 0, transformOrigin: "center center", opacity: 0 });

      /* Timeline */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none none",
          once: true,
        },
      });

      /* 1. Draw the lines */
      paths.forEach((path, i) => {
        const length = path.getTotalLength();
        tl.to(
          path,
          {
            strokeDashoffset: 0,
            duration: 1.2,
            ease: "power2.inOut",
          },
          i * 0.15
        );
      });

      /* 2. Pop in the station dots */
      tl.to(
        stationDots,
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: "back.out(2)",
          stagger: 0.08,
        },
        0.6
      );

      /* 3. Pop in the line badges inside stations */
      tl.to(
        stationBadges,
        {
          scale: 1,
          opacity: 1,
          duration: 0.4,
          ease: "back.out(1.7)",
          stagger: 0.08,
        },
        0.8
      );

      /* 4. Fade in the labels */
      tl.to(
        stationLabels,
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.06,
        },
        1.0
      );

      /* Also animate the mobile strip if present */
      const mobileRows = containerRef.current?.querySelectorAll<HTMLElement>("[data-mobile-row]");
      if (mobileRows && mobileRows.length > 0) {
        gsap.set(mobileRows, { opacity: 0, x: -20 });
        gsap.to(mobileRows, {
          opacity: 1,
          x: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
            once: true,
          },
        });
      }
    },
    { scope: containerRef }
  );

  /* ---- Interaction helpers ---- */
  const isActive = (id: string) => hoveredStation === id || focusedStation === id;

  /* ---- Render ---- */
  return (
    <section
      ref={containerRef}
      className="relative py-20 md:py-28 bg-void overflow-hidden"
      aria-label="Collection subway map navigation"
    >
      {/* Section heading */}
      <div className="max-w-4xl mx-auto px-6 mb-10 md:mb-14">
        <span className="font-mono text-label text-muted uppercase tracking-[0.2em] block mb-3">
          Navigate the lines
        </span>
        <h2 className="font-display font-bold text-chapter text-cream">
          System Map
        </h2>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Desktop SVG Map                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden md:block max-w-4xl mx-auto px-6">
        <div className="relative rounded-lg border border-border bg-charcoal/60 p-4 md:p-8">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 rounded-lg opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#E8E4DE 1px, transparent 1px), linear-gradient(90deg, #E8E4DE 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <svg
            ref={svgRef}
            viewBox="0 0 800 500"
            className="w-full h-auto"
            role="navigation"
            aria-label="Interactive subway map - click a station to explore a collection"
          >
            <title>AHA Collection Subway Map</title>

            {/* ------ Track bed (wide transparent bg lines for visual depth) ------ */}
            {LINES.map((line) => (
              <path
                key={`bed-${line.id}`}
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth={20}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.06}
              />
            ))}

            {/* ------ Animated subway lines ------ */}
            {LINES.map((line) => (
              <path
                key={line.id}
                data-subway-line={line.id}
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-opacity duration-300"
                style={{
                  filter: `drop-shadow(0 0 6px ${line.color}40)`,
                }}
              />
            ))}

            {/* ------ Stations ------ */}
            {STATIONS.map((station) => {
              const active = isActive(station.id);
              const isHub = station.id === "hub";
              const baseR = isHub ? 16 : 11;
              const activeR = isHub ? 19 : 14;
              const r = active ? activeR : baseR;

              return (
                <g
                  key={station.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Navigate to ${station.label} collection`}
                  className="cursor-pointer outline-none"
                  onMouseEnter={() => setHoveredStation(station.id)}
                  onMouseLeave={() => setHoveredStation(null)}
                  onFocus={() => setFocusedStation(station.id)}
                  onBlur={() => setFocusedStation(null)}
                  onClick={() => navigateTo(station.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateTo(station.slug);
                    }
                  }}
                >
                  {/* Glow ring on hover / focus */}
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r={active ? activeR + 6 : baseR + 4}
                    fill="none"
                    stroke={station.color}
                    strokeWidth={2}
                    className="transition-all duration-300"
                    opacity={active ? 0.5 : 0}
                  />

                  {/* Outer colored ring */}
                  <circle
                    data-station-dot
                    cx={station.x}
                    cy={station.y}
                    r={r}
                    fill="#141414"
                    stroke={active ? station.color : "#E8E4DE"}
                    strokeWidth={active ? 3.5 : 2.5}
                    className="transition-all duration-200"
                    style={
                      active
                        ? { filter: `drop-shadow(0 0 8px ${station.color}80)` }
                        : undefined
                    }
                  />

                  {/* Inner white fill circle */}
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r={r - 3}
                    fill={active ? station.color : "#E8E4DE"}
                    className="transition-all duration-200"
                  />

                  {/* Line abbreviation badge */}
                  <text
                    data-station-badge
                    x={station.x}
                    y={station.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={
                      active
                        ? station.color === "#FCCC0A"
                          ? "#141414"
                          : "#FFFFFF"
                        : "#141414"
                    }
                    fontSize={isHub ? 11 : 9}
                    fontFamily="var(--font-ibm-plex), monospace"
                    fontWeight={600}
                    className="transition-all duration-200 select-none pointer-events-none"
                  >
                    {station.lineAbbr}
                  </text>

                  {/* Station label */}
                  <text
                    data-station-label
                    x={station.x + (station.labelDx ?? 0)}
                    y={station.y + (station.labelDy ?? 0)}
                    textAnchor={station.labelAnchor ?? "middle"}
                    fill={active ? "#E8E4DE" : "#7A756E"}
                    fontSize={11}
                    fontFamily="var(--font-ibm-plex), monospace"
                    fontWeight={active ? 600 : 400}
                    letterSpacing="0.08em"
                    className="transition-all duration-200 select-none pointer-events-none"
                  >
                    {station.label}
                  </text>

                  {/* Focus ring for keyboard navigation */}
                  {focusedStation === station.id && (
                    <circle
                      cx={station.x}
                      cy={station.y}
                      r={activeR + 10}
                      fill="none"
                      stroke="#E8E4DE"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      opacity={0.6}
                    />
                  )}
                </g>
              );
            })}

            {/* Transfer indicators at hub */}
            <g data-station-label className="pointer-events-none select-none">
              <text
                x={400}
                y={218}
                textAnchor="middle"
                fill="#7A756E"
                fontSize={8}
                fontFamily="var(--font-ibm-plex), monospace"
                letterSpacing="0.15em"
              >
                TRANSFER
              </text>
            </g>
          </svg>

          {/* Legend bar below the map */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 pt-5 border-t border-border">
            {Object.values(SUBWAY_LINES).map((line) => (
              <Link
                key={line.slug}
                href={`/collections/${line.slug}`}
                className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity group"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: line.color }}
                />
                <span className="font-mono text-[10px] text-muted group-hover:text-cream tracking-wide transition-colors">
                  {line.mtaLine} {line.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Mobile Strip Layout                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden px-6">
        <nav aria-label="Collection navigation" className="space-y-0">
          {/* Hub / All Products row */}
          <Link
            href="/shop"
            data-mobile-row
            className="group flex items-center gap-4 py-4 border-b border-border hover:bg-surface transition-colors -mx-2 px-2 rounded"
          >
            <span className="relative flex-shrink-0">
              <span
                className="w-10 h-10 rounded-full inline-flex items-center justify-center font-mono text-xs font-semibold"
                style={{ backgroundColor: "#A7A9AC", color: "#141414" }}
              >
                AL
              </span>
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-full animate-pulse-station border-2 border-line-gray opacity-30" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm text-cream group-hover:text-white transition-colors block">
                All Lines
              </span>
              <span className="font-mono text-[10px] text-muted tracking-wider">
                SHOP ALL PRODUCTS
              </span>
            </div>
            <span className="font-mono text-sm text-muted group-hover:text-cream transition-colors">
              &rarr;
            </span>
          </Link>

          {/* Collection rows */}
          {Object.values(SUBWAY_LINES).map((line) => (
            <Link
              key={line.slug}
              href={`/collections/${line.slug}`}
              data-mobile-row
              className="group flex items-center gap-4 py-4 border-b border-border hover:bg-surface transition-colors -mx-2 px-2 rounded"
            >
              <RouteBadge line={line} size="lg" />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-sm text-cream group-hover:text-white transition-colors block">
                  {line.name}
                </span>
                <span className="font-mono text-[10px] text-muted tracking-wider">
                  {line.mtaLine} LINE
                </span>
              </div>
              <span
                className="font-mono text-sm transition-colors"
                style={{ color: line.color }}
              >
                &rarr;
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

export default SubwayMap;
