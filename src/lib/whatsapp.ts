/**
 * WhatsApp Cloud API wrapper.
 * Server context: calls Meta Graph API directly (env vars available).
 * Client context: proxies through /api/whatsapp (keeps API key server-only).
 */

const GRAPH_VERSION = "v20.0";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Bare 10-digit Indian number → prepend country code
  return digits.length === 10 ? `91${digits}` : digits;
}

async function callMetaApi(to: string, message: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_API_KEY;
  if (!phoneNumberId || !accessToken) {
    console.warn("[WhatsApp] WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_KEY not set — skipping");
    return;
  }
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: { body: message },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[WhatsApp] API error:", err);
  }
}

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  if (!to) return;
  try {
    if (typeof window === "undefined") {
      await callMetaApi(to, message);
    } else {
      await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message }),
      });
    }
  } catch (err) {
    // Non-fatal — WhatsApp failure must never break the main flow
    console.error("[WhatsApp] Unexpected error:", err);
  }
}
