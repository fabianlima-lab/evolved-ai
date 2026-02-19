import prisma from '../lib/prisma.js';

// ─────────────────────────────────────────────────────
// Expense Tracking Service
//
// Tracks spending by category for each subscriber.
// The AI emits [ACTION:log_expense amount="..." category="..." description="..."]
// tags. Results are stored in the database.
//
// Monthly pulse: at end of month, the briefing scheduler
// queries this to generate a spending summary.
// ─────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'dining',
  'groceries',
  'coffee',
  'gas',
  'medical',
  'subscriptions',
  'shopping',
  'entertainment',
  'transport',
  'utilities',
  'personal',
  'other',
];

/**
 * Log an expense for a subscriber.
 *
 * @param {string} subscriberId
 * @param {object} data
 * @param {number} data.amount - Dollar amount (e.g. 47.50)
 * @param {string} data.category - One of VALID_CATEGORIES
 * @param {string} [data.description] - Optional description
 * @param {Date} [data.date] - Expense date (defaults to now)
 * @returns {Promise<{ success: boolean, expense: object|null, error: string|null }>}
 */
export async function logExpense(subscriberId, { amount, category, description, date }) {
  // Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return { success: false, expense: null, error: 'invalid_amount' };
  }

  // Validate category — normalize to lowercase
  const normalizedCategory = (category || 'other').toLowerCase().trim();
  const finalCategory = VALID_CATEGORIES.includes(normalizedCategory)
    ? normalizedCategory
    : 'other';

  // Sanitize description
  const cleanDescription = description
    ? description.replace(/[<>]/g, '').slice(0, 300).trim()
    : null;

  try {
    const expense = await prisma.expense.create({
      data: {
        subscriberId,
        amount: Math.round(parsedAmount * 100) / 100, // Round to 2 decimal places
        category: finalCategory,
        description: cleanDescription,
        date: date ? new Date(date) : new Date(),
      },
    });

    console.log(`[EXPENSE] Logged $${expense.amount} ${finalCategory} for subscriber:${subscriberId}`);
    return { success: true, expense, error: null };
  } catch (err) {
    console.error(`[EXPENSE] Failed to log: ${err.message}`);
    return { success: false, expense: null, error: 'db_error' };
  }
}

/**
 * Get expense summary for a subscriber for a given month.
 *
 * @param {string} subscriberId
 * @param {number} [year] - Year (defaults to current)
 * @param {number} [month] - Month 1-12 (defaults to current)
 * @returns {Promise<{ total: number, byCategory: object, count: number }>}
 */
export async function getMonthlyExpenses(subscriberId, year, month) {
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || (now.getMonth() + 1);

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 1);

  const expenses = await prisma.expense.findMany({
    where: {
      subscriberId,
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: 'desc' },
  });

  // Group by category
  const byCategory = {};
  let total = 0;

  for (const exp of expenses) {
    if (!byCategory[exp.category]) {
      byCategory[exp.category] = { total: 0, count: 0, items: [] };
    }
    byCategory[exp.category].total += exp.amount;
    byCategory[exp.category].count += 1;
    byCategory[exp.category].items.push({
      amount: exp.amount,
      description: exp.description,
      date: exp.date,
    });
    total += exp.amount;
  }

  // Round totals
  total = Math.round(total * 100) / 100;
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].total = Math.round(byCategory[cat].total * 100) / 100;
  }

  return { total, byCategory, count: expenses.length };
}

/**
 * Format monthly expenses as a spending pulse message.
 * Used by the briefing scheduler at end of month.
 *
 * @param {string} subscriberId
 * @param {string} [name] - Subscriber name for personalization
 * @returns {Promise<string|null>} Formatted message or null if no expenses
 */
export async function formatMonthlyPulse(subscriberId, name) {
  const now = new Date();
  const { total, byCategory, count } = await getMonthlyExpenses(subscriberId);

  if (count === 0) return null;

  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const greeting = name || 'there';

  let msg = `Hey ${greeting}! Here's your ${monthName} spending pulse\n\n`;
  msg += `Total: $${total.toFixed(2)} across ${count} expense${count > 1 ? 's' : ''}\n\n`;

  // Sort categories by total descending
  const sorted = Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total);

  for (const [cat, data] of sorted) {
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    msg += `${label}: $${data.total.toFixed(2)} (${data.count}x)\n`;
  }

  msg += `\nJust awareness, no judgment 💙`;

  return msg;
}

/**
 * Get total spending for a subscriber in a specific category this month.
 *
 * @param {string} subscriberId
 * @param {string} category
 * @returns {Promise<{ total: number, count: number }>}
 */
export async function getCategoryTotal(subscriberId, category) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const expenses = await prisma.expense.findMany({
    where: {
      subscriberId,
      category: category.toLowerCase(),
      date: { gte: startDate, lt: endDate },
    },
  });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { total: Math.round(total * 100) / 100, count: expenses.length };
}

export { VALID_CATEGORIES };
