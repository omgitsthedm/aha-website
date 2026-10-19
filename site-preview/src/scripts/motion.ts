// Collection films (src/components/MotionImage.astro). The photo is the page's main
// image; film data loads only after load, only while on screen, and never for reduced
// motion, Data Saver or 2G. Every film has a pause button.
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
// Data saver and 2G connections keep the photos; the phone loop is about 200 KB, so 3G still gets it.
const frugal = () => Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? "");

// The film's layer starts as the photo itself: its poster is the photo's own file,
// already loading, so the frame looks unchanged. Browsers time a video's Largest
// Contentful Paint by its poster or its first frame, whichever comes first, so the
// film arriving after load can't make the page's LCP late. No film data loads yet.
function prepare(frame: HTMLElement) {
  const existing = frame.querySelector("video");
  if (existing) return existing;
  const video = document.createElement("video");
  video.className = "motion-video";
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.setAttribute("disableremoteplayback", "");
  video.setAttribute("aria-hidden", "true");
  video.preload = "none";
  const photo = frame.querySelector("img");
  if (photo) video.poster = photo.currentSrc || photo.src;
  frame.append(video);
  return video;
}

function attach(frame: HTMLElement) {
  const video = prepare(frame);
  video.preload = "auto";
  video.src = (innerWidth <= 760 && frame.dataset.motionSmall) || frame.dataset.motion!;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "motion-toggle";
  toggle.textContent = "Pause";
  toggle.setAttribute("aria-label", "Pause the motion");
  toggle.addEventListener("click", () => {
    const pausing = !video.paused;
    frame.toggleAttribute("data-motion-paused", pausing);
    toggle.textContent = pausing ? "Play" : "Pause";
    toggle.setAttribute("aria-label", pausing ? "Play the motion" : "Pause the motion");
    if (pausing) video.pause();
    else void video.play();
  });
  video.addEventListener("playing", () => {
    frame.classList.add("is-moving");
    // Analytics (src/scripts/tracking.ts) records which film started, never who watched.
    document.dispatchEvent(new CustomEvent("aha:film-played", { detail: { film: /\/motion\/([a-z0-9-]+?)-\d+t?\.mp4$/.exec(video.src)?.[1] ?? "film" } }));
  }, { once: true });
  frame.append(toggle);
  video.play().catch(() => { video.remove(); toggle.remove(); });
  return video;
}

function start() {
  if (reduce.matches || frugal()) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const frame = entry.target as HTMLElement;
      const video = frame.querySelector("video");
      if (!video?.src) { if (entry.isIntersecting) attach(frame); continue; }
      if (entry.isIntersecting && !frame.hasAttribute("data-motion-paused")) void video.play().catch(() => {});
      else video.pause();
    }
  }, { rootMargin: "120px 0px" });
  document.querySelectorAll<HTMLElement>("[data-motion]").forEach((frame) => observer.observe(frame));
  // Turning on reduced motion mid-visit stops everything and goes back to the photos.
  reduce.addEventListener("change", () => {
    if (!reduce.matches) return;
    observer.disconnect();
    document.querySelectorAll<HTMLElement>("[data-motion]").forEach((frame) => {
      frame.classList.remove("is-moving");
      frame.querySelector("video")?.remove();
      frame.querySelector(".motion-toggle")?.remove();
    });
  });
}

// Wait for load and a quiet moment, so the photos (and the page's main image) come first.
const later = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 600));
const whenLoaded = () => (document.readyState === "complete" ? later() : addEventListener("load", later, { once: true }));
if (document.querySelector("[data-motion]")) {
  // A prerendered page waits until the visitor actually opens it.
  if ((document as Document & { prerendering?: boolean }).prerendering) document.addEventListener("prerenderingchange", whenLoaded, { once: true });
  else {
    // Frames on screen now get their (poster-only) layer before the photo paints.
    if (!reduce.matches && !frugal()) document.querySelectorAll<HTMLElement>("[data-motion]").forEach((frame) => { const box = frame.getBoundingClientRect(); if (box.top < innerHeight && box.bottom > 0) prepare(frame); });
    whenLoaded();
  }
}
