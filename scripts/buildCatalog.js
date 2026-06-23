console.log("🚀 SCRIPT ACTIVO - buildCatalog.js se está ejecutando");

const { getNetflixES } = require("./watchmode");

async function main() {
  console.log("🧪 test start");

  const data = await getNetflixES();

  console.log("📺 watchmode result:", data);

  console.log("📊 total items:", data.length);
}

main().catch((err) => {
  console.error("❌ ERROR:", err);
});
