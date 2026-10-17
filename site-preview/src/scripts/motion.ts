// Campaign motion loops (src/components/MotionImage.astro). The photo is the page's
// main image; a loop is added only after load, only while on screen, and never for
// reduced motion or data saver. Every loop has a pause button.
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
// Data saver and 2G connections keep the photos; the phone loop is about 200 KB, so 3G still gets it.
const frugal = () => Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? "");

function attach(frame: HTMLElement) {
  const video = document.createElement("video");
  video.className = "motion-video";
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.setAttribute("disableremoteplayback", "");
  video.setAttribute("aria-hidden", "true");
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
  video.addEventListener("playing", () => frame.classList.add("is-moving"), { once: true });
  frame.append(video, toggle);
  video.play().catch(() => { video.remove(); toggle.remove(); });
  return video;
}

function start() {
  if (reduce.matches || frugal()) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const frame = entry.target as HTMLElement;
      const video = frame.querySelector("video");
      if (!video) { if (entry.isIntersecting) attach(frame); continue; }
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
  else whenLoaded();
}
