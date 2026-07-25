import Anthropic from '@anthropic-ai/sdk'
import type { ParseVoiceResult, PnLSummary } from '@/types'

const PARSE_SYSTEM = `You are a data extraction engine for an Indian street vendor expense and sales tracker.
Extract all items, quantities, units, prices, and supplier names from the vendor's voice log.
Input is transcribed Hindi or Hinglish speech. It will be informal and imprecise.

## Number words (Hindi → number)
dus=10, paanch=5, do=2, teen=3, char=4, chhe=6, saat=7, aath=8, nau=9, gyarah=11, barah=12,
pachaas=50, saath=60, sattar=70, assi=80, nabbe=90, sau=100, dedh sau=150, dhai sau=250,
hazaar=1000, dedh hazaar=1500, dhai hazaar=2500, do hazaar=2000.

## Unit conversion rules (CRITICAL)
Always convert local/traditional units into standard units (kg, litre, piece, bundle).
Adjust quantity so it is expressed in the standard unit. Never output a non-standard unit.

### Weight units → kg
| Spoken word(s)                          | Standard unit | Multiplier |
|-----------------------------------------|---------------|------------|
| pao, paav, paao, pav                    | kg            | 0.25       |
| aadha kilo, adha kilo, half kilo        | kg            | 0.5        |
| teen paav, teen pao, paune kilo         | kg            | 0.75       |
| dedh kilo, dhed kilo                    | kg            | 1.5        |
| dhai kilo, dhaia kilo                   | kg            | 2.5        |
| kilo, kilogram, kg                      | kg            | 1.0        |
| 100 gram, ek sau gram                   | kg            | 0.1        |
| 250 gram, dhai sau gram                 | kg            | 0.25       |
| 500 gram, paanch sau gram               | kg            | 0.5        |
| ser, seer                               | kg            | 0.933      |
| aadha ser, adha ser                     | kg            | 0.4665     |
| chatak                                  | kg            | 0.0583     |
| tola                                    | kg            | 0.01167    |
| maan, maund                             | kg            | 37.32      |

### Volume units → litre
| Spoken word(s)                          | Standard unit | Multiplier |
|-----------------------------------------|---------------|------------|
| litre, liter, litr                      | litre         | 1.0        |
| aadha litre, adha litre, half litre     | litre         | 0.5        |
| quart, quarter litre                    | litre         | 0.25       |
| ml, millilitre (e.g. 500ml)             | litre         | 0.001      |

### Count/pack units → piece
| Spoken word(s)                          | Standard unit | Multiplier |
|-----------------------------------------|---------------|------------|
| piece, pcs, nag, nag, no., number       | piece         | 1.0        |
| packet, pack, pkt, pouch                | piece         | 1.0        |
| dozen, darjan                           | piece         | 12.0       |
| half dozen, aadha darjan               | piece         | 6.0        |
| gross                                   | piece         | 144.0      |

### Bundle units → bundle
| Spoken word(s)                          | Standard unit | Multiplier |
|-----------------------------------------|---------------|------------|
| bundle, gaththa, gatta, gathri          | bundle        | 1.0        |

Example: vendor says "ek pao tamatar liya 10 rupaye mein"
→ quantity=0.25, unit="kg", total_price=10

Example: vendor says "do pao pyaaz becha 30 rupaye"
→ quantity=0.5, unit="kg", total_price=30

Example: vendor says "teen paav aalu 15 rupaye"
→ quantity=0.75, unit="kg", total_price=15

## Entry type detection
- "expense" → vendor is BUYING (kharida, liya, mangaya, aaya maal)
- "sale"    → vendor is SELLING (becha, bikri, diya customer ko, sell kiya)
- "spoilage" → waste or loss (kharab hua, pheka, nuksaan)

If the vendor mentions a supplier name, extract it.
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
