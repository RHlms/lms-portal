// api/send-magic-link.js
// Receives email + userType, looks up GHL contact, generates magic link token, sends email

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const PORTAL_BASE_URL = 'https://documents.shortsalestart.com';

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, userType } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Search for contact by email using v2 search endpoint
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    if (!searchRes.ok) {
      const err = await searchRes.text();
      console.error('GHL search error:', err);
      return res.status(500).json({ error: 'Failed to search contacts', details: err });
    }

    const searchData = await searchRes.json();
    const contacts = searchData.contacts || searchData.data || [];

    // Find exact email match
    const contact = contacts.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());

    if (!contact) {
      return res.status(404).json({ error: 'No account found' });
    }

    const contactId = contact.id;

    // Generate token and expiry (15 minutes from now)
    const token = generateToken();
    const expiry = Date.now() + (15 * 60 * 1000);

    // Store token + expiry on GHL contact
    const updateRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          customFields: [
            { key: 'portal_login_token', field_value: token },
            { key: 'portal_login_expiry', field_value: String(expiry) }
          ]
        })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('GHL update error:', err);
      return res.status(500).json({ error: 'Failed to store token', details: err });
    }

    // Build magic link
    const magicLink = `${PORTAL_BASE_URL}/dashboard?token=${token}&type=${userType || 'agent'}`;

    // Send email via GHL
    const emailRes = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages/outbound`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          type: 'Email',
          contactId: contactId,
          locationId: GHL_LOCATION_ID,
          fromName: 'Loan Mitigation Services',
          from: 'rh@shortsalestart.com',
          subject: 'Your Secure LMS Portal Link',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
              <img src="https://assets.cdn.filesafe.space/SmS67ZUDphr7uhGrsQGm/media/697b8a464d56837a5ab2bc1b.png" alt="Loan Mitigation Services" style="height: 48px; margin-bottom: 32px;"/>
              <h2 style="font-size: 22px; color: #1a2e3d; margin: 0 0 12px;">Your Secure Portal Link</h2>
              <p style="font-size: 15px; color: #4a6a85; line-height: 1.7; margin: 0 0 28px;">Click the button below to access your LMS file portal. This link expires in <strong>15 minutes</strong> and can only be used once.</p>
              <a href="${magicLink}" style="display: inline-block; background: #2d637d; color: white; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; padding: 14px 32px; border-radius: 8px; text-decoration: none; margin-bottom: 28px;">Access My Files →</a>
              <p style="font-size: 13px; color: #4a6a85; line-height: 1.6; margin: 0 0 8px;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #2d637d; word-break: break-all; margin: 0 0 28px;">${magicLink}</p>
              <div style="border-top: 1px solid #d1dde8; padding-top: 20px;">
                <p style="font-size: 12px; color: #888; margin: 0;">If you didn't request this link, you can safely ignore this email. Questions? Call us at (888) 460-4111.</p>
              </div>
            </div>
          `
        })
      }
    );

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('GHL email error:', err);
      return res.status(500).json({ error: 'Failed to send email', details: err });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Magic link error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
