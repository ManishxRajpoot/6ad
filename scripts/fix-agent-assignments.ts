/**
 * Fix Agent Assignments: Link users to their agents based on old ref_id
 *
 * Run with: npx ts-node scripts/fix-agent-assignments.ts
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

// Load environment variables from apps/api/.env
config({ path: '/Users/manishrajpoot/Coinest_Share/6ad/apps/api/.env' })

const prisma = new PrismaClient()

interface OldUser {
  id: number
  email: string
  type: number  // 1=ADMIN, 2=AGENT, 3=USER
  ref_id: number  // Parent user ID (agent)
}

// Parse SQL INSERT statements
function parseInsertStatements(sql: string, tableName: string): any[] {
  const regex = new RegExp(`INSERT INTO \`${tableName}\`[^;]+;`, 'gis')
  const matches = sql.match(regex)
  if (!matches) return []

  const results: any[] = []

  for (const match of matches) {
    const colMatch = match.match(/\(`([^)]+)`\)\s+VALUES/i)
    if (!colMatch) continue
    const columns = colMatch[1].split('`, `')

    const valuesSection = match.substring(match.indexOf('VALUES') + 6)

    let depth = 0
    let inString = false
    let escapeNext = false
    let currentValue = ''
    const valueSets: string[] = []

    for (let i = 0; i < valuesSection.length; i++) {
      const char = valuesSection[i]

      if (escapeNext) {
        currentValue += char
        escapeNext = false
        continue
      }

      if (char === '\\') {
        escapeNext = true
        currentValue += char
        continue
      }

      if (char === "'" && !escapeNext) {
        inString = !inString
        currentValue += char
        continue
      }

      if (!inString) {
        if (char === '(') {
          depth++
          if (depth === 1) {
            currentValue = ''
            continue
          }
        } else if (char === ')') {
          depth--
          if (depth === 0) {
            valueSets.push(currentValue)
            continue
          }
        }
      }

      currentValue += char
    }

    for (const valueSet of valueSets) {
      const values = parseCSVLine(valueSet)
      if (values.length === columns.length) {
        const obj: any = {}
        columns.forEach((col, i) => {
          let val = values[i]
          if (val === 'NULL' || val === 'null') {
            obj[col] = null
          } else if (val.match(/^-?\d+$/)) {
            obj[col] = parseInt(val)
          } else if (val.match(/^-?\d+\.\d+$/)) {
            obj[col] = parseFloat(val)
          } else {
            obj[col] = val
          }
        })
        results.push(obj)
      }
    }
  }

  return results
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  let escapeNext = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (escapeNext) {
      if (char === 'n') current += '\n'
      else if (char === 'r') current += '\r'
      else if (char === 't') current += '\t'
      else current += char
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (char === "'" && !escapeNext) {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

async function main() {
  console.log('🔧 Fixing Agent Assignments')
  console.log('============================\n')

  const sqlPath = '/Users/manishrajpoot/Coinest_Share/sixad_db.sql'
  console.log(`📄 Reading SQL file: ${sqlPath}`)

  const sql = fs.readFileSync(sqlPath, 'utf-8')
  console.log(`✅ SQL file loaded\n`)

  console.log('📊 Parsing old users...')
  const oldUsers = parseInsertStatements(sql, 'users') as OldUser[]
  console.log(`  Found ${oldUsers.length} old users\n`)

  // Build map of old user IDs to emails
  const oldIdToEmail = new Map<number, string>()
  const oldIdToType = new Map<number, number>()
  const oldIdToRefId = new Map<number, number>()

  for (const user of oldUsers) {
    oldIdToEmail.set(user.id, user.email)
    oldIdToType.set(user.id, user.type)
    oldIdToRefId.set(user.id, user.ref_id)
  }

  // Find agents (type=2) in old system
  const oldAgents = oldUsers.filter(u => u.type === 2)
  console.log(`📋 Found ${oldAgents.length} agents in old system:`)
  for (const agent of oldAgents) {
    console.log(`  - ID ${agent.id}: ${agent.email}`)
  }
  console.log()

  // Get all users from new database
  const newUsers = await prisma.user.findMany({
    select: { id: true, email: true, role: true, agentId: true }
  })

  // Build map of email to new user ID
  const emailToNewId = new Map<string, string>()
  for (const user of newUsers) {
    emailToNewId.set(user.email.toLowerCase(), user.id)
  }

  // Now update agent assignments
  let updated = 0
  let skipped = 0

  console.log('🔄 Updating agent assignments...\n')

  for (const oldUser of oldUsers) {
    // Skip admins and agents themselves
    if (oldUser.type !== 3) continue // Only process regular users (type=3)

    const newUserId = emailToNewId.get(oldUser.email.toLowerCase())
    if (!newUserId) {
      continue
    }

    // Find the agent for this user
    const refId = oldUser.ref_id
    if (!refId || refId === oldUser.id) {
      skipped++
      continue
    }

    // Get the agent's email from old system
    const agentEmail = oldIdToEmail.get(refId)
    if (!agentEmail) {
      console.log(`  ⚠️ User ${oldUser.email}: ref_id ${refId} not found in old users`)
      skipped++
      continue
    }

    // Find the agent in new system
    const newAgentId = emailToNewId.get(agentEmail.toLowerCase())
    if (!newAgentId) {
      console.log(`  ⚠️ User ${oldUser.email}: agent ${agentEmail} not found in new system`)
      skipped++
      continue
    }

    // Check if already assigned
    const currentUser = newUsers.find(u => u.id === newUserId)
    if (currentUser?.agentId === newAgentId) {
      skipped++
      continue
    }

    // Update the user's agentId
    try {
      await prisma.user.update({
        where: { id: newUserId },
        data: { agentId: newAgentId }
      })
      console.log(`  ✅ ${oldUser.email} -> Agent: ${agentEmail}`)
      updated++
    } catch (error: any) {
      console.error(`  ❌ Failed to update ${oldUser.email}:`, error.message)
    }
  }

  console.log('\n============================')
  console.log('✅ Agent assignment fix completed!')
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped: ${skipped}`)

  // Show summary of agents and their user counts
  console.log('\n📊 Agent Summary:')
  const agentCounts = await prisma.user.groupBy({
    by: ['agentId'],
    _count: true,
    where: { role: 'USER', agentId: { not: null } }
  })

  for (const count of agentCounts) {
    if (count.agentId) {
      const agent = await prisma.user.findUnique({
        where: { id: count.agentId },
        select: { username: true, email: true }
      })
      console.log(`  ${agent?.username || agent?.email}: ${count._count} users`)
    }
  }

  const noAgentCount = await prisma.user.count({
    where: { role: 'USER', agentId: null }
  })
  console.log(`  No agent assigned: ${noAgentCount} users`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fix failed:', error)
  prisma.$disconnect()
  process.exit(1)
})
