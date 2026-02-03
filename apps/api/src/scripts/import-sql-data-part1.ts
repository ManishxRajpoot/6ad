/**
 * Data Import Script - Part 1
 * Import Users and Agents from MySQL dump to MongoDB
 *
 * Run with: npx ts-node src/scripts/import-sql-data-part1.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as bcrypt from 'bcryptjs';
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

interface SQLUser {
  id: number;
  name: string;
  email: string;
  username: string;
  facebook_opening_fee: number | null;
  facebook_deposit_commission: number | null;
  google_opening_fee: number | null;
  google_deposit_commission: number | null;
  tiktok_opening_fee: number | null;
  tiktok_deposit_commission: number | null;
  bing_opening_fee: number | null;
  bing_deposit_commission: number | null;
  snapchat_opening_fee: number | null;
  snapchat_deposit_commission: number | null;
  balance: number | null;
  mobile: string | null;
  contact1: string | null;
  contact2: string | null;
  remark: string | null;
  email_verified_at: string | null;
  pass: string | null;
  password: string | null;
  type: number;
  remember_token: string | null;
  otp: string | null;
  created_at: string | null;
  updated_at: string | null;
  ref_id: number | null;
  sts: number | null;
}

interface IdMapping {
  users: { [oldId: string]: string };
  agents: { [oldId: string]: string };
}

// Track statistics
const stats = {
  agentsCreated: 0,
  usersCreated: 0,
  skipped: 0,
  errors: 0,
};

async function importAgents(users: SQLUser[]): Promise<IdMapping['agents']> {
  const agentMapping: { [oldId: string]: string } = {};

  // Filter agents (type=2)
  const agents = users.filter((u) => u.type === 2);

  console.log(`\n📦 Importing ${agents.length} agents...`);

  for (const agent of agents) {
    try {
      // Check if email already exists
      const existing = await prisma.user.findUnique({
        where: { email: agent.email.toLowerCase().trim() },
      });

      if (existing) {
        console.log(`  ⚠️  Agent "${agent.username}" (${agent.email}) already exists, skipping...`);
        agentMapping[agent.id.toString()] = existing.id;
        stats.skipped++;
        continue;
      }

      // Hash password if not already bcrypt
      let hashedPassword = agent.password || '';
      if (!hashedPassword.startsWith('$2')) {
        hashedPassword = await bcrypt.hash(agent.pass || '12345678', 10);
      }

      const newAgent = await prisma.user.create({
        data: {
          email: agent.email.toLowerCase().trim(),
          password: hashedPassword,
          plaintextPassword: String(agent.pass || '12345678'),
          username: agent.username || agent.name,
          realName: agent.name,
          phone: agent.mobile ? String(agent.mobile) : null,
          phone2: agent.contact1 ? String(agent.contact1) : null,

          role: 'AGENT',
          status: agent.sts === 1 ? 'ACTIVE' : 'INACTIVE',

          walletBalance: parseFloat(String(agent.balance)) || 0,

          // Platform fees
          fbFee: parseFloat(String(agent.facebook_opening_fee)) || 0,
          fbCommission: parseFloat(String(agent.facebook_deposit_commission)) || 0,
          googleFee: parseFloat(String(agent.google_opening_fee)) || 0,
          googleCommission: parseFloat(String(agent.google_deposit_commission)) || 0,
          tiktokFee: parseFloat(String(agent.tiktok_opening_fee)) || 0,
          tiktokCommission: parseFloat(String(agent.tiktok_deposit_commission)) || 0,
          bingFee: parseFloat(String(agent.bing_opening_fee)) || 0,
          bingCommission: parseFloat(String(agent.bing_deposit_commission)) || 0,
          snapchatFee: parseFloat(String(agent.snapchat_opening_fee)) || 0,
          snapchatCommission: parseFloat(String(agent.snapchat_deposit_commission)) || 0,

          personalRemarks: agent.remark ? String(agent.remark) : null,
          contactRemarks: agent.contact2 ? String(agent.contact2) : null,

          emailVerified: !!agent.email_verified_at,

          createdAt: parseDate(agent.created_at) || new Date(),
          updatedAt: parseDate(agent.updated_at) || new Date(),
        },
      });

      agentMapping[agent.id.toString()] = newAgent.id;
      stats.agentsCreated++;
      console.log(`  ✅ Created agent: ${agent.username} (${agent.email})`);
    } catch (error: any) {
      console.error(`  ❌ Error creating agent ${agent.username}:`, error.message);
      stats.errors++;
    }
  }

  return agentMapping;
}

async function importUsers(
  users: SQLUser[],
  agentMapping: { [oldId: string]: string }
): Promise<IdMapping['users']> {
  const userMapping: { [oldId: string]: string } = {};

  // Filter regular users (type=3)
  const regularUsers = users.filter((u) => u.type === 3);

  console.log(`\n👥 Importing ${regularUsers.length} users...`);

  // Find a default agent (SuperAds) for users with missing ref_id
  let defaultAgentId: string | null = null;
  const superAdsKey = Object.keys(agentMapping).find((key) => {
    return key === '177'; // SuperAds id in SQL
  });
  if (superAdsKey) {
    defaultAgentId = agentMapping[superAdsKey];
  }

  for (const user of regularUsers) {
    try {
      // Check if email already exists
      const existing = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase().trim() },
      });

      if (existing) {
        console.log(`  ⚠️  User "${user.username}" (${user.email}) already exists, skipping...`);
        userMapping[user.id.toString()] = existing.id;
        stats.skipped++;
        continue;
      }

      // Hash password if not already bcrypt
      let hashedPassword = user.password || '';
      if (!hashedPassword.startsWith('$2')) {
        hashedPassword = await bcrypt.hash(user.pass || '12345678', 10);
      }

      // Determine agent
      let agentId = user.ref_id ? agentMapping[user.ref_id.toString()] : null;

      // If no agent found, assign to SuperAds or null
      if (!agentId && user.ref_id && user.ref_id !== 1) {
        // ref_id=1 is admin, skip assigning
        agentId = defaultAgentId;
      }

      const newUser = await prisma.user.create({
        data: {
          email: user.email.toLowerCase().trim(),
          password: hashedPassword,
          plaintextPassword: String(user.pass || '12345678'),
          username: user.username || user.name,
          realName: user.name,
          phone: user.mobile ? String(user.mobile) : null,
          phone2: user.contact1 ? String(user.contact1) : null,

          role: 'USER',
          status: user.sts === 1 ? 'ACTIVE' : 'INACTIVE',

          walletBalance: parseFloat(String(user.balance)) || 0,

          // Platform fees
          fbFee: parseFloat(String(user.facebook_opening_fee)) || 30,
          fbCommission: parseFloat(String(user.facebook_deposit_commission)) || 5,
          googleFee: parseFloat(String(user.google_opening_fee)) || 30,
          googleCommission: parseFloat(String(user.google_deposit_commission)) || 5,
          tiktokFee: parseFloat(String(user.tiktok_opening_fee)) || 30,
          tiktokCommission: parseFloat(String(user.tiktok_deposit_commission)) || 5,
          bingFee: parseFloat(String(user.bing_opening_fee)) || 30,
          bingCommission: parseFloat(String(user.bing_deposit_commission)) || 5,
          snapchatFee: parseFloat(String(user.snapchat_opening_fee)) || 30,
          snapchatCommission: parseFloat(String(user.snapchat_deposit_commission)) || 5,

          // Agent relationship
          agentId: agentId || undefined,

          personalRemarks: user.remark ? String(user.remark) : null,
          contactRemarks: user.contact2 ? String(user.contact2) : null,

          emailVerified: !!user.email_verified_at,

          createdAt: parseDate(user.created_at) || new Date(),
          updatedAt: parseDate(user.updated_at) || new Date(),
        },
      });

      userMapping[user.id.toString()] = newUser.id;
      stats.usersCreated++;
      console.log(`  ✅ Created user: ${user.username} (${user.email})${agentId ? ' [Agent assigned]' : ''}`);
    } catch (error: any) {
      console.error(`  ❌ Error creating user ${user.username}:`, error.message);
      stats.errors++;
    }
  }

  return userMapping;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('          DATA IMPORT - PART 1: USERS & AGENTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📂 SQL File: ${SQL_FILE_PATH}`);

  try {
    // Check if SQL file exists
    if (!fs.existsSync(SQL_FILE_PATH)) {
      throw new Error(`SQL file not found: ${SQL_FILE_PATH}`);
    }

    // Parse users from SQL
    console.log('\n🔍 Parsing SQL file...');
    const users = parseTableFromSQL(SQL_FILE_PATH, 'users') as unknown as SQLUser[];
    console.log(`   Found ${users.length} total users in SQL file`);

    // Categorize users
    const admins = users.filter((u) => u.type === 1);
    const agents = users.filter((u) => u.type === 2);
    const regularUsers = users.filter((u) => u.type === 3);

    console.log(`   - Admins: ${admins.length} (will skip)`);
    console.log(`   - Agents: ${agents.length}`);
    console.log(`   - Users: ${regularUsers.length}`);

    // Import agents first
    const agentMapping = await importAgents(users);

    // Import users with agent relationships
    const userMapping = await importUsers(users, agentMapping);

    // Combine mappings
    const idMapping: IdMapping = {
      agents: agentMapping,
      users: { ...agentMapping, ...userMapping },
    };

    // Save mapping to file for Part 2
    fs.writeFileSync(MAPPING_FILE_PATH, JSON.stringify(idMapping, null, 2));
    console.log(`\n💾 ID mapping saved to: ${MAPPING_FILE_PATH}`);

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                        SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  ✅ Agents created:  ${stats.agentsCreated}`);
    console.log(`  ✅ Users created:   ${stats.usersCreated}`);
    console.log(`  ⚠️  Skipped:        ${stats.skipped}`);
    console.log(`  ❌ Errors:          ${stats.errors}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n✨ Part 1 complete! Run Part 2 to import ad accounts and transactions.\n');
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
