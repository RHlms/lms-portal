const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';

const STAGE_MAP = {
  '1 - START':                        'Seller Intake',
  '2 - SELLER INTAKE - PORTAL':       'Seller Intake',
  '3 - SELLER INTAKE — CHASE':        'Seller Intake',
  '4 - SELLER INTAKE — FILE REVIEW':  'Seller Intake',
  '🔴 RESET STAGE🔴':                 'On Hold',
  '5 - 3PA ⚠️':                       'Third-Party Authorization',
  '6 - 3PA ✅ (50)':                  'Third-Party Authorization',
  '7 - NO BUYER ⚠️':                  'Buyer Needed',
  '8 - BUYER ✅ - OIF ⚠️':            'Offer Intake',
  '9 - OIF ✅':                       'Offer Intake',
  'CLOSED-W':                         'Closed — Won',
  'CLOSED-L':                         'Closed — Lost',
};

async function resolveStageName(stageId) {
  if (!stageId) return 'In Progress';
  try {
    const res = await fetch(
      `${GHL_API_BASE}/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!res.ok) return 'In Progress';
    const data = await res.json();
    for (const pipeline of (data.pipelines || [])) {
      for (const stage of (pipeline.stages || [])) {
        if (stage.id === stageId) {
          return STAGE_MAP[stage.name] || stage.name || 'In Progress';
        }
      }
    }
  } catch (e) {
    console.error('Stage resolve error:', e.message);
  }
  return 'In Progress';
}

const FIELD_IDS = {
  propertyAddress:      'Atcucc8y9Hf9ArNApUZk',
  county:               'yAAomstPf9mwehTfeuOu',
  fileStartDate:        '7jBDrzimFPUtoW0i1VWW',
  sellerPortalLink:     'V86O0Pm9e3h22WOqwAtZ',
  saSignedField:        'zz7h15qZtuFQaaO0RxXb',
  sifSubmitted:         'niQheTBXre1INzFVcJuE',
  thirdPartyReceived:   'QhhsOFjxPwR3OaSwMf9z',
  mortgageReceived:     'dEjpisP9oE4vEJ6N6pAb',
  sellerName:           'WSR9Cpsfxqm2CVDdZ9lI',
  sellerPhone:          '0byvyfgrnqdxDOcYMF2n',
  sellerEmail:          'hTRjaMlGHBQD6WTOSGu0',
  sellerMailingAddress: 'n2HPFRoNmgbD3hkVJ5Ph',
  coBorrowerName:       'lsBEl4AhOR08zO8l0Zy8',
  coBorrowerPhone:      'j5VJkYW3uMevhWnLgd7r',
  coBorrowerEmail:      'dEhUs64tRyCtxyGJLUFw',
  lender1Name:          'lhmdlGuwy70Ken1Kykqw',
  lender1Balance:       'pUDqC9WupJL1t5UG5pa6',
  lender2Name:          'DNzdneHpFqHyb2XIWCXA',
  lender2Balance:       'RJ9mLupSLrT0X1OVZrkn',
  hoaYesNo:             'xJDIoqrAb2GeSH5NS4a3',
  hoa1Name:             'tjMWdALYzQk4rL2TRnDh',
  hoa1Balance:          'NXCVQKG3bvqCFEzSOGWt',
  hoa2Name:             '8VJ2CYyR91JM4xotwSwY',
  hoa2Balance:          'owy3mu8I37KYBf2KgLmB',
  hoa3Name:             '9UcGhLnhW3u3ewpbxUhV',
  hoa3Balance:          'KrrZJ32NpPMeJCkTVyLy',
  laName:               'jlHmRaAYG7VTFuBgWa2H',
  laBrokerage:          'AlzCMYGaCpxHbMiwhKUD',
  laPhone:              'ioS9DjqTjnWZR1yNbaV6',
  laEmail:              'v5DAv0lvEkltWdJaXL83',
  ba1Name:              'onOszXR3tEcwDkS9O8CL',
  ba1Brokerage:         'cCEriXPIe4UyqMNsgsb9',
  ba1Phone:             'owYOQ1Vvf1h9utEVbzN2',
  ba1Email:             'wZU9BGbuV6j9gTOU7Hhy',
  buyer1Name:           'DolRINj2IZIibipmWnSu',
  buyer1Contact:        'VqmpRbTlmBBnpzypiUZS',
  buyer1Financing:      'F9GaZqk6ShdyWgSEG1zC',
  ba2Name:              'hjWX6pmjRuo16NnZaMAt',
  ba2Brokerage:         '0Miv48c7NvosYsygg757',
  ba2Phone:             'NTWs3Lb4VBExoETBtVws',
  ba2Email:             'n5gfn3ut3FoaIQCPzzz2',
  buyer2Name:           'nphcEWGHjhcc5Zsy8r1B',
  buyer2Contact:        'eeEEKD6huxHJ7r7OGo8d',
  buyer2Financing:      'OCwADXhV6rphC7GGkoye',
  bpo1Date:             '8RDEH9loJ5GWT2R335w3',
  bpo1Amount:           'VrB2e426VGJS4Mzovxj6',
  bpo2Date:             'A765x4pRUuPUKKWbCU3K',
  bpo2Amount:           '0ZweMSpZLvGS5LLhA5L6',
  titleCompany:         'gGhn9hBkPCiXsBOLWTLS',
  titleAgent:           'Kr35FZgNGOpSnkykgCQ3',
  titlePhone:           'cQ2mfa2LWYuMKSoJMZQw',
  titleEmail:           'DPaLfzSOe05yJh9Qeb8y',
  closeDate:            '3pk2bHcWv7AO4XT2YUU2',
  deficiencyWaived:     '1Zbf06l5a2vdQivm9IB4',
  relocationAwarded:    'ynTbYfKcaK4ToF3DtiJO',
  relocationAmount:     'HUw5n1KhOcUbWWGy1JUF',
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
  if (typeof val === 'string') return ['yes','true','1'].includes(val.toLowerCase());
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

    const stageName = await resolveStageName(opp.pipelineStageId);

    const data = {
      oppName:              opp.name || '',
      stageName,
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
      buyer1Financing:      getById(fields, FIELD_IDS.buyer1Financing),
      ba2Name:              getById(fields, FIELD_IDS.ba2Name),
      ba2Brokerage:         getById(fields, FIELD_IDS.ba2Brokerage),
      ba2Phone:             getById(fields, FIELD_IDS.ba2Phone),
      ba2Email:             getById(fields, FIELD_IDS.ba2Email),
      buyer2Name:           getById(fields, FIELD_IDS.buyer2Name),
      buyer2Contact:        getById(fields, FIELD_IDS.buyer2Contact),
      buyer2Financing:      getById(fields, FIELD_IDS.buyer2Financing),
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
