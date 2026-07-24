import Anthropic from '@anthropic-ai/sdk'
import type { ParseVoiceResult, PnLSummary } from '@/types'

const PARSE_SYSTEM = `You are a data extraction engine for an Indian street vendor expense and sales tracker.
Extract all items, quantities, units, prices, and supplier names from the vendor's voice log.
Input is transcribed Hindi or Hinglish speech. It will be informal and imprecise.
Handle number words: dus=10, paanch=5, do=2, teen=3, pachaas=50, sau=100, hazaar=1000.
Handle unit words: kilo=kg, litre=litre, piece=piece, packet=piece.
If the vendor mentions a supplier name, extract it.
Determine entry_type: "expense" if buying, "sale" if selling, "spoilage" if mentioning waste/loss.
Return ONLY valid JSON. No explanation. No markdown. No preamble.

Return format:
{
  "entries": [
    {
      "entry_type": "expense" | "sale" | "spoilage",
      "item_name": "string (lowercase)",
      "quantity": number | null,
      "unit": "kg" | "litre" | "piece" | "bundle" | null,
      "unit_price": number | null,
      "total_price": number,
      "supplier_name": "string" | null,
      "confidence": 0.0 to 1.0
    }
  ]
}

If total_price is not stated but quantity and unit_price are, compute it.
If only total_price is stated, use it directly.
If a field cannot be determined, use null. Never guess prices.`

const SUMMARY_SYSTEM = `You are an AI profit coach for Indian street vendors.
Generate a single clear encouraging WhatsApp message in Hindi summarising the vendor's day.
Rules:
- Under 50 words
- State net profit or loss plainly
- Mention one actionable observation if data supports it
- Simple Hindi. No English. No jargon. No accounting terms.
- If profit positive, be encouraging. If loss, honest but not discouraging.
- End with one practical suggestion for tomorrow.
Return only the message text. No formatting. No preamble.`

/**
 * Parses a Hindi/Hinglish voice transcription into structured entries using Claude.
 * Input:  transcription — raw Whisper output.
 * Output: ParseVoiceResult with array of parsed entries.
 */
export async function parseVoiceTranscript(
  transcription: string
): Promise<ParseVoiceResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

  const client = new Anthropic({ apiKey })

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: PARSE_SYSTEM,
    messages: [{ role: 'user', content: transcription }],
  })

  let raw = msg.content[0].type === 'text' ? msg.content[0].text : ''

  // Claude sometimes wraps JSON in markdown code fences despite instructions
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    return JSON.parse(raw) as ParseVoiceResult
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 200)}`)
  }
}

/**
 * Generates a Hindi WhatsApp summary sentence using Claude.
 * Input:  pnl — computed P&L for the day. daysTracked — how many days vendor has used the app.
 * Output: Hindi summary string.
 */
export async function generateHindiSummary(
  pnl: PnLSummary,
  daysTracked: number
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

  const client = new Anthropic({ apiKey })

  const userMsg = `Vendor data for today:
- Total expense: ₹${pnl.total_expense}
- Total revenue: ₹${pnl.total_revenue}
- Net profit: ₹${pnl.net_profit}
- Spoilage loss: ₹${pnl.spoilage_loss}
- Highest cost item: ${pnl.highest_cost_item ?? 'N/A'} (₹${pnl.highest_cost_amount ?? 0})
- Days tracked so far: ${daysTracked}`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 256,
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  return msg.content[0].type === 'text' ? msg.content[0].text : ''
}
