const fs = require("fs");
const path = require("path");
const https = require("https");

const API_KEY = process.env.TMDB_API_KEY?.trim();

const REGION = "ES";
const LANGUAGE = "es-ES";

/* 🧠 PLATAFORMAS */
const PLATFORMS = {
  8: "Netflix",
  337: "Disney Plus",
  119: "Amazon Prime Video",
  384: "Max",
};

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

/* 🎯 FETCH PROVIDER DATA (CLAVE JUSTWATCH) */
async function getWithProviders(type, providerId) {
  const url =
    `https://api.themoviedb.org/3/discover/${type}` +
    `?api_key=${API_KEY}` +
    `&language=${LANGUAGE}` +
    `&sort_by=popularity.desc` +
    `&with_watch_providers=${providerId}` +
    `&watch_region=${REGION}` +
    `&include_adult=false` +
    `&page=1`;

  const data = await request(url);
  return data.results || [];
}

/* 🔥 TRENDING GLOBAL */
async function trending(type) {
  const url =
    `https://api.themoviedb.org/3/trending/${type}/week` +
    `?api_key=${API_KEY}&language=${LANGUAGE}`;

  const data = await request(url);
  return data.results || [];
}

/* 🧠 DEDUPE */
function dedupe(list) {
  const map = new Map();
  list.forEach((i) => i?.id && map.set(i.id, i));
  return Array.from(map.values());
}

/* 🎬 BUILD PLATFORM */
async function buildPlatform(providerId, name, logo) {
  const movies = await getWithProviders("movie", providerId);
  const series = await getWithProviders("tv", providerId);

  return {
    name,
    logo,
    movies: movies.slice(0, 50),
    series: series.slice(0, 50),
  };
}

async function main() {
  if (!API_KEY) throw new Error("Missing API KEY");

  console.log("🚀 Generando catálogo JustWatch-like...");

  const trendingMovies = await trending("movie");
  const trendingSeries = await trending("tv");

  const platforms = {};

  for (const id in PLATFORMS) {
    const name = PLATFORMS[id];

    console.log("📡 Procesando:", name);

    const data = await buildPlatform(
      id,
      name,
      `/logos/${name.toLowerCase().replace(" ", "")}.png`
    );

    platforms[name] = data;
  }

  const output = {
    updated_at: new Date().toISOString(),

    /* 🔥 CAPA GLOBAL (tipo JustWatch trending) */
    trending: {
      movies: dedupe(trendingMovies).slice(0, 30),
      series: dedupe(trendingSeries).slice(0, 30),
    },

    /* 📺 CAPA POR PLATAFORMA */
    platforms,
  };

  const file = path.join(__dirname, "../frontend/public/estrenos.json");

  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify(output, null, 2));

  console.log("✅ JustWatch MVP listo");
}

main();
