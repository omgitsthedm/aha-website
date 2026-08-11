import { describe, expect, it } from "vitest";
import { robotsForHost } from "@/app/robots";

type Rule = { userAgent: string | string[]; allow?: string | string[]; disallow?: string | string[] };

const deniedAgents = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
  "Bytespider",
  "Meta-ExternalAgent",
  "Applebot-Extended",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "PetalBot",
  "DataForSeoBot",
];

function rulesFor(host: string): Rule[] {
  const rules = robotsForHost(host).rules;
  return (Array.isArray(rules) ? rules : [rules]) as Rule[];
}

describe("robotsForHost", () => {
  it("keeps the canonical public-search rule while denying named training and bulk crawlers", () => {
    const policy = robotsForHost("afterhoursagenda.com");
    const rules = rulesFor("afterhoursagenda.com");
    const publicRule = rules.find((rule) => rule.userAgent === "*");

    expect(policy.sitemap).toBe("https://afterhoursagenda.com/sitemap.xml");
    expect(publicRule?.allow).toEqual(expect.arrayContaining(["/", "/shop", "/product/"]));
    expect(publicRule?.disallow).toEqual(expect.arrayContaining(["/api/", "/ops/", "/order-confirmed"]));
    for (const userAgent of deniedAgents) {
      expect(rules).toContainEqual({ userAgent, disallow: "/" });
    }
  });

  it("denies every path on a noncanonical Netlify host", () => {
    const policy = robotsForHost("afterhoursagenda.netlify.app");

    expect(policy.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(policy.sitemap).toBeUndefined();
    expect(policy.host).toBe("https://afterhoursagenda.com");
  });
});
