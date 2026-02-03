import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const campaignTemplates = [
  {
    name: 'E-commerce Sales Starter',
    description: 'Perfect for online stores looking to drive purchases. Optimized for ROAS and conversions.',
    objective: 'ECOMMERCE_SALES',
    category: 'e-commerce',
    defaultBudget: 50,
    defaultTargeting: JSON.stringify({
      locations: ['US'],
      ageMin: 25,
      ageMax: 55,
      genders: ['all'],
      interests: ['Online shopping', 'E-commerce'],
      behaviors: ['Engaged shoppers', 'Online buyers']
    }),
    optimizationRules: JSON.stringify([
      {
        name: 'Kill Low ROAS Ads',
        ruleType: 'KILL_LOSING',
        conditions: { metric: 'roas', operator: '<', value: 1, timeframe: 'last_7d' },
        actions: { action: 'pause' }
      },
      {
        name: 'Scale High ROAS',
        ruleType: 'BUDGET_INCREASE',
        conditions: { metric: 'roas', operator: '>', value: 3, timeframe: 'last_7d' },
        actions: { action: 'increase_budget', value: 25, unit: 'percent' }
      }
    ]),
    isSystem: true,
    isActive: true
  },
  {
    name: 'Lead Generation Pro',
    description: 'Capture high-quality leads with optimized forms and targeting. Best for B2B and services.',
    objective: 'LEAD_GENERATION',
    category: 'lead-gen',
    defaultBudget: 40,
    defaultTargeting: JSON.stringify({
      locations: ['US', 'UK', 'Canada'],
      ageMin: 25,
      ageMax: 54,
      genders: ['all'],
      interests: ['Business', 'Entrepreneurship'],
      behaviors: ['Small business owners']
    }),
    optimizationRules: JSON.stringify([
      {
        name: 'Reduce High CPL',
        ruleType: 'BUDGET_DECREASE',
        conditions: { metric: 'cpa', operator: '>', value: 30, timeframe: 'last_7d' },
        actions: { action: 'decrease_budget', value: 15, unit: 'percent' }
      },
      {
        name: 'Scale Low CPL Winners',
        ruleType: 'BUDGET_INCREASE',
        conditions: { metric: 'cpa', operator: '<', value: 15, timeframe: 'last_7d' },
        actions: { action: 'increase_budget', value: 20, unit: 'percent' }
      }
    ]),
    isSystem: true,
    isActive: true
  },
  {
    name: 'Traffic Booster',
    description: 'Drive maximum website visitors at the lowest cost per click. Ideal for content and blogs.',
    objective: 'WEBSITE_TRAFFIC',
    category: 'traffic',
    defaultBudget: 30,
    defaultTargeting: JSON.stringify({
      locations: ['US'],
      ageMin: 18,
      ageMax: 65,
      genders: ['all'],
      interests: [],
      behaviors: []
    }),
    optimizationRules: JSON.stringify([
      {
        name: 'Pause High CPC Ads',
        ruleType: 'PAUSE_AD',
        conditions: { metric: 'cpc', operator: '>', value: 2, timeframe: 'last_7d' },
        actions: { action: 'pause' }
      },
      {
        name: 'Scale Low CPC Winners',
        ruleType: 'BUDGET_INCREASE',
        conditions: { metric: 'cpc', operator: '<', value: 0.5, timeframe: 'last_7d' },
        actions: { action: 'increase_budget', value: 30, unit: 'percent' }
      }
    ]),
    isSystem: true,
    isActive: true
  },
  {
    name: 'Brand Awareness Campaign',
    description: 'Maximize reach and impressions to build brand recognition. Great for new products.',
    objective: 'BRAND_AWARENESS',
    category: 'awareness',
    defaultBudget: 75,
    defaultTargeting: JSON.stringify({
      locations: ['US'],
      ageMin: 18,
      ageMax: 65,
      genders: ['all'],
      interests: [],
      behaviors: []
    }),
    optimizationRules: JSON.stringify([
      {
        name: 'Optimize for Low CPM',
        ruleType: 'BUDGET_DECREASE',
        conditions: { metric: 'cpm', operator: '>', value: 15, timeframe: 'last_7d' },
        actions: { action: 'decrease_budget', value: 10, unit: 'percent' }
      }
    ]),
    isSystem: true,
    isActive: true
  },
  {
    name: 'Engagement Maximizer',
    description: 'Get more likes, comments, and shares on your content. Perfect for social proof.',
    objective: 'ENGAGEMENT',
    category: 'engagement',
    defaultBudget: 25,
    defaultTargeting: JSON.stringify({
      locations: ['US'],
      ageMin: 18,
      ageMax: 45,
      genders: ['all'],
      interests: ['Social media'],
      behaviors: []
    }),
    optimizationRules: JSON.stringify([
      {
        name: 'Scale High Engagement',
        ruleType: 'BUDGET_INCREASE',
        conditions: { metric: 'engagement_rate', operator: '>', value: 5, timeframe: 'last_7d' },
        actions: { action: 'increase_budget', value: 20, unit: 'percent' }
      }
    ]),
    isSystem: true,
    isActive: true
  },
  {
    name: 'Retargeting Power',
    description: 'Re-engage website visitors who didn\'t convert. High-intent audience targeting.',
    objective: 'ECOMMERCE_SALES',
    category: 'retargeting',
    defaultBudget: 35,
    defaultTargeting: JSON.stringify({
      locations: ['US'],
      ageMin: 18,
      ageMax: 65,
      genders: ['all'],
      interests: [],
      behaviors: [],
      customAudiences: ['website_visitors_30d', 'add_to_cart_no_purchase']
    }),
    optimizationRules: JSON.stringify([
      {
        name: 'High ROAS Scaling',
        ruleType: 'BUDGET_INCREASE',
        conditions: { metric: 'roas', operator: '>', value: 5, timeframe: 'last_7d' },
        actions: { action: 'increase_budget', value: 30, unit: 'percent' }
      }
    ]),
    isSystem: true,
    isActive: true
  }
]

async function seedTemplates() {
  console.log('Seeding campaign templates...')

  for (const template of campaignTemplates) {
    const existing = await prisma.campaignTemplate.findFirst({
      where: { name: template.name, isSystem: true }
    })

    if (!existing) {
      await prisma.campaignTemplate.create({ data: template })
      console.log(`Created template: ${template.name}`)
    } else {
      console.log(`Template already exists: ${template.name}`)
    }
  }

  console.log('Done seeding templates!')
}

seedTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
