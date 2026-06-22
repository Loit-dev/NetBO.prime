const fs = require('fs');
const path = require('path');

const TMDB_TOKEN = process.env.TMDB_API_KEY; 
const REGION = 'ES'; 

const PLATAFORMAS = {
  8: 'Netflix',
  337: 'Disney Plus',
  119: 'Amazon Prime Video',
  384: 'HBO Max / Max'
};

async function consultarEstrenos() {
  try {
    if (!TMDB_TOKEN) {
      throw new Error('Falta la variable de entorno TMDB_API_KEY. Verifica los Secrets de GitHub.');
    }

    const listaFinal = [];
    const opcionesFetch = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${TMDB_TOKEN.trim()}`
      }
    };

    const urlPeliculas = `https://themoviedb.org{REGION}`;
    const respuesta = await fetch(urlPeliculas, opcionesFetch);
    
    if (!respuesta.ok) {
      throw new Error(`Error en la API de TMDB: ${respuesta.status} ${respuesta.statusText}`);
    }

    const datos = await respuesta.json();

    if (!datos.results || datos.results.length === 0) {
      throw new Error('No se recibieron películas de la API.');
    }

    for (const pelicula of datos.results) {
      try {
        const providersUrl = `https://themoviedb.org{pelicula.id}/watch/providers`;
        const providersRes = await fetch(providersUrl, opcionesFetch);
        
        if (!providersRes.ok) continue;
        
        const providersDatos = await providersRes.json();
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
        console.log(`Error saltable procesando película ${pelicula.id}:`, err.message);
      }
    }

    const rutaArchivo = path.join(__dirname, '../data/estrenos.json');
    if (!fs.existsSync(path.dirname(rutaArchivo))) {
      fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
    }

    fs.writeFileSync(rutaArchivo, JSON.stringify(listaFinal, null, 2));
    console.log(`¡Éxito! Sincronizados ${listaFinal.length} estrenos de forma correcta.`);

  } catch (error) {
    console.error('Error ejecución:', error.message);
    process.exit(1);
  }
}

consultarEstrenos();
