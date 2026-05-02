// Placeholder for email sending logic
// This would typically use a service like SendGrid, Nodemailer, or AWS SES.

/**
 * Sends an email.
 * @param to - The recipient's email address.
 * @param subject - The subject of the email.
 * @param html - The HTML body of the email.
 */
export async function sendEmail(to: string, subject: string, html: string) {
  console.log("--- SENDING EMAIL ---");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log("Body:");
  console.log(html);
  console.log("---------------------");
  // In a real app, you would integrate with an email API here.
  // For now, we'll just simulate a successful send.
  return Promise.resolve({ success: true });
}

/**
 * Builds the HTML for a "match found" email to a restaurant.
 * @param restaurantName - The name of the restaurant.
 * @param ngoName - The name of the matched NGO.
 * @param foodItems - A description of the food items.
 * @param approvalLink - The link to approve the match.
 * @returns The HTML string for the email body.
 */
export function buildMatchFoundEmail(restaurantName: string, ngoName: string, foodItems: string, approvalLink: string): string {
  return `
    <h1>Match Found for Your Donation!</h1>
    <p>Dear ${restaurantName},</p>
    <p>Great news! We've found a match for your food donation of <strong>${foodItems}</strong>.</p>
    <p><strong>${ngoName}</strong> is ready to accept your donation.</p>
    <p>Please click the link below to approve the match and schedule the pickup.</p>
    <a href="${approvalLink}">Approve Match</a>
    <p>Thank you for your generosity!</p>
  `;
}

/**
 * Builds the HTML for an "approval confirmation" email to an NGO.
 * @param ngoName - The name of the NGO.
 * @param restaurantName - The name of the restaurant.
 * @param address - The pickup address.
 * @param pickupTime - The scheduled pickup time.
 * @returns The HTML string for the email body.
 */
export function buildApprovalEmail(ngoName: string, restaurantName: string, address: string, pickupTime: string): string {
  return `
    <h1>Donation Approved!</h1>
    <p>Dear ${ngoName},</p>
    <p>The donation from <strong>${restaurantName}</strong> has been approved.</p>
    <p><strong>Pickup Address:</strong> ${address}</p>
    <p><strong>Scheduled Pickup Time:</strong> ${pickupTime}</p>
    <p>Please arrange for your volunteer to pick up the donation at the scheduled time.</p>
    <p>Thank you for your work!</p>
  `;
}
