const { PrismaClient } = require("@prisma/client");
(async () => {
  const p = new PrismaClient();
  const all = await p.adAccount.findMany({
    where: { platform: "FACEBOOK", accountId: { not: "" } },
    select: { accountId: true, sourceBmName: true, sourceBmId: true }
  });
  const real = all.filter(a => /^\d{5,}$/.test(a.accountId));
  const withName = real.filter(a => a.sourceBmName);
  const cheetahNoName = real.filter(a => a.sourceBmId === "cheetah" && !a.sourceBmName);
  const noNameNoBm = real.filter(a => !a.sourceBmName && a.sourceBmId !== "cheetah");
  console.log("Real FB accounts:", real.length);
  console.log("With BM name:", withName.length);
  console.log("Cheetah without BM name:", cheetahNoName.length);
  console.log("No BM at all:", noNameNoBm.length);
  await p.$disconnect();
})();
