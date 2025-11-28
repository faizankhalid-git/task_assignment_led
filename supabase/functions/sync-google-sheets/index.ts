import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function parseGoogleSheetDate(value: any): string {
  if (!value) return "";

  const str = value.toString().trim();

  if (str.startsWith("Date(")) {
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
    /(\d{1,2})\/((\d{1,2})\/((\d{4})\s+(\d{1,2}):(\d{2})/,
    /(\d{4})-(\d{2})-(\d{2})/,
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

  return "";
}

function parseGoogleVisualizationResponse(text: string) {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return null;
    }
    const jsonStr = text.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function fetchSheetData(
  spreadsheetId: string,
  worksheetName: string
): Promise<any[]> {
  try {
    const query = encodeURIComponent(
      `SELECT A, C, N, AO WHERE D is not null ORDER BY N`
    );
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/query?sheet=${encodeURIComponent(
      worksheetName
    )}&tqx=out:json&tq=${query}`;

    const response = await fetch(url);
    const text = await response.text();
    const data = parseGoogleVisualizationResponse(text);

    if (!data || !data.table || !data.table.cols) {
      console.log("Invalid response structure");
      return [];
    }

    const rows: any[] = data.table.rows.map((row: any) => ({
      sscc_numbers: row.c[0]?.v?.toString() || "",
      title: row.c[1]?.v?.toString() || "",
      start: parseGoogleSheetDate(row.c[2]?.v),
      car_reg_no: row.c[3]?.v?.toString() || "",
    }));

    return rows;
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["spreadsheet_id", "worksheet_name"]);

    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Google Sheets not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const settingsMap = Object.fromEntries(
      (settings as any[]).map((s) => [s.key, s.value])
    );
    const spreadsheetId = settingsMap.spreadsheet_id;
    const worksheetName = settingsMap.worksheet_name || "Live";

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Spreadsheet ID not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sheetRows = await fetchSheetData(spreadsheetId, worksheetName);

    let imported = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      const rowId = i + 2;

      const { data: existing } = await supabase
        .from("shipments")
        .select("id, status")
        .eq("row_id", rowId)
        .maybeSingle();

      if (existing && existing.status === "completed") {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("shipments").upsert(
        {
          row_id: rowId,
          sscc_numbers: row.sscc_numbers,
          title: row.title,
          start: row.start,
          car_reg_no: row.car_reg_no,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "row_id" }
      );

      if (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      } else {
        imported++;
      }
    }

    console.log(
      `Sheet sync: imported ${imported}, skipped ${skipped}, errors: ${errors.length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        errors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
