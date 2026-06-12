const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

// All field IDs confirmed from live opp debug response
const FIELD_IDS = {
  // Header
  propertyAddress:      'bTOQKVASljm1KC3ri7uH',
  county:               'yAAomstPf9mwehTfeuOu',
  fileStartDate:        '7jBDrzimFPUtoW0i1VMW',
  sellerPortalLink:     'V8600Pm9e3h22WQqwAtZ',

  // Section 1 — Seller Intake (checkboxes — return as array)
  saSignedField:        'niQheTBXreIINzFVcJuE',
  sifSubmitted:         'dEjpisP9oE4vEJGN6pAb',
  thirdPartyReceived:   'zz7h15qZtuFQaa0ORxXb',
  mortgageReceived:     'QhhsOFjxPwR3OaSwMf92',

  // Section 2 — Seller Info
  sellerName:           'WS9RCpsfxqm2CVDdZ9II',
  sellerPhone:          'io5PDjqTjnWZR1yNbaV6',
  sellerEmail:          'hTRjaMlGHBQD6WT0SGu0',
  sellerMailingAddress: 'n2HPFRoNmgbD3hkVJ5Ph',
  coBorrowerName:       null,
  coBorrowerPhone:      null,
  coBorrowerEmail:      null,

  // Section 3 — Creditors
  lender1Name:          'lhmdlGuwy70Ken1Kykqw',
  lender1Balance:       'pUDqC9WupJL1tSUG5pa6',
  lender2Name:          null,
  lender2Balance:       null,
  hoaYesNo:             '3kbuhQfQ33N5WycHESvi',
  hoa1Name:             'tjWMdALYZQk4rL2TRnDN',
  hoa1Balance:          'VrB2e426VGJ54Mzovxj6',
  hoa2Name:             null,
  hoa2Balance:          null,
  hoa3Name:             null,
  hoa3Balance:          null,

  // Section 4 — Listing Agent
  laName:               'jlHmRaAYG7VTFubGwaZH',
  laBrokerage:          'QHAaE53pmuq0Gvrhm969',
  laPhone:              '0byvyfgrnqdxD0cYMFZn',
  laEmail:              'v5DAv0lvEkltWdJaXL83',

  // Section 5 — Buyer Agent 1
  ba1Name:              null,
  ba1Brokerage:         'AlzCMYGaCpxhbMiwHKUD',
  ba1Phone:             'pa5yWsq8BoZ6e43uqXyE',
  ba1Email:             'GsalqwA6Fer5SetS65xW',
  buyer1Name:           null,
  buyer1Contact:        null,
  buyer1Phone:          null,
  buyer1Email:          null,
  buyer1Financing:      'F9GaZqk6ShdyWgSEGlzC',

  // Section 5 — Buyer Agent 2
  ba2Name:              null,
  ba2Brokerage:         null,
  ba2Phone:             null,
  ba2Email:             null,
  buyer2Name:           null,
  buyer2Contact:        null,
  buyer2Phone:          null,
  buyer2Email:          null,

  // Section 6 — BPO
  bpo1Date:             '8RDEH9loJ5GWT2R335w3',
  bpo1Amount:           null,
  bpo2Date:             null,
  bpo2Amount:           null,

  // Section 7 — Closing Info
  titleCompany:         null,
  titleAgent:           null,
  titlePhone:           null,
  titleEmail:           null,
  closeDate:            '7jBDrzimFPUtoW0i1VMW',
  deficiencyWaived:     null,
  relocationAwarded:    null,
  relocationAmount:     null,
};

function getById(fields, id) {
  if (!id) return null;
  const f = fields.find(f => f.id === id);
  if (!f) return null;
  const val = f.value ?? f.fieldValue ?? f.fieldValueArray ?? null;
  if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
  return val || null;
}

function isChecked(fields, id) {
  if (!id) return false;
  const f = fields.find(f => f.id === id);
  if (!f) return false;
  const val = f.value ?? f.fieldValue ?? f.fieldValueArray ?? null;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'string') {
    const v = val.toLowerCase();
    return v === 'yes' || v === 'true' || v === '1';
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id: oppId } = req.query;
  if (!oppId) return res.status(400).json({ error: 'Opportunity ID required' });

  try {
    const oppRes = await fetch(`${GHL_API_BASE}/opportunities/${oppId}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      }
    });

    if (!oppRes.ok) return res.status(404).json({ error: 'File not found' });

    const oppData = await oppRes.json();
    const opp = oppData.opportunity || oppData;
    const fields = opp.customFields || [];

    const createdAt = opp.createdAt ? new Date(opp.createdAt) : null;
    const daysActive = createdAt
      ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const data = {
      oppName:    opp.name || '',
      stageName:  opp.pipelineStageId || null,
      daysActive,

      propertyAddress:      getById(fields, FIELD_IDS.propertyAddress),
      county:               getById(fields, FIELD_IDS.county),
      fileStartDate:        getById(fields, FIELD_IDS.fileStartDate),
      sellerPortalLink:     getById(fields, FIELD_IDS.sellerPortalLink),

      saSignedField:        isChecked(fields, FIELD_IDS.saSignedField),
      sifSubmitted:         isChecked(fields, FIELD_IDS.sifSubmitted),
      thirdPartyReceived:   isChecked(fields, FIELD_IDS.thirdPartyReceived),
      mortgageReceived:     isChecked(fields, FIELD_IDS.mortgageReceived),

      sellerName:           getById(fields, FIELD_IDS.sellerName),
      sellerPhone:          getById(fields, FIELD_IDS.sellerPhone),
      sellerEmail:          getById(fields, FIELD_IDS.sellerEmail),
      sellerMailingAddress: getById(fields, FIELD_IDS.sellerMailingAddress),
      coBorrowerName:       getById(fields, FIELD_IDS.coBorrowerName),
      coBorrowerPhone:      getById(fields, FIELD_IDS.coBorrowerPhone),
      coBorrowerEmail:      getById(fields, FIELD_IDS.coBorrowerEmail),

      lender1Name:          getById(fields, FIELD_IDS.lender1Name),
      lender1Balance:       getById(fields, FIELD_IDS.lender1Balance),
      lender2Name:          getById(fields, FIELD_IDS.lender2Name),
      lender2Balance:       getById(fields, FIELD_IDS.lender2Balance),
      hoaYesNo:             getById(fields, FIELD_IDS.hoaYesNo),
      hoa1Name:             getById(fields, FIELD_IDS.hoa1Name),
      hoa1Balance:          getById(fields, FIELD_IDS.hoa1Balance),
      hoa2Name:             getById(fields, FIELD_IDS.hoa2Name),
      hoa2Balance:          getById(fields, FIELD_IDS.hoa2Balance),
      hoa3Name:             getById(fields, FIELD_IDS.hoa3Name),
      hoa3Balance:          getById(fields, FIELD_IDS.hoa3Balance),

      laName:               getById(fields, FIELD_IDS.laName),
      laBrokerage:          getById(fields, FIELD_IDS.laBrokerage),
      laPhone:              getById(fields, FIELD_IDS.laPhone),
      laEmail:              getById(fields, FIELD_IDS.laEmail),

      ba1Name:              getById(fields, FIELD_IDS.ba1Name),
      ba1Brokerage:         getById(fields, FIELD_IDS.ba1Brokerage),
      ba1Phone:             getById(fields, FIELD_IDS.ba1Phone),
      ba1Email:             getById(fields, FIELD_IDS.ba1Email),
      buyer1Name:           getById(fields, FIELD_IDS.buyer1Name),
      buyer1Contact:        getById(fields, FIELD_IDS.buyer1Contact),
      buyer1Phone:          getById(fields, FIELD_IDS.buyer1Phone),
      buyer1Email:          getById(fields, FIELD_IDS.buyer1Email),
      buyer1Financing:      getById(fields, FIELD_IDS.buyer1Financing),

      ba2Name:              getById(fields, FIELD_IDS.ba2Name),
      ba2Brokerage:         getById(fields, FIELD_IDS.ba2Brokerage),
      ba2Phone:             getById(fields, FIELD_IDS.ba2Phone),
      ba2Email:             getById(fields, FIELD_IDS.ba2Email),
      buyer2Name:           getById(fields, FIELD_IDS.buyer2Name),
      buyer2Contact:        getById(fields, FIELD_IDS.buyer2Contact),
      buyer2Phone:          getById(fields, FIELD_IDS.buyer2Phone),
      buyer2Email:          getById(fields, FIELD_IDS.buyer2Email),

      bpo1Date:             getById(fields, FIELD_IDS.bpo1Date),
      bpo1Amount:           getById(fields, FIELD_IDS.bpo1Amount),
      bpo2Date:             getById(fields, FIELD_IDS.bpo2Date),
      bpo2Amount:           getById(fields, FIELD_IDS.bpo2Amount),

      titleCompany:         getById(fields, FIELD_IDS.titleCompany),
      titleAgent:           getById(fields, FIELD_IDS.titleAgent),
      titlePhone:           getById(fields, FIELD_IDS.titlePhone),
      titleEmail:           getById(fields, FIELD_IDS.titleEmail),
      closeDate:            getById(fields, FIELD_IDS.closeDate),
      deficiencyWaived:     getById(fields, FIELD_IDS.deficiencyWaived),
      relocationAwarded:    getById(fields, FIELD_IDS.relocationAwarded),
      relocationAmount:     getById(fields, FIELD_IDS.relocationAmount),
    };

    return res.status(200).json({ success: true, data });

  } catch (err) {
    console.error('File detail error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
