const fs = require("fs");
const path = require("path");
const https = require("https");

const API_KEY = process.env.TMDB_API_KEY?.trim();

const REGION = "ES";
const LANGUAGE = "es-ES";

/* ---------------- REQUEST ---------------- */
function request(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (c) => (data += c));

        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

/* ---------------- STATUS LOGIC ---------------- */
function classify(item) {
  const dateStr = item.release_date || item.first_air_date;
  if (!dateStr) return "normal";

  const date = new Date(dateStr);
  const now = new Date();

  const diffDays = (date - now) / (1000 * 60 * 60 * 24);

  if (diffDays >= -7 && diffDays <= 7) return "recent";
  if (diffDays > 7) return "upcoming";
  return "normal";
}

/* ---------------- SCORE ---------------- */
function score(item) {
  const dateStr = item.release_date || item.first_air_date;
  if (!dateStr) return 9999;

  const date = new Date(dateStr);
  const now = new Date();

  const diffDays = (date - now) / (1000 * 60 * 60 * 24);

  if (diffDays < -7) return 0 + diffDays;
  if (diffDays >= -7 && diffDays <= 7) return 1000;
  if (diffDays > 7) return 2000 + diffDays;

  return 9999;
}

/* ---------------- STREAMING FILTER ONLY ---------------- */
const STREAM_PROVIDERS = "8|337|119|384";

/* ---------------- MOVIES ---------------- */
async function getMovies() {
  const url =
    `https://api.themoviedb.org/3/discover/movie` +
    `?api_key=${API_KEY}` +
    `&language=${LANGUAGE}` +
    `&sort_by=release_date.desc` +
    `&watch_region=${REGION}` +
    `&with_watch_monetization_types=flatrate` +
    `&with_watch_providers=${STREAM_PROVIDERS}`;

  const data = await request(url);

  return (data.results || [])
    .filter((m) => m.poster_path)
    .map((m) => ({
      ...m,
      title: m.title,
      release_date: m.release_date,
      status: classify(m),
    }))
    .sort((a, b) => score(a) - score(b));
}

/* ---------------- SERIES ---------------- */
async function getSeries() {
  const url =
    `https://api.themoviedb.org/3/discover/tv` +
    `?api_key=${API_KEY}` +
    `&language=${LANGUAGE}` +
    `&sort_by=first_air_date.desc` +
    `&watch_region=${REGION}` +
    `&with_watch_monetization_types=flatrate` +
    `&with_watch_providers=${STREAM_PROVIDERS}`;

  const data = await request(url);

  return (data.results || [])
    .filter((s) => s.poster_path)
    .map((s) => ({
      ...s,
      title: s.name,
      release_date: s.first_air_date,
      status: classify(s),
    }))
    .sort((a, b) => score(a) - score(b));
}

/* ---------------- REMOVE DUPLICATES ---------------- */
function dedupe(arr) {
  const map = new Map();
  arr.forEach((i) => map.set(i.id, i));
  return [...map.values()];
}

/* ---------------- MAIN ---------------- */
async function main() {
  const movies = dedupe(await getMovies()).slice(0, 80);
  const series = dedupe(await getSeries()).slice(0, 80);

  const output = {
    updated_at: new Date().toISOString(),
    movies,
    series,
  };

  const file = path.resolve(process.cwd(), "frontend/public/estrenos.json");

  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify(output, null, 2));

  console.log("✅ catálogo streaming + status OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
