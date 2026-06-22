const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.TMDB_API_KEY?.trim();

const REGION = 'ES';

// Plataformas TMDB
const PLATAFORMAS = {
  8: 'Netflix',
  337: 'Disney Plus',
  119: 'Amazon Prime Video',
  384: 'Max'
};

// Obtener fecha hace 7 días
function obtenerFechaSemana() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 7);

  return fecha.toISOString().split('T')[0];
}

const FECHA_SEMANA = obtenerFechaSemana();

// Función HTTPS
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
            } catch (err) {
              reject(err);
            }
          });
        }
      )
      .on('error', reject);
  });
}

async function obtenerContenido(tipo, providerId) {
  const url =
    `https://api.themoviedb.org/3/discover/${tipo}` +
    `?api_key=${API_KEY}` +
    `&language=es-ES` +
    `&watch_region=${REGION}` +
    `&with_watch_providers=${providerId}` +
    `&sort_by=popularity.desc` +
    `&page=1`;

  // Fechas
  if (tipo === 'movie') {
    return hacerPeticion(
      url +
        `&primary_release_date.gte=${FECHA_SEMANA}`
    );
  } else {
    return hacerPeticion(
      url +
        `&first_air_date.gte=${FECHA_SEMANA}`
    );
  }
}

async function main() {
  try {
    if (!API_KEY) {
      throw new Error('TMDB_API_KEY no encontrada');
    }

    const resultado = {};

    for (const providerId in PLATAFORMAS) {
      const nombre = PLATAFORMAS[providerId];

      console.log(`Consultando ${nombre}...`);

      // Películas
      const peliculas = await obtenerContenido(
        'movie',
        providerId
      );

      // Series
      const series = await obtenerContenido(
        'tv',
        providerId
      );

      resultado[nombre] = {
        movies: peliculas.results.map((item) => ({
          id: item.id,
          title: item.title,
          overview: item.overview,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          release_date: item.release_date,
          vote_average: item.vote_average,
          popularity: item.popularity
        })),

        series: series.results.map((item) => ({
          id: item.id,
          title: item.name,
          overview: item.overview,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          release_date: item.first_air_date,
          vote_average: item.vote_average,
          popularity: item.popularity
        }))
      };
    }

    const rutaArchivo = path.join(
      __dirname,
      '../data/estrenos.json'
    );

    if (!fs.existsSync(path.dirname(rutaArchivo))) {
      fs.mkdirSync(path.dirname(rutaArchivo), {
        recursive: true
      });
    }

    fs.writeFileSync(
      rutaArchivo,
      JSON.stringify(resultado, null, 2)
    );

    console.log('✅ Catálogo actualizado correctamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
