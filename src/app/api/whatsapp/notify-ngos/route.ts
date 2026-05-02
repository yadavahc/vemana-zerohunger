import { NextRequest, NextResponse } from "next/server";

const GRAPH_VERSION = "v20.0";

async function sendWhatsAppMessage(to: string, message: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_API_KEY;

  if (!phoneNumberId || !accessToken) {
    console.error("WhatsApp credentials are not set in environment variables.");
    return { success: false, reason: "Server configuration error." };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: `91${to}`, // Assuming Indian numbers
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Failed to send WhatsApp message to ${to}:`, errorData);
      return { success: false, error: errorData };
    }

    return { success: true, data: await response.json() };
  } catch (error) {
    console.error(`Exception while sending WhatsApp message to ${to}:`, error);
    return { success: false, error };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { foodType, quantity, location, expiryTime, contactNumber } = await req.json();

    const ngoNumbers = process.env.NGO_PHONE_NUMBERS?.split(",") || [];
    if (ngoNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: "No NGO phone numbers configured." },
        { status: 500 }
      );
    }

    const message = `New Food Donation Alert!
    
Food Type: ${foodType}
Quantity: ${quantity} servings
Location: ${location}
Expires By: ${expiryTime}
Contact: ${contactNumber}

Please coordinate pickup if you can accept this donation. Thank you!
- Prasadam Platform`;

    const results = await Promise.all(
      ngoNumbers.map((number) => sendWhatsAppMessage(number.trim(), message))
    );

    const failures = results.filter((r) => !r.success);

    if (failures.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Sent notifications, but ${failures.length} failed.`,
          failures,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully sent notifications to ${ngoNumbers.length} NGOs.`,
    });
  } catch (error) {
    console.error("[notify-ngos] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
