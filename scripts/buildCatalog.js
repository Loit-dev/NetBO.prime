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

  const netflix = await getNetflixES();
  console.log("Netflix items:", netflix.length);

  const classified = netflix.map((i) => ({
    ...i,
    status: classify(i),
  }));

  const enriched = await mapLimit(classified, enrichItem, 5);

  const cleaned = enriched.filter((i) => i.poster_path);

  const final = dedupe(cleaned).slice(0, 80);

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

  console.log("✅ DONE - catalog generated");
}

main().catch(console.error);
