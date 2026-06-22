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

/* 🔥 MÁS PÁGINAS = MÁS CONTENIDO */
async function fetchDiscover(type, providerId) {
  let all = [];

  for (let page = 1; page <= 5; page++) {
    const url =
      `https://api.themoviedb.org/3/discover/${type}` +
      `?api_key=${API_KEY}` +
      `&language=${LANGUAGE}` +
      `&watch_region=${REGION}` +
      `&with_watch_providers=${providerId}` +
      `&sort_by=popularity.desc` +
      `&include_adult=false` +
      `&page=${page}`;

    const data = await request(url);
    all = all.concat(data.results || []);
  }

  return all;
}

/* 🔥 TRENDING EXTRA */
async function fetchTrending(type) {
  const url =
    `https://api.themoviedb.org/3/trending/${type}/week` +
    `?api_key=${API_KEY}&language=${LANGUAGE}`;

  const data = await request(url);
  return data.results || [];
}

/* 🔥 TRAILER */
async function fetchTrailer(id, type) {
  const url =
    `https://api.themoviedb.org/3/${type}/${id}/videos` +
    `?api_key=${API_KEY}&language=${LANGUAGE}`;

  const data = await request(url);

  const trailer = (data.results || []).find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );

  return trailer
    ? {
        youtubeId: trailer.key,
      }
    : null;
}

function dedupe(list) {
  const map = new Map();
  list.forEach((i) => map.set(i.id, i));
  return Array.from(map.values());
}

async function main() {
  const output = {
    updated_at: new Date().toISOString(),
    platforms: {},
  };

  for (const id in PLATAFORMAS) {
    const p = PLATAFORMAS[id];

    console.log("Procesando", p.name);

    const movies = await fetchDiscover("movie", id);
    const series = await fetchDiscover("tv", id);

    const trendingMovies = await fetchTrending("movie");
    const trendingSeries = await fetchTrending("tv");

    const allMovies = dedupe([...trendingMovies, ...movies]).slice(0, 60);
    const allSeries = dedupe([...trendingSeries, ...series]).slice(0, 60);

    output.platforms[p.name] = {
      logo: p.logo,
      movies: [],
      series: [],
    };

    for (const m of allMovies) {
      const trailer = await fetchTrailer(m.id, "movie");

      output.platforms[p.name].movies.push({
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster_path: m.poster_path,
        backdrop_path: m.backdrop_path,
        vote_average: m.vote_average,
        popularity: m.popularity,
        video: trailer,
      });
    }

    for (const s of allSeries) {
      const trailer = await fetchTrailer(s.id, "tv");

      output.platforms[p.name].series.push({
        id: s.id,
        title: s.name,
        overview: s.overview,
        poster_path: s.poster_path,
        backdrop_path: s.backdrop_path,
        vote_average: s.vote_average,
        popularity: s.popularity,
        video: trailer,
      });
    }
  }

  const file = path.join(__dirname, "../frontend/public/estrenos.json");

  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify(output, null, 2));

  console.log("✅ catálogo ampliado listo (mucho más contenido)");
}

main();
