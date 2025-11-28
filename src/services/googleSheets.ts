type SheetRow = {
  sscc_numbers: string;
  title: string;
  start: string;
  car_reg_no: string;
};

function parseGoogleSheetDate(value: any): string {
  if (!value) return '';

  const str = value.toString().trim();

  if (str.startsWith('Date(')) {
    const dateMatch = str.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);
      const hour = parseInt(dateMatch[4]);
      const minute = parseInt(dateMatch[5]);
      const second = parseInt(dateMatch[6]);

      const date = new Date(year, month, day, hour, minute, second);
      return date.toISOString();
    }
  }

  const datePatterns = [
    /(\w+)\s+(\d+),\s+(\d+),\s+(\d+):(\d+):(\d+)/,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/,
    /(\d{4})-(\d{2})-(\d{2})/
  ];

  for (const pattern of datePatterns) {
    if (pattern.test(str)) {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return '';
}

function parseGoogleVisualizationResponse(text: string) {
  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('Invalid response format');
    }
    return JSON.parse(text.substring(jsonStart, jsonEnd));
  } catch {
    throw new Error('Failed to parse response');
  }
}

function findColumnIndex(cols: string[], targetName: string): number {
  const normalized = targetName.toLowerCase().trim().replace(/\s+/g, ' ');

  return cols.findIndex((col: string) => {
    const colLower = col.toLowerCase().trim().replace(/\s+/g, ' ');
    return colLower === normalized ||
           colLower.includes(normalized) ||
           normalized.includes(colLower);
  });
}

export async function testSheetConnection(
  spreadsheetId: string,
  worksheetName: string
): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  try {
    if (!spreadsheetId.trim()) {
      return { success: false, error: 'Spreadsheet ID is required' };
    }

    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(worksheetName || 'Sheet1')}&tqx=out:json`,
      { mode: 'cors' }
    );

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: Sheet not accessible` };
    }

    const text = await response.text();
    const data = parseGoogleVisualizationResponse(text);

    if (!data.table || !data.table.cols) {
      return { success: false, error: 'Invalid sheet structure' };
    }

    const cols = data.table.cols.map((col: any) => col.label || '');

    const requiredColumns = ['sscc_numbers', 'title', 'start', 'car reg no'];
    const foundIndexes = requiredColumns.map(name => findColumnIndex(cols, name));

    const missingColumns = requiredColumns.filter((name, idx) => foundIndexes[idx] === -1);

    if (missingColumns.length > 0) {
      return {
        success: false,
        error: `Missing required columns: ${missingColumns.join(', ')}. Found: ${cols.join(', ')}`
      };
    }

    const rowCount = data.table.rows?.length || 0;
    return { success: true, rowCount };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to parse sheet data' };
  }
}

export async function fetchSheetData(
  spreadsheetId: string,
  worksheetName: string
): Promise<{ success: boolean; data?: SheetRow[]; error?: string }> {
  try {
    if (!spreadsheetId.trim()) {
      return { success: false, error: 'Spreadsheet ID is required' };
    }

    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(worksheetName || 'Sheet1')}&tqx=out:json`,
      { mode: 'cors' }
    );

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: Sheet not accessible` };
    }

    const text = await response.text();
    const data = parseGoogleVisualizationResponse(text);

    if (!data.table) {
      return { success: false, error: 'Invalid sheet structure' };
    }

    const cols = data.table.cols.map((col: any) => col.label || '');

    const ssccIndex = findColumnIndex(cols, 'sscc_numbers');
    const titleIndex = findColumnIndex(cols, 'title');
    const startIndex = findColumnIndex(cols, 'start');
    const carRegIndex = findColumnIndex(cols, 'car reg no');

    if (ssccIndex === -1 || titleIndex === -1 || startIndex === -1 || carRegIndex === -1) {
      return {
        success: false,
        error: `Could not find all required columns. Found: ${cols.join(', ')}`
      };
    }

    if (!data.table.rows || data.table.rows.length === 0) {
      return { success: true, data: [] };
    }

    const rows: SheetRow[] = data.table.rows.map((row: any) => ({
      sscc_numbers: row.c[ssccIndex]?.v?.toString() || '',
      title: row.c[titleIndex]?.v?.toString() || '',
      start: parseGoogleSheetDate(row.c[startIndex]?.v),
      car_reg_no: row.c[carRegIndex]?.v?.toString() || ''
    }));

    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to parse sheet data' };
  }
}
