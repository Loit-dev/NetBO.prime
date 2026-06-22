const fs = require('fs');
const path = require('path');

// El script buscará el Token largo en los Secrets de tu repositorio
const TMDB_TOKEN = process.env.TMDB_API_KEY; 
const REGION = 'ES'; // Cambia a 'MX', 'AR', etc., si prefieres otro país

// IDs oficiales de las plataformas de streaming en TMDB
const PLATAFORMAS = {
  8: 'Netflix',
  337: 'Disney Plus',
  119: 'Amazon Prime Video',
  384: 'HBO Max / Max'
};

async function consultarEstrenos() {
  try {
    const listaFinal = [];

    // Configuración de cabeceras seguras con tu Bearer Token
    const opcionesFetch = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${TMDB_TOKEN}`
      }
    };

    // 1. Consultamos las películas en cartelera y añadidas recientemente
    const urlPeliculas = `https://themoviedb.org{REGION}`;
    const respuesta = await fetch(urlPeliculas, opcionesFetch);
    const datos = await respuesta.json();

    if (!datos.results) {
      throw new Error('No se recibieron resultados de la API de TMDB. Revisa tu Token.');
    }

    // 2. Recorremos cada película para comprobar sus plataformas de streaming
    for (const pelicula of datos.results) {
      const providersUrl = `https://themoviedb.org{pelicula.id}/watch/providers`;
      const providersRes = await fetch(providersUrl, opcionesFetch);
      const providersDatos = await providersRes.json();

      // Buscamos si el contenido está disponible en streaming por suscripción fija (flatrate)
      const paisDatos = providersDatos.results ? providersDatos.results[REGION] : null;
      
      if (paisDatos && paisDatos.flatrate) {
        for (const proveedor of paisDatos.flatrate) {
          // Si el ID del proveedor coincide con nuestras plataformas configuradas
          if (PLATAFORMAS[proveedor.provider_id]) {
            listaFinal.push({
              id: pelicula.id,
              title: pelicula.title,
              overview: pelicula.overview,
              poster_path: pelicula.poster_path,
              release_date: pelicula.release_date,
              plataforma: PLATAFORMAS[proveedor.provider_id]
            });
            break; // Ya encontramos su plataforma, pasamos a la siguiente película
          }
        }
      }
    }

    // 3. Guardamos los resultados finales en el archivo JSON local
    const rutaArchivo = path.join(__dirname, '../data/estrenos.json');
    
    if (!fs.existsSync(path.dirname(rutaArchivo))) {
      fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
    }

    fs.writeFileSync(rutaArchivo, JSON.stringify(listaFinal, null, 2));
    console.log(`¡Éxito! Se han sincronizado de forma automática ${listaFinal.length} estrenos.`);

  } catch (error) {
    console.error('Error crítico en la automatización:', error.message);
    process.exit(1);
  }
}

consultarEstrenos();
