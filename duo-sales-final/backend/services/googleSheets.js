const { google } = require('googleapis');

async function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function appendRow(sale) {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheets || !spreadsheetId) return false;

    const values = [[
      sale.id, sale.date, sale.agent_name, sale.carrier_name, sale.email,
      sale.lane_details, sale.amount, sale.purpose, sale.lane_start_date,
      sale.truck, sale.phone_number, sale.company_name, sale.address,
      sale.acc_type, sale.status, sale.closed_by, sale.notes, sale.created_at
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sales!A:R',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return true;
  } catch (err) {
    console.error('Google Sheets append failed:', err.message);
    return false;
  }
}

async function bulkSync(sales) {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheets || !spreadsheetId) return { success: false, error: 'Google Sheets not configured' };

    // Clear existing data and write headers + all rows
    const headers = [['ID','Date','Agent','Carrier','Email','Lane','Amount','Purpose','Lane Start','Truck','Phone','Company','Address','Acc Type','Status','Closed By','Notes','Created At']];
    const rows = sales.map(s => [[
      s.id, s.date, s.agent_name, s.carrier_name, s.email,
      s.lane_details, s.amount, s.purpose, s.lane_start_date,
      s.truck, s.phone_number, s.company_name, s.address,
      s.acc_type, s.status, s.closed_by, s.notes, s.created_at
    ]]).flat();

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Sales!A:R',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sales!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [...headers, ...rows] },
    });

    return { success: true, count: sales.length };
  } catch (err) {
    console.error('Google Sheets sync failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { appendRow, bulkSync };
