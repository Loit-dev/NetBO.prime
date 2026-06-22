const fs = require('fs');
const path = require('path');
const https = require('https');

// Lee la API KEY desde GitHub Secrets
const API_KEY = process.env.TMDB_API_KEY
  ? process.env.TMDB_API_KEY.trim()
  : '';

const REGION = 'ES';

// IDs oficiales de proveedores en TMDB
const PLATAFORMAS = {
  8: 'Netflix',
  337: 'Disney Plus',
  119: 'Amazon Prime Video',
  384: 'HBO Max / Max'
};

// Función HTTPS segura
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
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(
                  new Error('Error al procesar el JSON de respuesta')
                );
              }
            } else {
              reject(
                new Error(
                  `Servidor TMDB respondió con HTTP ${res.statusCode}`
                )
              );
            }
          });
        }
      )
      .on('error', (err) => {
        reject(err);
      });
  });
}

async function consultarEstrenos() {
  try {
    // Verifica API KEY
    if (!API_KEY) {
      throw new Error(
        'La clave TMDB_API_KEY está vacía en GitHub Secrets.'
      );
    }

    const listaFinal = [];

    // Endpoint oficial TMDB
    const urlPeliculas =
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=es-ES&page=1&region=${REGION}`;

    console.log('Conectando con TMDB...');

    const datos = await hacerPeticion(urlPeliculas);

    if (!datos.results || datos.results.length === 0) {
      throw new Error('TMDB devolvió una respuesta vacía.');
    }

    console.log('Buscando plataformas de streaming...');

    // Recorremos películas
    for (const pelicula of datos.results) {
      try {
        // Endpoint proveedores
        const providersUrl =
          `https://api.themoviedb.org/3/movie/${pelicula.id}/watch/providers?api_key=${API_KEY}`;

        const providersDatos = await hacerPeticion(providersUrl);

        const paisDatos = providersDatos.results
          ? providersDatos.results[REGION]
          : null;

        // Si existe streaming por suscripción
        if (paisDatos && paisDatos.flatrate) {
          for (const proveedor of paisDatos.flatrate) {
            if (PLATAFORMAS[proveedor.provider_id]) {
              listaFinal.push({
                id: pelicula.id,
                title: pelicula.title,
                overview: pelicula.overview,
                poster_path: pelicula.poster_path,
                release_date: pelicula.release_date,
                plataforma: PLATAFORMAS[proveedor.provider_id]
              });

              // Ya encontramos plataforma
              break;
            }
          }
        }
      } catch (err) {
        console.log(
          `Error consultando proveedores para película ${pelicula.id}`
        );
      }
    }

    // Guardar JSON
    const rutaArchivo = path.join(
      __dirname,
      '../data/estrenos.json'
    );

    // Crear carpeta si no existe
    if (!fs.existsSync(path.dirname(rutaArchivo))) {
      fs.mkdirSync(path.dirname(rutaArchivo), {
        recursive: true
      });
    }

    // Escribir archivo
    fs.writeFileSync(
      rutaArchivo,
      JSON.stringify(listaFinal, null, 2)
    );

    console.log(
      `✅ Éxito: ${listaFinal.length} estrenos sincronizados correctamente.`
    );
  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO DETECTADO:');
    console.error(error.message);
    process.exit(1);
  }
}

// Ejecutar script
consultarEstrenos();
