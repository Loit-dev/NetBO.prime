const fs = require("fs");
const path = require("path");
const https = require("https");

const API_KEY = process.env.TMDB_API_KEY?.trim();

const REGION = "ES";
const LANGUAGE = "es-ES";

function request(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(JSON.parse(data)));
      })
      .on("error", reject);
  });
}

async function get(url) {
  const data = await request(url);
  return data.results || [];
}

/* 🧠 CLASIFICACIÓN TIMELINE */
function classify(item) {
  const dateStr = item.release_date || item.first_air_date;
  if (!dateStr) return "normal";

  const date = new Date(dateStr);
  const now = new Date();

  const diffDays = (date - now) / (1000 * 60 * 60 * 24);

  if (diffDays >= -7 && diffDays <= 7) return "recent";
  if (diffDays > 7) return "upcoming";
  if (diffDays >= -30) return "normal";

  return "old";
}

/* 🧠 SCORE TIMELINE */
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

/* 🎬 MOVIES */
async function getMovies() {
  const trending = await get(
    `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&language=${LANGUAGE}`
  );

  const upcoming = await get(
    `https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}`
  );

  const discover = await get(
    `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=${LANGUAGE}&sort_by=release_date.desc&page=1`
  );

  return [...trending, ...upcoming, ...discover]
    .filter((m) => m.poster_path)
    .map((m) => ({
      ...m,
      status: classify(m),
      release_date: m.release_date,
    }))
    .sort((a, b) => score(a) - score(b));
}

/* 📺 SERIES */
async function getSeries() {
  const trending = await get(
    `https://api.themoviedb.org/3/trending/tv/week?api_key=${API_KEY}&language=${LANGUAGE}`
  );

  const airing = await get(
    `https://api.themoviedb.org/3/tv/airing_today?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}`
  );

  const onair = await get(
    `https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}`
  );

  const discover = await get(
    `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=${LANGUAGE}&sort_by=first_air_date.desc&page=1`
  );

  return [...trending, ...airing, ...onair, ...discover]
    .filter((s) => s.poster_path)
    .map((s) => ({
      ...s,
      status: classify(s),
      release_date: s.first_air_date,
    }))
    .sort((a, b) => score(a) - score(b));
}

function dedupe(list) {
  const map = new Map();
  list.forEach((i) => i?.id && map.set(i.id, i));
  return Array.from(map.values());
}

async function main() {
  if (!API_KEY) throw new Error("Missing API KEY");

  const movies = dedupe(await getMovies()).slice(0, 80);
  const series = dedupe(await getSeries()).slice(0, 80);

  const output = {
    updated_at: new Date().toISOString(),
    movies,
    series,
  };

  const file = path.join(__dirname, "../frontend/public/estrenos.json");

  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify(output, null, 2));

  console.log("✅ Timeline streaming listo");
}

main();
