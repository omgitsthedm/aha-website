import Image from "next/image";

export function LittleFightCareBar() {
  return (
    <aside
      className="lf-care-bar no-print"
      aria-label="Little Fight NYC design and care credit"
    >
      <div className="lf-care-bar__inner">
        <a
          className="lf-care-bar__link"
          href="https://littlefightnyc.com/"
          rel="author"
        >
          <span className="lf-tug-stage" aria-hidden="true">
            <Image
              src="/brand/little-fight-tugboat.svg"
              width={72}
              height={48}
              alt=""
              unoptimized
            />
          </span>
          <span className="lf-care-bar__credit">
            <span className="lf-care-bar__service">
              Designed, Built and Cared For By
            </span>
            <span className="lf-care-bar__brand" translate="no">
              LittleFightNYC.com
            </span>
          </span>
        </a>
      </div>
    </aside>
  );
}
