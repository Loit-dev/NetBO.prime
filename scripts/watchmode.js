const https = require("https");

const API_KEY = process.env.WATCHMODE_API_KEY;

function request(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";

      res.on("data", (c) => (data += c));

      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

/**
 * 🔥 PASO 1: traer trending titles (NO catálogo directo)
 */
async function getTrending() {
  console.log("📡 fetching trending titles...");

  const url =
    `https://api.watchmode.com/v1/trending/?apiKey=${API_KEY}&limit=50`;

  const data = await request(url);

  console.log("📦 trending response keys:", Object.keys(data));

  return data.trending || [];
}

/**
 * 🔥 PASO 2: enriquecer con detalles de streaming
 */
async function getTitleSources(id) {
  const url =
    `https://api.watchmode.com/v1/title/${id}/sources/?apiKey=${API_KEY}`;

  const data = await request(url);

  return data || [];
}

/**
 * 🔥 FILTRAR SOLO NETFLIX ES
 */
async function getNetflixES() {
  const trending = await getTrending();

  const results = [];

  for (const item of trending) {
    const sources = await getTitleSources(item.id);

    const isNetflixES = sources.some(
      (s) =>
        s.source_name &&
        s.source_name.toLowerCase().includes("netflix") &&
        s.region === "ES"
    );

    if (isNetflixES) {
      results.push({
        id: item.id,
        title: item.title,
        type: item.type === "tv_series" ? "series" : "movie",
        year: item.year,
      });
    }
  }

  console.log("🎯 Netflix ES filtered:", results.length);

  return results;
}

module.exports = { getNetflixES };
