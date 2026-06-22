const fs = require("fs");
const path = require("path");
const https = require("https");

const API_KEY = process.env.TMDB_API_KEY?.trim();

const REGION = "ES";
const LANGUAGE = "es-ES";

// 📺 Plataformas
const PLATAFORMAS = {
  8: { name: "Netflix", logo: "/logos/netflix.png" },
  337: { name: "Disney Plus", logo: "/logos/disney.png" },
  119: { name: "Amazon Prime Video", logo: "/logos/prime.png" },
  384: { name: "Max", logo: "/logos/max.png" },
};

// 📅 Fechas (solo para marcar NEW, NO para filtrar catálogo)
function obtenerFechas() {
  const hoy = new Date();

  const hace7dias = new Date();
  hace7dias.setDate(hoy.getDate() - 7);

  return {
    hace7dias: hace7dias.toISOString().split("T")[0],
  };
}

const { hace7dias } = obtenerFechas();

// 🌐 request helper
function hacerPeticion(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));

        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Error JSON"));
          }
        });
      })
      .on("error", reject);
  });
}

// 🎬 trailer
async function obtenerTrailer(id, tipo) {
  try {
    const url =
      `https://api.themoviedb.org/3/${tipo}/${id}/videos` +
      `?api_key=${API_KEY}&language=${LANGUAGE}`;

    const data = await hacerPeticion(url);

    const trailer = (data.results || []).find(
      (v) => v.site === "YouTube" && v.type === "Trailer"
    );

    return trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null;
  } catch {
    return null;
  }
}

// 🧠 géneros
async function obtenerGeneros(tipo) {
  const url =
    `https://api.themoviedb.org/3/genre/${tipo}/list` +
    `?api_key=${API_KEY}&language=${LANGUAGE}`;

  const data = await hacerPeticion(url);

  const map = {};
  (data.genres || []).forEach((g) => (map[g.id] = g.name));

  return map;
}

// 📦 MULTIPÁGINA (CLAVE PARA MÁS CONTENIDO)
async function obtenerMultipaginas(tipo, providerId) {
  let resultados = [];

  for (let page = 1; page <= 3; page++) {
    const url =
      `https://api.themoviedb.org/3/discover/${tipo}` +
      `?api_key=${API_KEY}` +
      `&language=${LANGUAGE}` +
      `&watch_region=${REGION}` +
      `&with_watch_providers=${providerId}` +
      `&sort_by=popularity.desc` +
      `&page=${page}`;

    const data = await hacerPeticion(url);
    resultados = resultados.concat(data.results || []);
  }

  return resultados;
}

// 🎯 wrapper
async function obtenerContenido(tipo, providerId) {
  return await obtenerMultipaginas(tipo, providerId);
}

// 🚀 MAIN
async function main() {
  try {
    if (!API_KEY) throw new Error("TMDB_API_KEY no encontrada");

    const movieGenres = await obtenerGeneros("movie");
    const tvGenres = await obtenerGeneros("tv");

    const resultado = {
      updated_at: new Date().toISOString(),
      region: REGION,
      platforms: {},
    };

    for (const providerId in PLATAFORMAS) {
      const plataforma = PLATAFORMAS[providerId];

      console.log(`📡 ${plataforma.name}`);

      const peliculas = await obtenerContenido("movie", providerId);
      const series = await obtenerContenido("tv", providerId);

      resultado.platforms[plataforma.name] = {
        logo: plataforma.logo,
        movies: [],
        series: [],
      };

      // 🎬 MOVIES
      for (const item of peliculas || []) {
        const trailer = await obtenerTrailer(item.id, "movie");

        resultado.platforms[plataforma.name].movies.push({
          id: item.id,
          type: "movie",
          title: item.title,
          overview: item.overview,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          release_date: item.release_date,
          vote_average: item.vote_average,
          popularity: item.popularity,
          genres: item.genre_ids?.map((id) => movieGenres[id]),
          trailer,
          tmdb_url: `https://www.themoviedb.org/movie/${item.id}`,

          // 🆕 NEW FLAG
          isNew:
            item.release_date &&
            new Date(item.release_date) >= new Date(hace7dias),
        });
      }

      // 📺 SERIES
      for (const item of series || []) {
        const trailer = await obtenerTrailer(item.id, "tv");

        resultado.platforms[plataforma.name].series.push({
          id: item.id,
          type: "tv",
          title: item.name,
          overview: item.overview,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          release_date: item.first_air_date,
          vote_average: item.vote_average,
          popularity: item.popularity,
          genres: item.genre_ids?.map((id) => tvGenres[id]),
          trailer,
          tmdb_url: `https://www.themoviedb.org/tv/${item.id}`,

          // 🆕 NEW FLAG
          isNew:
            item.first_air_date &&
            new Date(item.first_air_date) >= new Date(hace7dias),
        });
      }
    }

    // 💾 guardar en frontend/public
    const ruta = path.join(
      __dirname,
      "../frontend/public/estrenos.json"
    );

    fs.mkdirSync(path.dirname(ruta), { recursive: true });

    fs.writeFileSync(ruta, JSON.stringify(resultado, null, 2));

    console.log("✅ Catálogo ampliado generado correctamente");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    process.exit(1);
  }
}

main();
