import crypto from 'crypto';

const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';
const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const MAGIC_LINK_WORKFLOW_ID = '0b6fb4a2-613a-4f9b-a815-de9af9b32b9f';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, contactId } = req.body;

  if (!email && !contactId) {
    return res.status(400).json({ error: 'Email or contact ID required' });
  }

  try {
    // Step 1: Get contact — by ID directly or search by email
    let resolvedContactId = contactId || null;

    if (!resolvedContactId) {
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
      resolvedContactId = contacts[0].id;
    }

    // Step 2: Generate secure token + expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 15 * 60 * 1000;

    // Step 3: Build the magic link
    const baseUrl = 'https://documents.shortsalestart.com';
    const magicLink = `${baseUrl}/dashboard?token=${token}&contact=${resolvedContactId}`;

    // Step 4: Store token, expiry, and magic link URL on contact
    const updateRes = await fetch(`${GHL_API_BASE}/contacts/${resolvedContactId}`, {
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
        ]
      })
    });

    if (!updateRes.ok) {
      const updateData = await updateRes.json();
      console.error('GHL update error:', JSON.stringify(updateData));
      return res.status(500).json({ error: 'Failed to store login token.', detail: updateData });
    }

    // Step 5: Enroll contact directly into magic link workflow
    const workflowRes = await fetch(`${GHL_API_BASE}/contacts/${resolvedContactId}/workflow/${MAGIC_LINK_WORKFLOW_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!workflowRes.ok) {
      const workflowData = await workflowRes.json();
      console.error('GHL workflow error:', JSON.stringify(workflowData));
      return res.status(500).json({ error: 'Failed to trigger login email.', detail: workflowData });
    }

    console.log('Workflow enrolled successfully for contact:', resolvedContactId);

    return res.status(200).json({
      success: true,
      message: 'If that email is on file, a login link has been sent.'
    });

  } catch (err) {
    console.error('send-magic-link error:', err);
    return res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
}
