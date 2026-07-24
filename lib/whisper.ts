import OpenAI from 'openai'

/**
 * Transcribes an audio blob to text using OpenAI Whisper.
 * Input:  audioBlob — recorded audio (webm/opus format).
 *         language  — BCP-47 language code, default 'hi' (Hindi).
 * Output: Transcribed text string.
 * Throws: Error if OPENAI_API_KEY is missing or API call fails.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language = 'hi'
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const client = new OpenAI({ apiKey })

  // Convert Blob to a named File so the OpenAI SDK can read it correctly
  const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })

  const response = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language,
    prompt:
      'Hindi or Hinglish street vendor expense and sales log. Items like aloo, pyaaz, tamatar. Prices in rupees.',
  })

  return response.text
}
