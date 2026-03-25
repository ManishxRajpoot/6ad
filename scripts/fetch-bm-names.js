const puppeteer = require("rebrowser-puppeteer");
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  const WS = process.env.WS_ENDPOINT;

  const browser = await puppeteer.connect({ browserWSEndpoint: WS });

  // Navigate to BM selector page
  const page = await browser.newPage();
  await page.goto("https://business.facebook.com/select/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  // Extract BM list with clean names
  const bmList = await page.evaluate(() => {
    const links = document.querySelectorAll("a[href*='business_id=']");
    const bms = [];
    for (const link of links) {
      const m = link.href.match(/business_id=(\d+)/);
      if (m && m[1] !== "0") {
        // The link usually has a structure: BM Name \n X ad accounts · Y Pages · Z people
        // Get just the first line (the name)
        const fullText = link.textContent.trim();
        const lines = fullText.split(/\d+\s*ad account/);
        const name = lines[0].trim();
        bms.push({ id: m[1], name: name });
      }
    }
    return bms;
  });

  console.log("Found", bmList.length, "BMs:");
  bmList.forEach(bm => console.log("  -", bm.name, "(" + bm.id + ")"));

  let totalUpdated = 0;

  for (const bm of bmList) {
    console.log("\n--- Processing BM:", bm.name, "(" + bm.id + ") ---");

    await page.goto(
      "https://business.facebook.com/latest/settings/ad_accounts?business_id=" + bm.id,
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await new Promise(r => setTimeout(r, 5000));

    // Scroll and collect all ad account IDs
    let allIds = new Set();
    let attempts = 0;

    while (attempts < 20) {
      const pageText = await page.evaluate(() => document.body.innerText);
      const idMatches = pageText.match(/ID:\s*(\d{10,})/g) || [];
      const ids = idMatches.map(m => m.replace(/ID:\s*/, "").trim());

      const prevSize = allIds.size;
      ids.forEach(id => allIds.add(id));

      if (allIds.size === prevSize && attempts > 0) break;

      // Click on each ad account name in the list to reveal its ID
      // Also try scrolling the account list to load more
      await page.evaluate(() => {
        const sidebar = document.querySelector("[role='list']") || document.querySelector("[data-pagelet]");
        if (sidebar) sidebar.scrollTop = sidebar.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(r => setTimeout(r, 2000));

      // Also try clicking "Show more" or next items
      const clicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll("div[role='button'], span[role='button']");
        for (const btn of buttons) {
          if (btn.textContent.includes("Show more") || btn.textContent.includes("Load more")) {
            btn.click();
            return true;
          }
        }
        // Try clicking on unselected list items to reveal their IDs
        const listItems = document.querySelectorAll("[role='listitem'], [role='row']");
        let found = false;
        for (const item of listItems) {
          if (item.textContent.includes("ad account") || item.textContent.includes("Details")) {
            continue; // skip items that look like they're already expanded
          }
        }
        return false;
      });

      attempts++;
    }

    // Also try to get IDs from the sidebar list items by clicking each one
    const listItemCount = await page.evaluate(() => {
      const items = document.querySelectorAll("table tbody tr, [role='row']");
      return items.length;
    });

    for (let idx = 0; idx < Math.min(listItemCount, 10); idx++) {
      await page.evaluate((i) => {
        const items = document.querySelectorAll("table tbody tr, [role='row']");
        if (items[i]) items[i].click();
      }, idx);
      await new Promise(r => setTimeout(r, 1500));

      const pageText = await page.evaluate(() => document.body.innerText);
      const idMatches = pageText.match(/ID:\s*(\d{10,})/g) || [];
      idMatches.forEach(m => allIds.add(m.replace(/ID:\s*/, "").trim()));
    }

    console.log("Found", allIds.size, "ad account IDs in", bm.name);

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

  // Also do profile #95 if available
  console.log("\n=== DONE with profile #97. Total updated:", totalUpdated, "===");

  await page.close();
  browser.disconnect();
  await prisma.$disconnect();
})();
