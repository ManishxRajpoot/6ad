/**
 * Data Import Script - Part 2
 * Import Ad Accounts, Wallet Deposits, Ad Account Deposits, and BM Share Requests
 *
 * Run with: npx ts-node src/scripts/import-sql-data-part2.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { parseTableFromSQL, mapStatus, parseDate } from './utils/sql-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

// Path to SQL file - check multiple locations
const SQL_FILE_PATH = process.env.SQL_FILE_PATH ||
  (fs.existsSync('/home/6ad/supe_db-2.sql') ? '/home/6ad/supe_db-2.sql' : '/Users/manishrajpoot/Coinest_Share/supe_db-2.sql');
const MAPPING_FILE_PATH = path.join(__dirname, 'id-mapping.json');

interface IdMapping {
  users: { [oldId: string]: string };
  agents: { [oldId: string]: string };
}

interface AdAccountMapping {
  [key: string]: string; // `${platform}-${oldId}` -> MongoDB _id
}

// Track statistics
const stats = {
  fbAccounts: 0,
  googleAccounts: 0,
  tiktokAccounts: 0,
  bingAccounts: 0,
  snapchatAccounts: 0,
  walletDeposits: 0,
  accountDeposits: 0,
  bmShareRequests: 0,
  skipped: 0,
  errors: 0,
};

function generateApplyId(prefix: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString().slice(2, 9);
  return `${prefix}${dateStr}${random}`;
}

async function importFacebookAdAccounts(
  userMapping: IdMapping['users'],
  adAccountMapping: AdAccountMapping
): Promise<void> {
  console.log('\n📱 Importing Facebook Ad Accounts...');

  const fbAds = parseTableFromSQL(SQL_FILE_PATH, 'fb_ads');
  console.log(`   Found ${fbAds.length} Facebook ad account records`);

  for (const ad of fbAds) {
    try {
      const userId = userMapping[String(ad.uid)];
      if (!userId) {
        stats.skipped++;
        continue;
      }

      // Check if account already exists
      const existingApplyId = String(ad.apply_id || '');
      if (existingApplyId) {
        const existing = await prisma.adAccount.findFirst({
          where: { accountName: { contains: existingApplyId } },
        });
        if (existing) {
          adAccountMapping[`FB-${ad.id}`] = existing.id;
          stats.skipped++;
          continue;
        }
      }

      const newAccount = await prisma.adAccount.create({
        data: {
          platform: 'FACEBOOK',
          accountId: String(ad.ad || ''),
          accountName: String(ad.license_name || `FB-${ad.apply_id}`),
          licenseName: String(ad.license_name || ''),
          timezone: '',
          currency: 'USD',
          status: mapStatus(String(ad.status)) as any,
          totalDeposit: parseFloat(String(ad.ads_total_deposit || 0)),
          totalSpend: 0,
          balance: parseFloat(String(ad.ads_total_deposit || 0)),
          userId,
          remarks: String(ad.remark || ''),
          createdAt: parseDate(String(ad.create_time)) || new Date(),
        },
      });

      adAccountMapping[`FB-${ad.id}`] = newAccount.id;
      stats.fbAccounts++;
    } catch (error: any) {
      console.error(`  ❌ Error importing FB account ${ad.apply_id}:`, error.message);
      stats.errors++;
    }
  }

  console.log(`   ✅ Imported ${stats.fbAccounts} Facebook accounts`);
}

async function importGoogleAdAccounts(
  userMapping: IdMapping['users'],
  adAccountMapping: AdAccountMapping
): Promise<void> {
  console.log('\n🔍 Importing Google Ad Accounts...');

  const googleAds = parseTableFromSQL(SQL_FILE_PATH, 'google_ad');
  console.log(`   Found ${googleAds.length} Google ad account records`);

  for (const ad of googleAds) {
    try {
      const userId = userMapping[String(ad.uid)];
      if (!userId) {
        stats.skipped++;
        continue;
      }

      const newAccount = await prisma.adAccount.create({
        data: {
          platform: 'GOOGLE',
          accountId: String(ad.ads_account_id || ''),
          accountName: `Google-${ad.apply_id || ad.id}`,
          timezone: String(ad.time_zone || ''),
          currency: 'USD',
          status: mapStatus(String(ad.status)) as any,
          totalDeposit: parseFloat(String(ad.total_deposit || 0)),
          totalSpend: 0,
          balance: parseFloat(String(ad.total_deposit || 0)),
          userId,
          createdAt: parseDate(String(ad.create_time)) || new Date(),
        },
      });

      adAccountMapping[`GOOGLE-${ad.id}`] = newAccount.id;
      stats.googleAccounts++;
    } catch (error: any) {
      console.error(`  ❌ Error importing Google account ${ad.apply_id}:`, error.message);
      stats.errors++;
    }
  }

  console.log(`   ✅ Imported ${stats.googleAccounts} Google accounts`);
}

async function importTikTokAdAccounts(
  userMapping: IdMapping['users'],
  adAccountMapping: AdAccountMapping
): Promise<void> {
  console.log('\n🎵 Importing TikTok Ad Accounts...');

  const tiktokAds = parseTableFromSQL(SQL_FILE_PATH, 'tiktok_ad');
  console.log(`   Found ${tiktokAds.length} TikTok ad account records`);

  for (const ad of tiktokAds) {
    try {
      const userId = userMapping[String(ad.uid)];
      if (!userId) {
        stats.skipped++;
        continue;
      }

      const newAccount = await prisma.adAccount.create({
        data: {
          platform: 'TIKTOK',
          accountId: String(ad.ads_account_id || ''),
          accountName: `TikTok-${ad.apply_id || ad.id}`,
          timezone: String(ad.time_zone || ''),
          currency: 'USD',
          status: mapStatus(String(ad.status)) as any,
          totalDeposit: parseFloat(String(ad.total_deposit || 0)),
          totalSpend: 0,
          balance: parseFloat(String(ad.total_deposit || 0)),
          userId,
          createdAt: parseDate(String(ad.create_time)) || new Date(),
        },
      });

      adAccountMapping[`TIKTOK-${ad.id}`] = newAccount.id;
      stats.tiktokAccounts++;
    } catch (error: any) {
      console.error(`  ❌ Error importing TikTok account ${ad.apply_id}:`, error.message);
      stats.errors++;
    }
  }

  console.log(`   ✅ Imported ${stats.tiktokAccounts} TikTok accounts`);
}

async function importBingAdAccounts(
  userMapping: IdMapping['users'],
  adAccountMapping: AdAccountMapping
): Promise<void> {
  console.log('\n🔷 Importing Bing Ad Accounts...');

  const bingAds = parseTableFromSQL(SQL_FILE_PATH, 'bing_ad');
  console.log(`   Found ${bingAds.length} Bing ad account records`);

  for (const ad of bingAds) {
    try {
      const userId = userMapping[String(ad.uid)];
      if (!userId) {
        stats.skipped++;
        continue;
      }

      const newAccount = await prisma.adAccount.create({
        data: {
          platform: 'BING',
          accountId: String(ad.ads_account_id || ''),
          accountName: `Bing-${ad.apply_id || ad.id}`,
          timezone: String(ad.time_zone || ''),
          currency: 'USD',
          status: mapStatus(String(ad.status)) as any,
          totalDeposit: parseFloat(String(ad.total_deposit || 0)),
          totalSpend: 0,
          balance: parseFloat(String(ad.total_deposit || 0)),
          userId,
          createdAt: parseDate(String(ad.create_time)) || new Date(),
        },
      });

      adAccountMapping[`BING-${ad.id}`] = newAccount.id;
      stats.bingAccounts++;
    } catch (error: any) {
      console.error(`  ❌ Error importing Bing account ${ad.apply_id}:`, error.message);
      stats.errors++;
    }
  }

  console.log(`   ✅ Imported ${stats.bingAccounts} Bing accounts`);
}

async function importSnapchatAdAccounts(
  userMapping: IdMapping['users'],
  adAccountMapping: AdAccountMapping
): Promise<void> {
  console.log('\n👻 Importing Snapchat Ad Accounts...');

  const snapAds = parseTableFromSQL(SQL_FILE_PATH, 'snap_ad');
  console.log(`   Found ${snapAds.length} Snapchat ad account records`);

  for (const ad of snapAds) {
    try {
      const userId = userMapping[String(ad.uid)];
      if (!userId) {
        stats.skipped++;
        continue;
      }

      const newAccount = await prisma.adAccount.create({
        data: {
          platform: 'SNAPCHAT',
          accountId: String(ad.ads_account_id || ''),
          accountName: `Snapchat-${ad.apply_id || ad.id}`,
          timezone: String(ad.time_zone || ''),
          currency: 'USD',
          status: mapStatus(String(ad.status)) as any,
          totalDeposit: parseFloat(String(ad.total_deposit || 0)),
          totalSpend: 0,
          balance: parseFloat(String(ad.total_deposit || 0)),
          userId,
          createdAt: parseDate(String(ad.create_time)) || new Date(),
        },
      });

      adAccountMapping[`SNAPCHAT-${ad.id}`] = newAccount.id;
      stats.snapchatAccounts++;
    } catch (error: any) {
      console.error(`  ❌ Error importing Snapchat account ${ad.apply_id}:`, error.message);
      stats.errors++;
    }
  }

  console.log(`   ✅ Imported ${stats.snapchatAccounts} Snapchat accounts`);
}

async function importWalletDeposits(userMapping: IdMapping['users']): Promise<void> {
  console.log('\n💰 Importing Wallet Deposits...');

  const deposits = parseTableFromSQL(SQL_FILE_PATH, 'wallet_add_money');
  console.log(`   Found ${deposits.length} wallet deposit records`);

  for (const deposit of deposits) {
    try {
      const userId = userMapping[String(deposit.uid)];
      if (!userId) {
        stats.skipped++;
        continue;
      }

      const amount = parseFloat(String(deposit.charge || 0));

      // Skip negative amounts (removals) - they're adjustments, not deposits
      if (amount <= 0) {
        stats.skipped++;
        continue;
      }

      const applyId = String(deposit.apply_id || generateApplyId('WD'));

      // Check for duplicates
      const existing = await prisma.deposit.findFirst({
        where: { applyId },
      });

      if (existing) {
        stats.skipped++;
        continue;
      }

      const statusStr = String(deposit.status || 'Pending');
      let status = mapStatus(statusStr) as any;

      await prisma.deposit.create({
        data: {
          applyId,
          amount,
          status,
          paymentMethod: String(deposit.payway || 'USDT'),
          paymentProof: deposit.image ? String(deposit.image) : null,
          transactionId: String(deposit.trans_id || ''),
          userId,
          remarks: deposit.remove_reason ? String(deposit.remove_reason) : null,
          approvedAt: statusStr === 'Approved' ? parseDate(String(deposit.create_time)) : null,
          createdAt: parseDate(String(deposit.create_time)) || new Date(),
        },
      });

      stats.walletDeposits++;
    } catch (error: any) {
      console.error(`  ❌ Error importing wallet deposit ${deposit.apply_id}:`, error.message);
      stats.errors++;
    }
  }

  console.log(`   ✅ Imported ${stats.walletDeposits} wallet deposits`);
}

async function importAccountDeposits(
  userMapping: IdMapping['users'],
  adAccountMapping: AdAccountMapping
): Promise<void> {
  console.log('\n📊 Importing Ad Account Deposits (Recharges)...');

  const socialDeposits = parseTableFromSQL(SQL_FILE_PATH, 'social_deposit');
  console.log(`   Found ${socialDeposits.length} ad account deposit records`);

  // Build ad account lookup by ad_id field
  const adAccountLookup: { [adId: string]: string } = {};
  const allAccounts = await prisma.adAccount.findMany({
    select: { id: true, accountId: true },
  });
  for (const acc of allAccounts) {
    if (acc.accountId) {
      adAccountLookup[acc.accountId] = acc.id;
    }
  }

  for (const deposit of socialDeposits) {
    try {
      const amount = parseFloat(String(deposit.charge || 0));
      if (amount <= 0) {
        stats.skipped++;
        continue;
      }

      // Try to find the ad account
      const adId = String(deposit.ad_id || '');
      let adAccountId = adAccountLookup[adId];

      // If not found by account ID, try mapping
      if (!adAccountId) {
        const platform = String(deposit.social_name || '').toUpperCase();
        const mappingKey = `${platform}-${deposit.ad_id}`;
        adAccountId = adAccountMapping[mappingKey];
      }

      // Skip if no account found
      if (!adAccountId) {
        stats.skipped++;
        continue;
      }

      const applyId = String(deposit.apply_id || generateApplyId('RC'));

      const commissionRate = parseFloat(String(deposit.commission || 0));

      await prisma.accountDeposit.create({
        data: {
          applyId,
          amount,
          status: mapStatus(String(deposit.status)) as any,
          commissionRate,
          commissionAmount: (amount * commissionRate) / 100,
          adAccountId,
          approvedAt: String(deposit.status) === 'Approved' ? parseDate(String(deposit.create_time)) : null,
          createdAt: parseDate(String(deposit.create_time)) || new Date(),
        },
      });

      stats.accountDeposits++;
    } catch (error: any) {
      console.error(`  ❌ Error importing account deposit ${deposit.apply_id}:`, error.message);
      stats.errors++;
    }
  }

  console.log(`   ✅ Imported ${stats.accountDeposits} ad account deposits`);
}

async function importBMShareRequests(userMapping: IdMapping['users']): Promise<void> {
  console.log('\n🔗 Importing BM Share Requests...');

  // Import from all BM share tables
  const tables = [
    { name: 'fb_bm_share', platform: 'FACEBOOK', adIdField: 'fb_ads_account_id' },
    { name: 'google_ad_share', platform: 'GOOGLE', adIdField: 'google_ad_account_id' },
    { name: 'tt_bm_share', platform: 'TIKTOK', adIdField: 'tt_ads_account_id' },
    { name: 'snap_bm_share', platform: 'SNAPCHAT', adIdField: 'snap_ads_account_id' },
    { name: 'bing_bm_share', platform: 'BING', adIdField: 'bing_ads_account_id' },
  ];

  for (const table of tables) {
    const bmShares = parseTableFromSQL(SQL_FILE_PATH, table.name);
    console.log(`   Found ${bmShares.length} ${table.platform} BM share records`);

    for (const share of bmShares) {
      try {
        const userId = userMapping[String(share.uid)];
        if (!userId) {
          stats.skipped++;
          continue;
        }

        const adAccountId = String(share[table.adIdField] || share.bm_id || '');
        const bmId = String(share.bm_id || '');

        await prisma.bmShareRequest.create({
          data: {
            applyId: generateApplyId('BM'),
            platform: table.platform as any,
            adAccountId,
            adAccountName: `${table.platform}-Account`,
            bmId,
            status: mapStatus(String(share.status)) as any,
            userId,
            approvedAt: String(share.status) === 'Approved' ? parseDate(String(share.create_time)) : null,
            createdAt: parseDate(String(share.create_time)) || new Date(),
          },
        });

        stats.bmShareRequests++;
      } catch (error: any) {
        console.error(`  ❌ Error importing ${table.platform} BM share:`, error.message);
        stats.errors++;
      }
    }
  }

  console.log(`   ✅ Imported ${stats.bmShareRequests} BM share requests`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   DATA IMPORT - PART 2: AD ACCOUNTS & TRANSACTIONS');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Load ID mapping from Part 1
    if (!fs.existsSync(MAPPING_FILE_PATH)) {
      throw new Error(`ID mapping file not found. Please run Part 1 first: ${MAPPING_FILE_PATH}`);
    }

    const idMapping: IdMapping = JSON.parse(fs.readFileSync(MAPPING_FILE_PATH, 'utf-8'));
    console.log(`\n📂 Loaded ID mapping: ${Object.keys(idMapping.users).length} users`);

    // Track ad account mappings
    const adAccountMapping: AdAccountMapping = {};

    // Import ad accounts
    await importFacebookAdAccounts(idMapping.users, adAccountMapping);
    await importGoogleAdAccounts(idMapping.users, adAccountMapping);
    await importTikTokAdAccounts(idMapping.users, adAccountMapping);
    await importBingAdAccounts(idMapping.users, adAccountMapping);
    await importSnapchatAdAccounts(idMapping.users, adAccountMapping);

    // Import wallet deposits
    await importWalletDeposits(idMapping.users);

    // Import ad account deposits (recharges)
    await importAccountDeposits(idMapping.users, adAccountMapping);

    // Import BM share requests
    await importBMShareRequests(idMapping.users);

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                        SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  📱 Facebook Accounts:   ${stats.fbAccounts}`);
    console.log(`  🔍 Google Accounts:     ${stats.googleAccounts}`);
    console.log(`  🎵 TikTok Accounts:     ${stats.tiktokAccounts}`);
    console.log(`  🔷 Bing Accounts:       ${stats.bingAccounts}`);
    console.log(`  👻 Snapchat Accounts:   ${stats.snapchatAccounts}`);
    console.log(`  💰 Wallet Deposits:     ${stats.walletDeposits}`);
    console.log(`  📊 Account Deposits:    ${stats.accountDeposits}`);
    console.log(`  🔗 BM Share Requests:   ${stats.bmShareRequests}`);
    console.log(`  ⚠️  Skipped:            ${stats.skipped}`);
    console.log(`  ❌ Errors:              ${stats.errors}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n✨ Part 2 complete! Data import finished successfully.\n');
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
