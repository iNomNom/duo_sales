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

// Build a row array from a sale object (matches the sheet column order)
function saleToRow(sale) {
  return [
    sale.id, sale.date, sale.agent_name, sale.carrier_name, sale.email,
    sale.lane_details, sale.amount, sale.purpose, sale.lane_start_date,
    sale.truck, sale.phone_number, sale.company_name, sale.address,
    sale.acc_type, sale.status, sale.closed_by, sale.notes, sale.created_at
  ];
}

async function appendRow(sale) {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheets || !spreadsheetId) return false;

    const values = [saleToRow(sale)];

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

async function updateRow(sale) {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheets || !spreadsheetId) return false;

    // Find the row with matching sale ID in column A
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sales!A:A',
    });

    const rows = getResponse.data.values || [];
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(sale.id)) {
        rowIndex = i + 1; // Sheets are 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      // Row not found — fall back to appending instead
      console.log(`Sale #${sale.id} not found in sheet, appending as new row`);
      return appendRow(sale);
    }

    // Update the found row
    const values = [saleToRow(sale)];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sales!A${rowIndex}:R${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    return true;
  } catch (err) {
    console.error('Google Sheets update failed:', err.message);
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
    const rows = sales.map(s => [saleToRow(s)]).flat();

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

module.exports = { appendRow, updateRow, bulkSync };
