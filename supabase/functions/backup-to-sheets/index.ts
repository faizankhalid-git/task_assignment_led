import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
          error: "Google Sheets not configured in Settings",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const settingsMap = Object.fromEntries(
      (settings as any[]).map((s) => [s.key, s.value])
    );
    const spreadsheetId = settingsMap.spreadsheet_id;

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Spreadsheet ID not configured",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: shipments, error: shipmentsError } = await supabase
      .from("shipments")
      .select("*")
      .eq("archived", false)
      .order("start", { ascending: false });

    if (shipmentsError) throw shipmentsError;

    if (!shipments || shipments.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No shipments to backup",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const headers = [
      "SSCC Numbers",
      "Title",
      "Arrival Time",
      "Car Reg No",
      "Storage Location",
      "Assigned Operators",
      "Notes",
      "Status",
      "Updated At",
    ];

    const rows = shipments.map((s: any) => [
      s.sscc_numbers || "",
      s.title || "",
      s.start ? new Date(s.start).toLocaleString("en-GB") : "",
      s.car_reg_no || "",
      s.storage_location || "",
      (s.assigned_operators || []).join(", "),
      s.notes || "",
      s.status || "",
      new Date(s.updated_at).toLocaleString("en-GB"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) =>
            `"${cell.toString().replace(/"/g, '""')}"`
          )
          .join(",")
      ),
    ].join("\n");

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backup prepared with ${shipments.length} deliveries`,
        instructions: [
          `1. Open: https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
          `2. Create/Select 'Backup' worksheet`,
          `3. File > Import > Upload the downloaded CSV`,
          `4. Choose 'Replace data at selected cell' and import`,
        ],
        csv: csvContent,
        count: shipments.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Backup error:", error);
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
