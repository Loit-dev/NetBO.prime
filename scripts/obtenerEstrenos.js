const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.TMDB_API_KEY?.trim();

const REGION = 'ES';
const LANGUAGE = 'es-ES';

// Plataformas
const PLATAFORMAS = {
  8: {
    name: 'Netflix',
    logo: '/logos/netflix.png'
  },
  337: {
    name: 'Disney Plus',
    logo: '/logos/disney.png'
  },
  119: {
    name: 'Amazon Prime Video',
    logo: '/logos/prime.png'
  },
  384: {
    name: 'Max',
    logo: '/logos/max.png'
  }
};

// Fecha últimos 7 días
function obtenerFechaSemana() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 7);

  return fecha.toISOString().split('T')[0];
}

const FECHA_SEMANA = obtenerFechaSemana();

// HTTPS request
function hacerPeticion(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        },
        (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(
                new Error('Error procesando JSON')
              );
            }
          });
        }
      )
      .on('error', reject);
  });
}

// Obtener trailers
async function obtenerTrailer(id, tipo) {
  try {
    const url =
      `https://api.themoviedb.org/3/${tipo}/${id}/videos` +
      `?api_key=${API_KEY}` +
      `&language=${LANGUAGE}`;

    const datos = await hacerPeticion(url);

    if (!datos.results) return null;

    const trailer = datos.results.find(
      (video) =>
        video.site === 'YouTube' &&
        video.type === 'Trailer'
    );

    return trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null;
  } catch {
    return null;
  }
}

// Obtener géneros
async function obtenerGeneros(tipo) {
  const url =
    `https://api.themoviedb.org/3/genre/${tipo}/list` +
    `?api_key=${API_KEY}` +
    `&language=${LANGUAGE}`;

  const datos = await hacerPeticion(url);

  const mapa = {};

  datos.genres.forEach((g) => {
    mapa[g.id] = g.name;
  });

  return mapa;
}

// Obtener tendencias
async function obtenerTrending(tipo) {
  const url =
    `https://api.themoviedb.org/3/trending/${tipo}/week` +
    `?api_key=${API_KEY}` +
    `&language=${LANGUAGE}`;

  const datos = await hacerPeticion(url);

  return datos.results || [];
}

// Obtener contenido plataforma
async function obtenerContenido(tipo, providerId) {
  let url =
    `https://api.themoviedb.org/3/discover/${tipo}` +
    `?api_key=${API_KEY}` +
    `&language=${LANGUAGE}` +
    `&watch_region=${REGION}` +
    `&with_watch_providers=${providerId}` +
    `&sort_by=popularity.desc` +
    `&page=1`;

  // Fechas
  if (tipo === 'movie') {
    url +=
      `&primary_release_date.gte=${FECHA_SEMANA}`;
  } else {
    url +=
      `&first_air_date.gte=${FECHA_SEMANA}`;
  }

  return hacerPeticion(url);
}

async function main() {
  try {
    if (!API_KEY) {
      throw new Error(
        'TMDB_API_KEY no encontrada'
      );
    }

    console.log('Obteniendo géneros...');

    const movieGenres = await obtenerGeneros(
      'movie'
    );

    const tvGenres = await obtenerGeneros('tv');

    console.log('Obteniendo tendencias...');

    const trendingMovies =
      await obtenerTrending('movie');

    const trendingTV =
      await obtenerTrending('tv');

    const resultado = {
      updated_at: new Date().toISOString(),
      region: REGION,
      platforms: {},
      trending: {
        movies: [],
        series: []
      }
    };

    // Trending películas
    for (const item of trendingMovies.slice(0, 10)) {
      resultado.trending.movies.push({
        id: item.id,
        title: item.title,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        vote_average: item.vote_average,
        popularity: item.popularity
      });
    }

    // Trending series
    for (const item of trendingTV.slice(0, 10)) {
      resultado.trending.series.push({
        id: item.id,
        title: item.name,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        vote_average: item.vote_average,
        popularity: item.popularity
      });
    }

    // Plataformas
    for (const providerId in PLATAFORMAS) {
      const plataforma =
        PLATAFORMAS[providerId];

      console.log(
        `Consultando ${plataforma.name}...`
      );

      const peliculas =
        await obtenerContenido(
          'movie',
          providerId
        );

      const series =
        await obtenerContenido(
          'tv',
          providerId
        );

      resultado.platforms[plataforma.name] = {
        logo: plataforma.logo,
        movies: [],
        series: []
      };

      // Procesar películas
      for (const item of peliculas.results || []) {
        const trailer =
          await obtenerTrailer(
            item.id,
            'movie'
          );

        resultado.platforms[
          plataforma.name
        ].movies.push({
          id: item.id,
          type: 'movie',
          title: item.title,
          overview: item.overview,
          poster_path: item.poster_path,
          backdrop_path:
            item.backdrop_path,
          release_date:
            item.release_date,
          vote_average:
            item.vote_average,
          popularity: item.popularity,
          genres: item.genre_ids.map(
            (id) => movieGenres[id]
          ),
          trailer,
          tmdb_url:
            `https://www.themoviedb.org/movie/${item.id}`
        });
      }

      // Procesar series
      for (const item of series.results || []) {
        const trailer =
          await obtenerTrailer(
            item.id,
            'tv'
          );

        resultado.platforms[
          plataforma.name
        ].series.push({
          id: item.id,
          type: 'tv',
          title: item.name,
          overview: item.overview,
          poster_path: item.poster_path,
          backdrop_path:
            item.backdrop_path,
          release_date:
            item.first_air_date,
          vote_average:
            item.vote_average,
          popularity: item.popularity,
          genres: item.genre_ids.map(
            (id) => tvGenres[id]
          ),
          trailer,
          tmdb_url:
            `https://www.themoviedb.org/tv/${item.id}`
        });
      }
    }

    // Crear carpeta
    const rutaArchivo = path.join(
      __dirname,
      '../data/estrenos.json'
    );

    if (!fs.existsSync(path.dirname(rutaArchivo))) {
      fs.mkdirSync(
        path.dirname(rutaArchivo),
        {
          recursive: true
        }
      );
    }

    // Guardar JSON
    fs.writeFileSync(
      rutaArchivo,
      JSON.stringify(resultado, null, 2)
    );

    console.log(
      '✅ Catálogo completo actualizado correctamente'
    );
  } catch (error) {
    console.error(
      '\n❌ ERROR CRÍTICO:'
    );

    console.error(error.message);

    process.exit(1);
  }
}

main();
