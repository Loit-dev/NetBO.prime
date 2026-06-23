const https = require("https");

const API_KEY = process.env.WATCHMODE_API_KEY;

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
 * 🔵 OBTENER CONTENIDO NETFLIX ESPAÑA
 */
async function getNetflixES() {
  const url =
    `https://api.watchmode.com/v1/list-titles/?apiKey=${API_KEY}` +
    `&regions=ES` +
    `&source_ids=203` + // Netflix (Watchmode ID típico)
    `&limit=100`;

  const data = await request(url);

  return (data.titles || []).map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type, // movie / tv_series
    year: item.year,
    watchmode_id: item.id,
  }));
}

module.exports = {
  getNetflixES,
};
