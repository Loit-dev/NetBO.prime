const fs = require("fs");
const path = require("path");

const { getNetflixES } = require("./watchmode");
const { enrichItem } = require("./tmdb");

/* ---------------- STATUS ---------------- */
function classify(item) {
  const year = item.year;
  if (!year) return "normal";

  const now = new Date().getFullYear();

  if (year === now) return "recent";
  if (year > now) return "upcoming";
  return "normal";
}

/* ---------------- DEDUPE ---------------- */
function dedupe(arr) {
  const map = new Map();
  arr.forEach((i) => map.set(i.title + i.year, i));
  return [...map.values()];
}

/* ---------------- LIMIT CONCURRENCY SIMPLE ---------------- */
async function mapLimit(arr, fn, limit = 5) {
  const result = [];
  let index = 0;

  async function worker() {
    while (index < arr.length) {
      const i = index++;
      result[i] = await fn(arr[i]);
    }
  }

  const workers = Array(limit).fill().map(worker);
  await Promise.all(workers);

  return result;
}

/* ---------------- MAIN ---------------- */
async function main() {
  console.log("🚀 Starting real catalog build...");

  // 1. WATCHMODE (Netflix ES real)
  const netflix = await getNetflixES();

  console.log(`📺 Netflix items: ${netflix.length}`);

  // 2. CLASSIFY EARLY
  const classified = netflix.map((i) => ({
    ...i,
    status: classify(i),
  }));

  // 3. ENRICH TMDB
  const enriched = await mapLimit(classified, enrichItem, 5);

  // 4. CLEAN
  const cleaned = enriched.filter((i) => i.poster_path);

  // 5. DEDUPE
  const final = dedupe(cleaned).slice(0, 80);

  // 6. OUTPUT STRUCTURE
  const output = {
    updated_at: new Date().toISOString(),

    platforms: {
      netflix: {
        movies: final.filter((i) => i.type === "movie"),
        series: final.filter((i) => i.type !== "movie"),
      },
    },
  };

  // 7. WRITE FILE
  const file = path.resolve(
    process.cwd(),
    "frontend/public/estrenos.json"
  );

  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify(output, null, 2));

  console.log("✅ Catalog built successfully");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
