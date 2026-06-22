const fs = require('fs');
const path = require('path');

// Limpiamos espacios alrededor de la clave por si acaso
const API_KEY = process.env.TMDB_API_KEY ? process.env.TMDB_API_KEY.trim() : ''; 
const REGION = 'ES'; 

const PLATAFORMAS = {
  8: 'Netflix',
  337: 'Disney Plus',
  119: 'Amazon Prime Video',
  384: 'HBO Max / Max'
};

async function consultarEstrenos() {
  try {
    if (!API_KEY) {
      throw new Error('La clave TMDB_API_KEY está vacía en los Secrets de GitHub.');
    }

    const listaFinal = [];

    // Usamos el método tradicional inyectando la clave directamente en la URL
    const urlPeliculas = `https://themoviedb.org{API_KEY}&language=es-ES&page=1&region=${REGION}`;
    console.log('Conectando de forma segura con la API de TMDB...');
    
    const respuesta = await fetch(urlPeliculas);
    
    if (!respuesta.ok) {
      throw new Error(`Error en TMDB: status ${respuesta.status}. Verifica que tu clave sea la correcta.`);
    }

    const datos = await respuesta.json();

    if (!datos.results || datos.results.length === 0) {
      throw new Error('La respuesta vino vacía.');
    }

    console.log(`Buscando streaming para ${datos.results.length} títulos...`);

    for (const pelicula of datos.results) {
      try {
        const providersUrl = `https://themoviedb.org{pelicula.id}/watch/providers?api_key=${API_KEY}`;
        const providersRes = await fetch(providersUrl);
        
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
        // Ignorar errores menores de una película individual
      }
    }

    const rutaArchivo = path.join(__dirname, '../data/estrenos.json');
    if (!fs.existsSync(path.dirname(rutaArchivo))) {
      fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });
    }

    fs.writeFileSync(rutaArchivo, JSON.stringify(listaFinal, null, 2));
    console.log(`¡Éxito total! Sincronizados de manera automática ${listaFinal.length} estrenos.`);

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO:');
    console.error(error.message);
    process.exit(1);
  }
}

consultarEstrenos();
