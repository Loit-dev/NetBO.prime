const fs = require("fs");
const path = require("path");
const https = require("https");

const API_KEY = process.env.TMDB_API_KEY?.trim();

const REGION = "ES";
const LANGUAGE = "es-ES";

const PLATAFORMAS = {
  8: { name: "Netflix", logo: "/logos/netflix.png" },
  337: { name: "Disney Plus", logo: "/logos/disney.png" },
  119: { name: "Amazon Prime Video", logo: "/logos/prime.png" },
  384: { name: "Max", logo: "/logos/max.png" },
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

async function fetchPages(urlBase, pages = 3) {
  let all = [];

  for (let page = 1; page <= pages; page++) {
    const url = `${urlBase}&page=${page}`;
    const data = await request(url);
    all = all.concat(data.results || []);
  }

  return all;
}

/* 🔥 TRENDING */
async function trending(type) {
  const url =
    `https://api.themoviedb.org/3/trending/${type}/week` +
    `?api_key=${API_KEY}&language=${LANGUAGE}`;

  const data = await request(url);
  return data.results || [];
}

/* 🔥 UPCOMING (ESTRENOS REALES) */
async function upcoming(type) {
  const url =
    `https://api.themoviedb.org/3/${type}/upcoming` +
    `?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}`;

  const data = await request(url);
  return data.results || [];
}

/* 🔥 DISCOVER SIN RESTRICCIÓN FUERTE */
async function discover(type) {
  const base =
    `https://api.themoviedb.org/3/discover/${type}` +
    `?api_key=${API_KEY}` +
    `&language=${LANGUAGE}` +
    `&sort_by=popularity.desc` +
    `&include_adult=false`;

  return fetchPages(base, 4);
}

/* 🔥 TRAILER */
async function trailer(id, type) {
  const url =
    `https://api.themoviedb.org/3/${type}/${id}/videos` +
    `?api_key=${API_KEY}&language=${LANGUAGE}`;

  const data = await request(url);

  const t = (data.results || []).find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );

  return t ? { youtubeId: t.key } : null;
}

/* 🔥 MERGE */
function merge(arrays) {
  const map = new Map();
  arrays.flat().forEach((i) => map.set(i.id, i));
  return Array.from(map.values());
}

async function main() {
  const output = {
    updated_at: new Date().toISOString(),
    platforms: {},
  };

  for (const id in PLATAFORMAS) {
    const p = PLATAFORMAS[id];

    console.log("Procesando:", p.name);

    const movies = merge([
      await trending("movie"),
      await upcoming("movie"),
      await discover("movie"),
    ]);

    const series = merge([
      await trending("tv"),
      await upcoming("tv"),
      await discover("tv"),
    ]);

    output.platforms[p.name] = {
      logo: p.logo,
      movies: [],
      series: [],
    };

    for (const m of movies.slice(0, 80)) {
      const vid = await trailer(m.id, "movie");

      output.platforms[p.name].movies.push({
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster_path: m.poster_path,
        backdrop_path: m.backdrop_path,
        vote_average: m.vote_average,
        popularity: m.popularity,
        video: vid,
      });
    }

    for (const s of series.slice(0, 80)) {
      const vid = await trailer(s.id, "tv");

      output.platforms[p.name].series.push({
        id: s.id,
        title: s.name,
        overview: s.overview,
        poster_path: s.poster_path,
        backdrop_path: s.backdrop_path,
        vote_average: s.vote_average,
        popularity: s.popularity,
        video: vid,
      });
    }
  }

  const file = path.join(__dirname, "../frontend/public/estrenos.json");

  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify(output, null, 2));

  console.log("✅ catálogo REAL ampliado (trending + upcoming + discover)");
}

main();
