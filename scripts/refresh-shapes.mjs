/**
 * refresh-shapes.mjs
 *
 * Rebuilds src/mock/route_shapes.json from the latest TTC GTFS shapes.txt.
 * Downloads the GTFS ZIP, extracts shapes.txt, and produces a clean JSON file
 * where each route has ONE de-zigzagged path (one direction only).
 *
 * Usage:
 *   node scripts/refresh-shapes.mjs
 *
 * Output: src/mock/route_shapes.json (committed to git for bundling)
 */

import https from "node:https";
import { createWriteStream, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const OUT_PATH  = join(ROOT, "src", "mock", "route_shapes.json");

const GTFS_URL =
  "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/7795b45e-e65a-4465-81fc-c36b9dfff169/resource/cfb6b2b8-6191-41e3-bda1-b175c51148cb/download/opendata_ttc_schedules.zip";

const TMP = join(tmpdir(), "ttc-gtfs");
const ZIP = join(TMP, "gtfs.zip");

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

async function download(url, dest) {
  log(`Downloading GTFS from Toronto Open Data…`);
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
  log(`Downloaded (${Math.round(require("node:fs").statSync(dest).size / 1024 / 1024 * 10)/10} MB)`);
}

/** Remove zigzag artifacts by only keeping points that advance monotonically */
function deZigzag(path, maxDeg = 0.025) {
  if (path.length < 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = out[out.length - 1];
    if (Math.abs(path[i][0] - prev[0]) <= maxDeg && Math.abs(path[i][1] - prev[1]) <= maxDeg) {
      out.push(path[i]);
    }
  }
  return out.length >= 2 ? out : path.slice(0, 2);
}

async function main() {
  log("=== Rebuild route_shapes.json from latest TTC GTFS ===");

  mkdirSync(TMP, { recursive: true });

  // Download GTFS if not already present (skip if fresh)
  try {
    const age = Date.now() - statSync(ZIP).mtimeMs;
    if (age < 3600_000) { log("Using cached GTFS (< 1h old)"); }
    else throw new Error("stale");
  } catch {
    await download(GTFS_URL, ZIP);
  }

  // Parse trips.txt → route_id to shape_id mapping (take first shape per route)
  log("Parsing trips.txt to get shape_id per route…");
  const tripsRaw = execSync(`unzip -p "${ZIP}" trips.txt`, { maxBuffer: 100 * 1024 * 1024 }).toString();
  const tripLines = tripsRaw.split("\n").filter(Boolean);
  const tripHeaders = tripLines[0].split(",").map(h => h.trim().replace(/\r/g,""));
  const ridx = tripHeaders.indexOf("route_id");
  const sidx = tripHeaders.indexOf("shape_id");

  const routeShape = new Map(); // route_id → shape_id (first found)
  for (const line of tripLines.slice(1)) {
    const cols = line.split(",").map(v => v.trim().replace(/\r/g,""));
    const rId  = cols[ridx];
    const sId  = cols[sidx];
    if (rId && sId && !routeShape.has(rId)) routeShape.set(rId, sId);
  }
  log(`  ${routeShape.size} routes with shape_id`);

  // Parse shapes.txt → shape_id to ordered [lat, lon][] mapping
  log("Parsing shapes.txt (large file)…");
  const shapesRaw = execSync(`unzip -p "${ZIP}" shapes.txt`, { maxBuffer: 200 * 1024 * 1024 }).toString();
  const shapeLines = shapesRaw.split("\n").filter(Boolean);
  const shapeHeaders = shapeLines[0].split(",").map(h => h.trim().replace(/\r/g,""));
  const shIdIdx  = shapeHeaders.indexOf("shape_id");
  const latIdx   = shapeHeaders.indexOf("shape_pt_lat");
  const lonIdx   = shapeHeaders.indexOf("shape_pt_lon");
  const seqIdx   = shapeHeaders.indexOf("shape_pt_sequence");

  const shapePts = new Map(); // shape_id → {seq, lat, lon}[]
  for (const line of shapeLines.slice(1)) {
    const cols = line.split(",");
    const shId = cols[shIdIdx]?.trim();
    const lat  = parseFloat(cols[latIdx]);
    const lon  = parseFloat(cols[lonIdx]);
    const seq  = parseInt(cols[seqIdx] ?? "0");
    if (!shId || isNaN(lat) || isNaN(lon)) continue;
    if (!shapePts.has(shId)) shapePts.set(shId, []);
    shapePts.get(shId).push({ seq, lat, lon });
  }

  // Sort each shape by sequence
  for (const [, pts] of shapePts) pts.sort((a, b) => a.seq - b.seq);
  log(`  ${shapePts.size} shape_ids loaded`);

  // Build result: one path per route_id
  const result = [];
  for (const [routeId, shapeId] of routeShape) {
    const pts = shapePts.get(shapeId);
    if (!pts?.length) continue;
    const rawPath = pts.map(p => [p.lat, p.lon]);
    // Apply de-zigzag to remove interleaved direction artifacts
    const path = deZigzag(rawPath);
    if (path.length < 2) continue;
    result.push({ route_id: routeId, path });
  }

  result.sort((a, b) => a.route_id.localeCompare(b.route_id, undefined, { numeric: true }));
  log(`Built ${result.length} route shapes`);

  writeFileSync(OUT_PATH, JSON.stringify(result));
  const kb = Math.round(statSync(OUT_PATH).size / 1024);
  log(`✓ Written to src/mock/route_shapes.json (${kb} KB)`);
  log(`Run 'node scripts/refresh-gtfs.mjs' to update Supabase routes/stops tables.`);
}

main().catch(e => { console.error(e); process.exit(1); });
