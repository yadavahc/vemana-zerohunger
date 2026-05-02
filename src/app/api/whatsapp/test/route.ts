import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v20.0";

export async function GET() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_API_KEY;

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { success: false, reason: "WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_KEY not set in .env.local" },
      { status: 400 }
    );
  }

  // Fetch the registered phone number from Meta so we can send the test to it
  const phoneRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=display_phone_number`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!phoneRes.ok) {
    const err = await phoneRes.json().catch(() => ({}));
    return NextResponse.json({ success: false, error: err }, { status: 502 });
  }

  const { display_phone_number } = await phoneRes.json() as { display_phone_number: string };
  const to = display_phone_number.replace(/\D/g, "");

  const msgRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: "🙏 Prasadam WhatsApp integration is working! Agents will now send notifications through WhatsApp." },
      }),
    }
  );

  if (!msgRes.ok) {
    const err = await msgRes.json().catch(() => ({}));
    return NextResponse.json({ success: false, error: err }, { status: 502 });
  }

  return NextResponse.json({ success: true, sentTo: display_phone_number });
}
