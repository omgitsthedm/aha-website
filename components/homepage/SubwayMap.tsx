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
  labelAnchor?: "start" | "middle" | "end";
  labelDx?: number;
  labelDy?: number;
  isHub?: boolean;
}

interface MapLine {
  id: string;
  color: string;
  path: string;
  stations: string[];
}

/* -------------------------------------------------------------------------- */
/*  Station Data  (NYC geography-accurate positions)                           */
/* -------------------------------------------------------------------------- */

const STATIONS: Station[] = [
  // ---- Hub / Transfer Station (Times Sq / Herald Sq area) ----
  {
    id: "hub",
    slug: "shop",
    label: "AHA HUB",
    x: 310,
    y: 260,
    color: "#A7A9AC",
    lineAbbr: "ALL",
    labelAnchor: "end",
    labelDx: -18,
    labelDy: -16,
    isHub: true,
  },
  // ---- Red Line: 1/2/3 Black Sheep (midtown west side) ----
  {
    id: "black-sheep",
    slug: "black-sheep",
    label: "BLACK SHEEP",
    x: 270,
    y: 250,
    color: "#EE352E",
    lineAbbr: "BS",
    labelAnchor: "end",
    labelDx: -16,
    labelDy: 4,
  },
  // ---- Blue Line: A/C/E No Kings (deep Brooklyn) ----
  {
    id: "no-kings",
    slug: "no-kings",
    label: "NO KINGS",
    x: 580,
    y: 480,
    color: "#2850AD",
    lineAbbr: "NK",
    labelAnchor: "start",
    labelDx: 16,
    labelDy: 4,
  },
  // ---- Orange Line: B/D/F/M Night Mode (Queens) ----
  {
    id: "night-mode",
    slug: "night-mode",
    label: "NIGHT MODE",
    x: 650,
    y: 150,
    color: "#FF6319",
    lineAbbr: "NM",
    labelAnchor: "start",
    labelDx: 16,
    labelDy: 4,
  },
  // ---- Green Line: 4/5/6 NYC Forever (midtown east / Grand Central) ----
  {
    id: "nyc-forever",
    slug: "nyc-forever",
    label: "NYC FOREVER",
    x: 350,
    y: 220,
    color: "#00933C",
    lineAbbr: "NY",
    labelAnchor: "start",
    labelDx: 16,
    labelDy: 4,
  },
  // ---- Yellow Line: N/Q/R/W New Arrivals (Times Sq area) ----
  {
    id: "new-arrivals",
    slug: "new-arrivals",
    label: "NEW ARRIVALS",
    x: 310,
    y: 260,
    color: "#FCCC0A",
    lineAbbr: "NA",
    labelAnchor: "start",
    labelDx: 18,
    labelDy: 16,
  },
];

/* -------------------------------------------------------------------------- */
/*  Line Paths  (realistic NYC subway routing with bezier curves)              */
/* -------------------------------------------------------------------------- */

const LINES: MapLine[] = [
  // Red Line (1/2/3) - West side of Manhattan, extends into Brooklyn
  {
    id: "red",
    color: "#EE352E",
    path: [
      "M 250 80",        // Upper Manhattan (west)
      "C 252 120, 258 170, 260 200",  // Down the west side
      "L 270 250",        // BLACK SHEEP station (midtown west)
      "C 275 280, 280 310, 285 340",  // Continue south
      "L 300 420",        // Lower Manhattan
      "C 310 450, 340 480, 380 500",  // Curve into Brooklyn
      "C 420 520, 460 530, 500 540",  // Deep Brooklyn
    ].join(" "),
    stations: ["black-sheep"],
  },
  // Blue Line (A/C/E) - 8th Avenue, crosses to Brooklyn
  {
    id: "blue",
    color: "#2850AD",
    path: [
      "M 260 100",        // Upper Manhattan
      "C 265 140, 272 180, 280 220",  // Down 8th Avenue
      "L 290 280",        // Through hub area
      "C 295 310, 300 340, 305 370",  // West Village
      "L 310 400",        // Lower west side
      "C 330 430, 380 460, 440 480",  // Cross toward Brooklyn
      "C 500 495, 540 485, 580 480",  // NO KINGS station
      "C 620 475, 660 465, 700 450",  // Deep Brooklyn continues
    ].join(" "),
    stations: ["no-kings"],
  },
  // Orange Line (B/D/F/M) - Queens to Manhattan to Brooklyn
  {
    id: "orange",
    color: "#FF6319",
    path: [
      "M 750 120",        // Far Queens
      "C 720 130, 690 140, 650 150",  // NIGHT MODE station
      "C 600 165, 520 200, 450 240",  // Cross East River into midtown
      "C 400 255, 350 258, 310 260",  // Through hub
      "C 310 300, 315 340, 320 380",  // Down through Manhattan
      "L 325 420",        // Lower Manhattan
      "C 340 450, 400 480, 460 500",  // Into Brooklyn
      "C 500 510, 530 512, 550 510",  // Brooklyn
    ].join(" "),
    stations: ["night-mode"],
  },
  // Green Line (4/5/6) - East side of Manhattan
  {
    id: "green",
    color: "#00933C",
    path: [
      "M 340 80",         // Upper east side
      "C 342 110, 345 150, 348 190",  // Down Lexington
      "L 350 220",        // NYC FOREVER station (Grand Central)
      "C 348 260, 340 300, 335 340",  // Continue south
      "L 330 400",        // City Hall area
      "C 340 430, 370 460, 410 490",  // Curve into Brooklyn
      "C 440 505, 460 515, 480 520",  // Brooklyn
    ].join(" "),
    stations: ["nyc-forever"],
  },
  // Yellow Line (N/Q/R/W) - Astoria through midtown into Brooklyn
  {
    id: "yellow",
    color: "#FCCC0A",
    path: [
      "M 700 100",        // Astoria, Queens
      "C 660 120, 580 160, 500 200",  // Cross Queensboro
      "C 440 225, 380 245, 310 260",  // NEW ARRIVALS / Hub area
      "C 310 290, 312 320, 312 350",  // South through Manhattan
      "L 314 400",        // Lower Manhattan
      "C 330 440, 400 480, 480 510",  // Into Brooklyn
      "C 540 530, 580 535, 620 530",  // Deep Brooklyn
    ].join(" "),
    stations: ["new-arrivals"],
  },
];

/* -------------------------------------------------------------------------- */
/*  Geographic Shapes (subtle Manhattan island, waterline, etc.)               */
/* -------------------------------------------------------------------------- */

// Manhattan island outline - long narrow tilted shape
const MANHATTAN_ISLAND = [
  "M 235 55",
  "C 250 50, 340 48, 355 55",  // Northern tip (Inwood)
  "L 365 100",
  "C 370 180, 365 280, 360 380",  // East coast
  "L 350 440",
  "C 340 470, 320 490, 305 500",  // Battery Park / southern tip
  "C 290 505, 275 495, 260 480",  // West side southern
  "L 245 400",
  "C 240 320, 238 220, 235 140",  // West coast
  "Z",
].join(" ");

// East River (separating Manhattan from Brooklyn/Queens)
const EAST_RIVER = [
  "M 370 50",
  "C 380 80, 385 140, 380 200",
  "C 375 260, 370 320, 365 380",
  "C 360 420, 350 455, 340 480",
  "C 330 510, 310 530, 280 545",
  "C 320 545, 360 540, 400 530",
].join(" ");

// Hudson River (west side of Manhattan)
const HUDSON_RIVER = [
  "M 225 50",
  "C 220 100, 218 200, 220 300",
  "C 222 380, 228 440, 240 490",
  "C 250 510, 270 520, 290 525",
].join(" ");

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
      const geoElements = svgRef.current.querySelectorAll<SVGElement>("[data-geo]");

      /* Set initial state */
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
      gsap.set(geoElements, { opacity: 0 });

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

      /* 0. Fade in geography */
      tl.to(geoElements, {
        opacity: 1,
        duration: 1.0,
        ease: "power1.in",
      }, 0);

      /* 1. Draw the lines */
      paths.forEach((path, i) => {
        tl.to(
          path,
          {
            strokeDashoffset: 0,
            duration: 1.4,
            ease: "power2.inOut",
          },
          0.3 + i * 0.12
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
        0.8
      );

      /* 3. Pop in the line badges */
      tl.to(
        stationBadges,
        {
          scale: 1,
          opacity: 1,
          duration: 0.4,
          ease: "back.out(1.7)",
          stagger: 0.08,
        },
        1.0
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
        1.1
      );

      /* Mobile strip animation */
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

  /* ---- Render a station group ---- */
  const renderStation = (station: Station) => {
    const active = isActive(station.id);
    const isHub = station.isHub ?? false;
    const baseR = isHub ? 12 : 8;
    const activeR = isHub ? 15 : 11;
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
          r={active ? activeR + 8 : baseR + 5}
          fill="none"
          stroke={station.color}
          strokeWidth={1.5}
          className="transition-all duration-300"
          opacity={active ? 0.45 : 0}
        />

        {/* Hub double ring */}
        {isHub && (
          <circle
            data-station-dot
            cx={station.x}
            cy={station.y}
            r={r + 4}
            fill="none"
            stroke={active ? station.color : "#E8E4DE"}
            strokeWidth={1.5}
            className="transition-all duration-200"
            opacity={0.5}
          />
        )}

        {/* Station dot - outer ring */}
        <circle
          data-station-dot
          cx={station.x}
          cy={station.y}
          r={r}
          fill="#141414"
          stroke={active ? station.color : "#E8E4DE"}
          strokeWidth={active ? 3 : 2}
          className="transition-all duration-200"
          style={
            active
              ? { filter: `drop-shadow(0 0 8px ${station.color}90)` }
              : undefined
          }
        />

        {/* Station dot - inner fill */}
        <circle
          cx={station.x}
          cy={station.y}
          r={r - 2.5}
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
          fontSize={isHub ? 9 : 7.5}
          fontFamily="var(--font-ibm-plex), monospace"
          fontWeight={700}
          letterSpacing="0.02em"
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
          fontSize={10}
          fontFamily="var(--font-ibm-plex), monospace"
          fontWeight={active ? 600 : 400}
          letterSpacing="0.1em"
          className="transition-all duration-200 select-none pointer-events-none"
        >
          {station.label}
        </text>

        {/* MTA designation under label */}
        {!isHub && (
          <text
            data-station-label
            x={station.x + (station.labelDx ?? 0)}
            y={station.y + (station.labelDy ?? 0) + 12}
            textAnchor={station.labelAnchor ?? "middle"}
            fill={active ? "#7A756E" : "#4A463F"}
            fontSize={7.5}
            fontFamily="var(--font-ibm-plex), monospace"
            fontWeight={400}
            letterSpacing="0.08em"
            className="transition-all duration-200 select-none pointer-events-none"
          >
            {SUBWAY_LINES[station.slug]?.mtaLine ?? ""}
          </text>
        )}

        {/* Focus ring for keyboard navigation */}
        {focusedStation === station.id && (
          <circle
            cx={station.x}
            cy={station.y}
            r={activeR + 12}
            fill="none"
            stroke="#E8E4DE"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.6}
          />
        )}
      </g>
    );
  };

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
            className="absolute inset-0 rounded-lg opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#E8E4DE 1px, transparent 1px), linear-gradient(90deg, #E8E4DE 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <svg
            ref={svgRef}
            viewBox="0 0 900 600"
            className="w-full h-auto"
            role="navigation"
            aria-label="Interactive subway map - click a station to explore a collection"
          >
            <title>After Hours Agenda - NYC System Map</title>

            {/* ============================================================ */}
            {/*  GEOGRAPHY LAYER                                              */}
            {/* ============================================================ */}

            {/* Manhattan island shape */}
            <path
              data-geo
              d={MANHATTAN_ISLAND}
              fill="rgba(232, 228, 222, 0.025)"
              stroke="none"
            />

            {/* East River */}
            <path
              data-geo
              d={EAST_RIVER}
              fill="none"
              stroke="#E8E4DE"
              strokeWidth={1.5}
              strokeDasharray="6 8"
              opacity={0.05}
            />

            {/* Hudson River */}
            <path
              data-geo
              d={HUDSON_RIVER}
              fill="none"
              stroke="#E8E4DE"
              strokeWidth={1.5}
              strokeDasharray="6 8"
              opacity={0.04}
            />

            {/* Borough labels (extremely subtle) */}
            <text
              data-geo
              x={295}
              y={300}
              textAnchor="middle"
              fill="#E8E4DE"
              fontSize={48}
              fontFamily="var(--font-ibm-plex), monospace"
              fontWeight={700}
              letterSpacing="0.3em"
              opacity={0.025}
              transform="rotate(-82, 295, 300)"
            >
              MANHATTAN
            </text>
            <text
              data-geo
              x={560}
              y={480}
              textAnchor="middle"
              fill="#E8E4DE"
              fontSize={32}
              fontFamily="var(--font-ibm-plex), monospace"
              fontWeight={700}
              letterSpacing="0.25em"
              opacity={0.025}
              transform="rotate(-15, 560, 480)"
            >
              BROOKLYN
            </text>
            <text
              data-geo
              x={650}
              y={110}
              textAnchor="middle"
              fill="#E8E4DE"
              fontSize={28}
              fontFamily="var(--font-ibm-plex), monospace"
              fontWeight={700}
              letterSpacing="0.25em"
              opacity={0.025}
            >
              QUEENS
            </text>

            {/* ============================================================ */}
            {/*  TRACK BED SHADOWS (depth layer under lines)                   */}
            {/* ============================================================ */}
            {LINES.map((line) => (
              <path
                key={`bed-${line.id}`}
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.04}
              />
            ))}

            {/* ============================================================ */}
            {/*  ANIMATED SUBWAY LINES                                         */}
            {/* ============================================================ */}
            {LINES.map((line) => (
              <path
                key={line.id}
                data-subway-line={line.id}
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-opacity duration-300"
                style={{
                  filter: `drop-shadow(0 0 4px ${line.color}30)`,
                }}
              />
            ))}

            {/* ============================================================ */}
            {/*  STATIONS                                                      */}
            {/* ============================================================ */}

            {/* Render non-hub stations first */}
            {STATIONS.filter((s) => !s.isHub).map(renderStation)}

            {/* Render hub station on top */}
            {STATIONS.filter((s) => s.isHub).map(renderStation)}

            {/* Transfer indicators at hub */}
            <g data-station-label className="pointer-events-none select-none">
              <text
                x={310}
                y={236}
                textAnchor="middle"
                fill="#7A756E"
                fontSize={7}
                fontFamily="var(--font-ibm-plex), monospace"
                letterSpacing="0.18em"
              >
                TRANSFER
              </text>
            </g>

            {/* ============================================================ */}
            {/*  COMPASS ROSE (top-right corner)                               */}
            {/* ============================================================ */}
            <g data-geo transform="translate(840, 50)" opacity={0.12}>
              {/* N arrow */}
              <line x1={0} y1={16} x2={0} y2={-16} stroke="#E8E4DE" strokeWidth={1.2} />
              <polygon points="0,-18 -4,-10 4,-10" fill="#E8E4DE" />
              <text
                x={0}
                y={-24}
                textAnchor="middle"
                fill="#E8E4DE"
                fontSize={9}
                fontFamily="var(--font-ibm-plex), monospace"
                fontWeight={700}
              >
                N
              </text>
              {/* Circle */}
              <circle cx={0} cy={0} r={20} fill="none" stroke="#E8E4DE" strokeWidth={0.5} />
            </g>

            {/* ============================================================ */}
            {/*  SYSTEM MAP TITLE (bottom-left)                                */}
            {/* ============================================================ */}
            <text
              data-geo
              x={20}
              y={582}
              fill="#7A756E"
              fontSize={7.5}
              fontFamily="var(--font-ibm-plex), monospace"
              fontWeight={400}
              letterSpacing="0.15em"
              opacity={0.6}
            >
              AFTER HOURS AGENDA &middot; SYSTEM MAP
            </text>

            {/* MTA-style line indicators along edges */}
            <g data-geo opacity={0.08}>
              {/* Small line color dots in bottom right as map reference */}
              {LINES.map((line, i) => (
                <circle
                  key={`ref-${line.id}`}
                  cx={830}
                  cy={520 + i * 14}
                  r={3.5}
                  fill={line.color}
                />
              ))}
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
                ALL
              </span>
              <span className="absolute inset-0 rounded-full animate-pulse-station border-2 border-line-gray opacity-30" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm text-cream group-hover:text-white transition-colors block">
                AHA Hub
              </span>
              <span className="font-mono text-[10px] text-muted tracking-wider">
                ALL LINES &middot; SHOP ALL
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
