import twilio from 'twilio'

/**
 * Sends a WhatsApp message via Twilio sandbox.
 * Input:  phone   — E.164 format phone number (e.g. "+919876543210").
 *         message — Text content of the WhatsApp message.
 * Output: Twilio message SID string.
 * Throws: Error if Twilio credentials are missing.
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are not configured')
  }

  const client = twilio(accountSid, authToken)

  const msg = await client.messages.create({
    from,
    to: `whatsapp:${phone}`,
    body: message,
  })

  return msg.sid
}
