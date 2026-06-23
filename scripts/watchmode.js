const https = require("https");

const API_KEY = process.env.WATCHMODE_API_KEY;

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

async function getNetflixES() {
  console.log("📡 calling Watchmode API...");
  console.log("🔑 API KEY exists:", !!API_KEY);
  console.log("🔑 API KEY length:", API_KEY?.length);

  const url =
    `https://api.watchmode.com/v1/list-titles/?apiKey=${API_KEY}` +
    `&regions=ES&limit=100`;

  const data = await request(url);

  console.log("📦 Watchmode response keys:", Object.keys(data));

  const titles = data.titles || [];

  console.log("📺 raw titles length:", titles.length);

  return titles.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type === "tv_series" ? "series" : "movie",
    year: item.year,
  }));
}

module.exports = { getNetflixES };
