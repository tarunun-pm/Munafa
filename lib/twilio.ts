import twilio from 'twilio'

/**
 * Sends a WhatsApp message via Twilio sandbox / Business API.
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
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are not configured')
  }

  const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`
  const client = twilio(accountSid, authToken)

  const msg = await client.messages.create({
    from,
    to: `whatsapp:${formattedPhone}`,
    body: message,
  })

  return msg.sid
}

/**
 * Sends a phone verification OTP code using Twilio Verify V2 service.
 * Input:  phone   — E.164 phone string (e.g. "+919876543210")
 *         channel — 'sms' or 'whatsapp' (default 'sms')
 */
export async function sendTwilioOtp(
  phone: string,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Twilio Verify credentials (TWILIO_VERIFY_SERVICE_SID) are not configured')
  }

  const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`
  const client = twilio(accountSid, authToken)

  const verification = await client.verify.v2
    .services(serviceSid)
    .verifications.create({ to: formattedPhone, channel })

  return verification.status === 'pending'
}

/**
 * Verifies an OTP code entered by the user via Twilio Verify V2 service.
 * Input:  phone — E.164 phone string (e.g. "+919876543210")
 *         code  — 6-digit OTP code string
 */
export async function verifyTwilioOtp(
  phone: string,
  code: string
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Twilio Verify credentials (TWILIO_VERIFY_SERVICE_SID) are not configured')
  }

  const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`
  const client = twilio(accountSid, authToken)

  const check = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({ to: formattedPhone, code })

  return check.status === 'approved'
}
