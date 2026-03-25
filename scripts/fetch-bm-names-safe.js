// Safe BM name fetcher - uses the Facebook Business select page only (single page load per profile)
// No risky page-by-page navigation

const puppeteer = require("rebrowser-puppeteer");
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  const WS = process.env.WS_ENDPOINT;
  const SERIAL = process.env.SERIAL || "unknown";

  const browser = await puppeteer.connect({ browserWSEndpoint: WS });
  const page = await browser.newPage();

  console.log(`\n=== Profile #${SERIAL} ===`);

  // Single safe page load: business select page lists all BMs with their IDs
  await page.goto("https://business.facebook.com/select/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  // Scroll down to load all BMs
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1500));
  }

  // Extract BM list - parse carefully
  const bmList = await page.evaluate(() => {
    const links = document.querySelectorAll("a[href*='business_id=']");
    const bms = [];
    for (const link of links) {
      const m = link.href.match(/business_id=(\d+)/);
      if (!m || m[1] === "0") continue;

      // Get the name from the first text node or first child element
      // Structure is usually: <a><div><span>BM Name</span><span>N ad accounts...</span></div></a>
      const spans = link.querySelectorAll("span");
      let name = null;
      for (const span of spans) {
        const t = span.textContent.trim();
        if (t && !t.includes("ad account") && !t.includes("Page") && !t.includes("people")) {
          name = t;
          break;
        }
      }
      if (!name) {
        // Fallback: take text before first digit+space+"ad account"
        const full = link.textContent.trim();
        const cut = full.match(/^(.+?)(?:\d+\s*ad account)/);
        name = cut ? cut[1].trim() : full.split("\n")[0].trim();
      }
      bms.push({ id: m[1], name: name });
    }
    return bms;
  });

  console.log("Found", bmList.length, "BMs:");
  bmList.forEach(bm => console.log("  ", bm.id, bm.name));

  // Now for each BM, load the ad_accounts settings page ONCE and extract all account IDs
  let totalUpdated = 0;

  for (const bm of bmList) {
    console.log("\n--- BM:", bm.name, "(" + bm.id + ") ---");

    await page.goto(
      "https://business.facebook.com/latest/settings/ad_accounts?business_id=" + bm.id,
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await new Promise(r => setTimeout(r, 5000));

    // Scroll and wait to load all items in the list
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        // Scroll the main content and any scrollable containers
        window.scrollTo(0, document.body.scrollHeight);
        const containers = document.querySelectorAll("[style*='overflow']");
        containers.forEach(c => { c.scrollTop = c.scrollHeight; });
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    // Extract ALL ad account IDs from the page
    const pageContent = await page.evaluate(() => document.body.innerText);
    const matches = pageContent.match(/(?:ID:\s*)(\d{10,})/g) || [];
    const accountIds = [...new Set(matches.map(m => m.replace(/ID:\s*/, "").trim()))];

    // Also try to get IDs from any data attributes or links
    const linkIds = await page.evaluate(() => {
      const ids = new Set();
      // Check links with act_ or asset_id
      document.querySelectorAll("a[href*='act_'], a[href*='asset_id=']").forEach(a => {
        const m = a.href.match(/(?:act_|asset_id=)(\d{10,})/);
        if (m) ids.add(m[1]);
      });
      // Check any element with account ID pattern in text
      document.querySelectorAll("span, div").forEach(el => {
        const t = el.textContent.trim();
        if (/^\d{10,20}$/.test(t)) ids.add(t);
      });
      return [...ids];
    });

    const allIds = [...new Set([...accountIds, ...linkIds])];
    console.log("Found", allIds.length, "ad account IDs");

    // Update DB
    for (const actId of allIds) {
      const result = await prisma.adAccount.updateMany({
        where: { accountId: actId, platform: "FACEBOOK" },
        data: { sourceBmName: bm.name, sourceBmId: bm.id }
      });
      if (result.count > 0) {
        console.log("  Updated:", actId, "-> BM:", bm.name);
        totalUpdated += result.count;
      }
    }
  }

  console.log("\n=== Profile #" + SERIAL + " DONE. Total updated:", totalUpdated, "===");

  await page.close();
  browser.disconnect();
  await prisma.$disconnect();
})();
