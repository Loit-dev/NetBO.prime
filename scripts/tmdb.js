const https = require("https");

const API_KEY = process.env.TMDB_API_KEY;

// helper request
function request(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => (data += chunk));

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
 * Buscar película o serie en TMDB por título
 */
async function searchTMDB(title, type, year) {
  const mediaType = type === "movie" ? "movie" : "tv";

  const url =
    `https://api.themoviedb.org/3/search/${mediaType}` +
    `?api_key=${API_KEY}` +
    `&query=${encodeURIComponent(title)}` +
    `&year=${year || ""}` +
    `&language=es-ES`;

  const data = await request(url);

  return data.results?.[0] || null;
}

/**
 * ENRICH ITEM
 */
async function enrichItem(item) {
  const tmdb = await searchTMDB(item.title, item.type, item.year);

  if (!tmdb) {
    return {
      ...item,
      poster_path: null,
      overview: null,
      status: "normal",
    };
  }

  return {
    id: item.id,
    title: item.title,
    type: item.type,
    year: item.year,

    poster_path: tmdb.poster_path,
    overview: tmdb.overview,
    vote_average: tmdb.vote_average,

    status: item.status || "normal",
  };
}

module.exports = {
  enrichItem,
};
