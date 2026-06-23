const https = require("https");

const API_KEY = process.env.TMDB_API_KEY;

function request(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));

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

async function searchTMDB(title, type) {
  const mediaType = type === "movie" ? "movie" : "tv";

  const url =
    `https://api.themoviedb.org/3/search/${mediaType}` +
    `?api_key=${API_KEY}` +
    `&query=${encodeURIComponent(title)}` +
    `&language=es-ES`;

  const data = await request(url);

  return data.results?.[0] || null;
}

async function enrichItem(item) {
  const tmdb = await searchTMDB(item.title, item.type);

  if (!tmdb) {
    return {
      ...item,
      poster_path: null,
      overview: null,
      vote_average: null,
    };
  }

  return {
    ...item,
    poster_path: tmdb.poster_path,
    overview: tmdb.overview,
    vote_average: tmdb.vote_average,
  };
}

module.exports = { enrichItem };
