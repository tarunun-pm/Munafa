import type { Transaction, PnLSummary } from '@/types'

/**
 * Computes a P&L summary from an array of today's transactions.
 * Input:  Transaction[] — all transactions for a vendor on a given day.
 * Output: PnLSummary — totals, net profit, margin, highest cost item.
 */
export function computePnL(transactions: Transaction[]): PnLSummary {
  let total_expense = 0
  let total_revenue = 0
  let spoilage_loss = 0

  const expenseByItem: Record<string, number> = {}

  for (const t of transactions) {
    switch (t.entry_type) {
      case 'expense':
        total_expense += t.total_amount
        const key = t.item_name_raw ?? 'Other'
        expenseByItem[key] = (expenseByItem[key] ?? 0) + t.total_amount
        break
      case 'sale':
        total_revenue += t.total_amount
        break
      case 'spoilage':
        spoilage_loss += t.total_amount
        break
    }
  }

  const net_profit = total_revenue - total_expense - spoilage_loss
  const margin_pct = total_revenue > 0
    ? (net_profit / total_revenue) * 100
    : 0

  let highest_cost_item: string | null = null
  let highest_cost_amount: number | null = null

  for (const [item, amount] of Object.entries(expenseByItem)) {
    if (highest_cost_amount === null || amount > highest_cost_amount) {
      highest_cost_item = item
      highest_cost_amount = amount
    }
  }

  return {
    total_expense,
    total_revenue,
    net_profit,
    spoilage_loss,
    margin_pct,
    highest_cost_item,
    highest_cost_amount,
  }
}

/**
 * Formats a number as an Indian Rupee string.
 * Input:  number. Output: "₹1,234" formatted with en-IN locale.
 */
export function formatRupee(amount: number): string {
  return `₹${Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}
