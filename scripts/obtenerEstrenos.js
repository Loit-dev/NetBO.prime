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

/* 🎬 MOVIES (SOLO STREAMING LOGIC) */
async function getMovies() {
  const trending = await get(
    `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&language=${LANGUAGE}`
  );

  const upcoming = await get(
    `https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}`
  );

  const discover = await get(
    `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=${LANGUAGE}&sort_by=popularity.desc&page=1`
  );

  /* filtrado básico: quitar cosas sin poster o rarezas */
  return [...trending, ...upcoming, ...discover].filter(
    (m) => m.poster_path && m.vote_average > 5
  );
}

/* 📺 SERIES (FOCO REAL STREAMING) */
async function getSeries() {
  const trending = await get(
    `https://api.themoviedb.org/3/trending/tv/week?api_key=${API_KEY}&language=${LANGUAGE}`
  );

  const airingToday = await get(
    `https://api.themoviedb.org/3/tv/airing_today?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}`
  );

  const onTheAir = await get(
    `https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}`
  );

  const discover = await get(
    `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=${LANGUAGE}&sort_by=popularity.desc&page=1`
  );

  return [...trending, ...airingToday, ...onTheAir, ...discover].filter(
    (s) => s.poster_path && s.vote_average > 5
  );
}

/* 🧠 DEDUPE */
function dedupe(list) {
  const map = new Map();
  list.forEach((i) => i?.id && map.set(i.id, i));
  return Array.from(map.values());
}

async function main() {
  if (!API_KEY) throw new Error("Missing API KEY");

  const movies = dedupe(await getMovies()).slice(0, 120);
  const series = dedupe(await getSeries()).slice(0, 120);

  const output = {
    updated_at: new Date().toISOString(),
    region: REGION,
    language: LANGUAGE,
    movies,
    series,
  };

  const file = path.join(__dirname, "../frontend/public/estrenos.json");

  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify(output, null, 2));

  console.log("✅ catálogo streaming-only actualizado");
}

main();
