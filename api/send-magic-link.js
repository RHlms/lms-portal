import crypto from 'crypto';

const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';
const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    // Step 1: Search for contact by email
    const searchRes = await fetch(`${GHL_API_BASE}/contacts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        filters: [{ field: 'email', operator: 'eq', value: email }],
        pageLimit: 5
      })
    });

    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      console.error('GHL search error:', searchData);
      return res.status(400).json({ error: 'Could not verify email address.', detail: searchData });
    }

    const contacts = searchData.contacts || [];

    if (contacts.length === 0) {
      return res.status(200).json({ success: true, message: 'If that email is on file, a login link has been sent.' });
    }

    const contact = contacts[0];
    const contactId = contact.id;

    // Step 2: Generate secure token + expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes from now

    // Step 3: Store token and expiry as separate fields on the GHL contact
    const updateRes = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customFields: [
          { key: 'magic_link_token', field_value: token },
          { key: 'portal_login_expiry', field_value: String(expires) }
        ]
      })
    });

    if (!updateRes.ok) {
      const updateData = await updateRes.json();
      console.error('GHL update error:', updateData);
      return res.status(500).json({ error: 'Failed to store login token.' });
    }

    // Step 4: Build the magic link
    const baseUrl = 'https://documents.shortsalestart.com';
    const magicLink = `${baseUrl}/dashboard?token=${token}&contact=${contactId}`;

    // Step 5: Send magic link via GHL outbound email
    const emailRes = await fetch(`${GHL_API_BASE}/conversations/messages/outbound`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'Email',
        contactId: contactId,
        locationId: GHL_LOCATION_ID,
        fromName: 'ShortSaleStart',
        fromEmail: 'noreply@shortsalestart.com',
        subject: 'Your LMS Portal Login Link',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 20px; font-weight: 700; color: #0d2033; letter-spacing: 0.5px;">
                SHORT<span style="color: #00A8C6;">SALE</span>START
              </span>
            </div>
            <h2 style="color: #0d2033; margin: 0 0 16px; font-size: 22px;">Your Secure Login Link</h2>
            <p style="color: #444; margin: 0 0 24px; line-height: 1.6;">
              Click the button below to access your LMS client portal.
              This link expires in <strong>15 minutes</strong>.
            </p>
            <a href="${magicLink}"
               style="display: inline-block; background: #cc5500; color: #ffffff;
                      text-decoration: none; padding: 14px 32px; border-radius: 6px;
                      font-weight: bold; font-size: 16px; letter-spacing: 0.3px;">
              Open My Portal →
            </a>
            <p style="color: #888; font-size: 13px; margin: 32px 0 0; line-height: 1.6; border-top: 1px solid #eee; padding-top: 24px;">
              If you didn't request this link, you can safely ignore this email.<br>
              Loan Mitigation Services LLC &nbsp;·&nbsp; shortsalestart.com
            </p>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      const emailData = await emailRes.json();
      console.error('GHL email error:', emailData);
      return res.status(500).json({ error: 'Failed to send login email.' });
    }

    return res.status(200).json({
      success: true,
      message: 'If that email is on file, a login link has been sent.'
    });

  } catch (err) {
    console.error('send-magic-link error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
