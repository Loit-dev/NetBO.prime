const https = require("https");

const API_KEY = process.env.WATCHMODE_API_KEY;

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

async function getNetflixES() {
  const url =
    `https://api.watchmode.com/v1/list-titles/?apiKey=${API_KEY}` +
    `&regions=ES&limit=100`;

  const data = await request(url);

  return (data.titles || []).map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type === "tv_series" ? "series" : "movie",
    year: item.year,
  }));
}

module.exports = { getNetflixES };
