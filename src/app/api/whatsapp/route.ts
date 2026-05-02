/**
 * Server proxy for WhatsApp Cloud API.
 * Keeps WHATSAPP_API_KEY and WHATSAPP_PHONE_NUMBER_ID server-side only.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v20.0";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export async function POST(req: NextRequest) {
  try {
    const { to, message } = await req.json() as { to: string; message: string };
    if (!to || !message) {
      return NextResponse.json({ error: "to and message required" }, { status: 400 });
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_API_KEY;

    if (!phoneNumberId || !accessToken) {
      console.warn("[WhatsApp] Missing env vars — message not sent");
      return NextResponse.json({ success: false, reason: "unconfigured" });
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
      console.error("[WhatsApp Route] Meta API error:", err);
      return NextResponse.json({ success: false, error: err }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WhatsApp Route]", error);
    return NextResponse.json({ error: "Failed to send WhatsApp" }, { status: 500 });
  }
}
