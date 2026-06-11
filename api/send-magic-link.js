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

    // Step 3: Build the magic link
    const baseUrl = 'https://documents.shortsalestart.com';
    const magicLink = `${baseUrl}/dashboard?token=${token}&contact=${contactId}`;

    // Step 4: Store token, expiry, full URL — then fire workflow via tag
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
          { key: 'portal_login_expiry', field_value: String(expires) },
          { key: 'magic_link_url', field_value: magicLink }
        ],
        tags: ['send_magic_link']
      })
    });

    if (!updateRes.ok) {
      const updateData = await updateRes.json();
      console.error('GHL update error:', JSON.stringify(updateData));
      return res.status(500).json({ error: 'Failed to trigger login email.', detail: updateData });
    }

    return res.status(200).json({
      success: true,
      message: 'If that email is on file, a login link has been sent.'
    });

  } catch (err) {
    console.error('send-magic-link error:', err);
    return res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
}
