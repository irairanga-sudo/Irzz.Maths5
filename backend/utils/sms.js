/**
 * Thin wrapper around a legitimate SMS OTP provider.
 * Swap the fetch call below for your chosen provider's actual API
 * (e.g. a licensed Sri Lankan SMS aggregator). Keep all credentials
 * in environment variables — never hard-code them here.
 */
async function sendOtpSms(phoneNumber, code) {
  const url = process.env.SMS_API_URL;
  const body = {
    apiKey: process.env.SMS_API_KEY,
    accountId: process.env.SMS_ACCOUNT_ID,
    senderId: process.env.SMS_SENDER_ID,
    to: phoneNumber,
    message: `Your Irzz.Maths.LK verification code is ${code}. It expires in ${process.env.OTP_EXPIRY_MINUTES} minutes.`,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`SMS provider error (${response.status}): ${text}`);
  }

  return true;
}

module.exports = { sendOtpSms };
