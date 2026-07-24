import { NextRequest, NextResponse } from 'next/server'
import { sendTwilioOtp, verifyTwilioOtp } from '@/lib/twilio'

/**
 * POST /api/auth/otp
 * Handles sending and verifying 6-digit OTP codes via Twilio Verify.
 * 
 * Body for sending:
 * { action: 'send', phone: '9876543210', channel?: 'sms' | 'whatsapp' }
 * 
 * Body for verifying:
 * { action: 'verify', phone: '9876543210', code: '123456' }
 */
export async function POST(req: NextRequest) {
  try {
    const { action, phone, code, channel } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    if (action === 'send') {
      try {
        const success = await sendTwilioOtp(phone, channel || 'sms')
        return NextResponse.json({ success, message: `OTP sent via ${channel || 'sms'}` })
      } catch (err: any) {
        console.error('[auth/otp] send error:', err)
        return NextResponse.json({ error: err.message || 'Failed to send OTP' }, { status: 500 })
      }
    }

    if (action === 'verify') {
      if (!code) {
        return NextResponse.json({ error: 'OTP code is required' }, { status: 400 })
      }
      try {
        const isValid = await verifyTwilioOtp(phone, code)
        if (!isValid) {
          return NextResponse.json({ error: 'Invalid or expired OTP code' }, { status: 400 })
        }
        return NextResponse.json({ success: true, verified: true })
      } catch (err: any) {
        console.error('[auth/otp] verify error:', err)
        return NextResponse.json({ error: err.message || 'Failed to verify OTP' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Invalid action. Use "send" or "verify".' }, { status: 400 })
  } catch (err) {
    console.error('[auth/otp] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
