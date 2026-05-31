/**
 * refresh-gtfs.mjs
 *
 * Downloads the latest TTC GTFS feed from Toronto Open Data (May 2026),
 * parses routes.txt and stops.txt, and upserts into Supabase.
 *
 * Usage:
 *   node scripts/refresh-gtfs.mjs
 *
 * Requires Node.js ≥ 18 (built-in fetch + Web Streams).
 * Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from environment
 * (falls back to the anon key for read-only Supabase projects).
 */

import https from "node:https";
import { createWriteStream, readFileSync, existsSync, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "https://pqbxjzbdjxtttnnmmhaj.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYnhqemJkanh0dHRubm1taGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTA3NTMsImV4cCI6MjA5NDc4Njc1M30.z2WsmaaltJ-IJZhomQhhI6Wma49z9cEjOWWu4iW5IhE";

const GTFS_URL =
  "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/7795b45e-e65a-4465-81fc-c36b9dfff169/resource/cfb6b2b8-6191-41e3-bda1-b175c51148cb/download/opendata_ttc_schedules.zip";

const TMP = join(tmpdir(), "ttc-gtfs");
const ZIP = join(TMP, "gtfs.zip");

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

async function download(url, dest) {
  log(`Downloading ${url}`);
  await new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "TransitLens/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
  log(`Downloaded to ${dest}`);
}

/** Parse a GTFS CSV file from the ZIP (uses unzip command-line tool) */
function extractAndParse(zipPath, filename) {
  try {
    const raw = execSync(`unzip -p "${zipPath}" "${filename}"`, { maxBuffer: 50 * 1024 * 1024 }).toString();
    const lines = raw.split("\n").filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(",").map(h => h.trim().replace(/\r/g,""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/\r/g,"").replace(/^"|"$/g,""));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    }).filter(r => Object.values(r).some(v => v));
  } catch (e) {
    log(`Warning: could not extract ${filename}: ${e.message}`);
    return [];
  }
}

/** Upsert rows into a Supabase table in batches */
async function upsert(table, rows, conflictColumn = "id") {
  const BATCH = 100; // small batches to avoid connection timeouts
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": `resolution=merge-duplicates,return=minimal`,
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text();
      log(`  Batch ${i}-${i+BATCH} error: ${res.status} ${err.slice(0,200)}`);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log("=== TTC GTFS Refresh ===");
  log(`Supabase: ${SUPABASE_URL}`);

  mkdirSync(TMP, { recursive: true });

  // 1. Download
  await download(GTFS_URL, ZIP);

  // 2. Parse routes.txt → tl_routes
  log("Parsing routes.txt…");
  const rawRoutes = extractAndParse(ZIP, "routes.txt");
  log(`  ${rawRoutes.length} routes found`);

  const routes = rawRoutes.map(r => ({
    route_id:         r.route_id,
    route_short_name: r.route_short_name,
    route_long_name:  r.route_long_name,
    route_type:       parseInt(r.route_type || "3"),
    route_color:      r.route_color || null,
  })).filter(r => r.route_id);

  log(`  Upserting ${routes.length} routes into tl_routes…`);
  const rInserted = await upsert("tl_routes", routes, "route_id");
  log(`  ✓ ${rInserted} routes upserted`);

  // 3. Parse stops.txt → tl_stops
  log("Parsing stops.txt…");
  const rawStops = extractAndParse(ZIP, "stops.txt");
  log(`  ${rawStops.length} stops found`);

  const stops = rawStops.map(s => ({
    stop_id:   s.stop_id,
    stop_name: s.stop_name,
    stop_lat:  parseFloat(s.stop_lat),
    stop_lon:  parseFloat(s.stop_lon),
  })).filter(s => s.stop_id && !isNaN(s.stop_lat) && !isNaN(s.stop_lon)
    && s.stop_lat > 43.5 && s.stop_lat < 44.0   // Toronto bounds check
    && s.stop_lon > -79.7 && s.stop_lon < -79.1
  );

  log(`  Upserting ${stops.length} valid stops into tl_stops…`);
  const sInserted = await upsert("tl_stops", stops, "stop_id");
  log(`  ✓ ${sInserted} stops upserted`);

  // 4. Report
  log("=== Done ===");
  log(`Routes: ${rInserted} | Stops: ${sInserted}`);
  log("Run 'node scripts/refresh-shapes.mjs' next to rebuild route_shapes.json");
}

main().catch(e => { console.error(e); process.exit(1); });
