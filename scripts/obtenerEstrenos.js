const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.TMDB_API_KEY ? process.env.TMDB_API_KEY.trim() : ''; 
const REGION = 'ES'; 

const PLATAFORMAS = {
  8: 'Netflix',
  337: 'Disney Plus',
  119: 'Amazon Prime Video',
  384: 'HBO Max / Max'
};

function hacerPeticion(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Error al procesar el JSON de respuesta'));
          }
        } else {
          reject(new Error(`Servidor de TMDB respondió con código HTTP ${res.statusCode}`));
        }
      });
    }).on('error', (err) => reject(err));
  });
}

async function consultarEstrenos() {
  try {
    if (!API_KEY) {
      throw new Error('La clave TMDB_API_KEY está vacía en los Secrets de GitHub.');
    }

    const listaFinal = [];
    
    // Dirección oficial e infalible de la API de TMDB
    const urlPeliculas = 'https://themoviedb.org' + API_KEY + '&language=es-ES&page=1&region=' + REGION;
    
    console.log('Conectando con la API de TMDB mediante HTTPS nativo...');
    const datos = await hacerPeticion(urlPeliculas);

    if (!datos.results || datos.results.length === 0) {
      throw new Error('La respuesta vino vacía.');
    }

    console.log('Buscando proveedores para los títulos encontrados...');

    for (const pelicula of datos.results) {
      try {
        const providersUrl = 'https://themoviedb.org' + pelicula.id + '/watch/providers?api_key=' + API_KEY;
        const providersDatos = await hacerPeticion(providersUrl);
        const paisDatos = providersDatos.results ? providersDatos.results[REGION] : null;
        
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
              break; 
            }
          }
        }
      } catch (err) {
        // Ignorar fallos en películas individuales
      }
    }

    const rutaArchivo = path.join(__dirname, '../data/estrenos.json');
    if (!fs.existsSync(path.dirname(rutaArchivo))) {
      fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
    }

    fs.writeFileSync(rutaArchivo, JSON.stringify(listaFinal, null, 2));
    console.log('¡Éxito total! Sincronizados de forma correcta ' + listaFinal.length + ' estrenos.');

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO DETECTADO:');
    console.error(error.message);
    process.exit(1);
  }
}

consultarEstrenos();
