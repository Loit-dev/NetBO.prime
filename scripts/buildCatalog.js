const fs = require("fs");
const path = require("path");

const { getNetflixES } = require("./watchmode");
const { enrichItem } = require("./tmdb");

function classify(item) {
  const now = new Date().getFullYear();

  if (!item.year) return "normal";
  if (item.year === now) return "recent";
  if (item.year > now) return "upcoming";

  return "normal";
}

function dedupe(arr) {
  const map = new Map();
  arr.forEach((i) => map.set(i.title + i.year, i));
  return [...map.values()];
}

async function mapLimit(arr, fn, limit = 5) {
  const result = [];
  let index = 0;

  async function worker() {
    while (index < arr.length) {
      const i = index++;
      result[i] = await fn(i);
    }
  }

  await Promise.all(Array(limit).fill().map(worker));
  return result;
}

async function main() {
  console.log("🚀 building catalog...");

  console.log("🔑 WATCHMODE key exists:", !!process.env.WATCHMODE_API_KEY);
  console.log("🔑 TMDB key exists:", !!process.env.TMDB_API_KEY);

  const netflix = await getNetflixES();

  console.log("📺 Netflix items:", netflix.length);
  console.log("📺 sample:", netflix.slice(0, 2));

  const classified = netflix.map((i) => ({
    ...i,
    status: classify(i),
  }));

  console.log("🏷️ classified sample:", classified.slice(0, 2));

  const enriched = await mapLimit(classified, enrichItem, 5);

  console.log("🎨 enriched sample:", enriched.slice(0, 2));

  const cleaned = enriched.filter((i) => i.poster_path);

  console.log("🧹 cleaned length:", cleaned.length);

  const final = dedupe(cleaned).slice(0, 80);

  console.log("✅ final length:", final.length);

  const output = {
    updated_at: new Date().toISOString(),
    platforms: {
      netflix: {
        movies: final.filter((i) => i.type === "movie"),
        series: final.filter((i) => i.type !== "movie"),
      },
    },
  };

  const file = path.resolve(
    process.cwd(),
    "frontend/public/estrenos.json"
  );

  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify(output, null, 2));

  console.log("🎉 DONE - catalog generated");
}

main().catch((err) => {
  console.error("❌ ERROR:", err);
});
