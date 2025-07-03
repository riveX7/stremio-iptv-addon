const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const http = require("http");

const PORT = process.env.PORT || 8080;
const M3U_URL = "https://m3upt.com/iptv";

// Função para carregar e processar os canais M3U
async function loadChannels() {
  console.log("🔄 A carregar canais da M3U...");
  const res = await fetch(M3U_URL);
  const text = await res.text();

  // Parsing simples da M3U para extrair canais
  const lines = text.split("\n");
  const channels = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXTINF:")) {
      const nameMatch = lines[i].match(/,(.+)/);
      const name = nameMatch ? nameMatch[1].trim() : "Unknown";
      const url = lines[i + 1] ? lines[i + 1].trim() : "";
      const id = url; // usar url como id único
      
      channels.push({
        id,
        name,
        url,
        type: "tv",
        poster: "https://img.icons8.com/color/240/tv.png"
      });
    }
  }
  console.log(`✅ ${channels.length} canais carregados da M3U.`);
  return channels;
}

// Vamos já carregar os canais ao arrancar o servidor
let channels = [];
loadChannels()
  .then(c => { channels = c; })
  .catch(err => {
    console.error("Erro a carregar canais:", err);
  });

const builder = new addonBuilder({
  id: "org.miguel.iptv",
  version: "1.0.0",
  name: "Miguel IPTV Addon",
  description: "Addon IPTV para Stremio com M3U da M3UPT",
  resources: ["catalog", "stream"],
  types: ["tv"],
  catalogs: [
    {
      type: "tv",
      id: "iptv-catalog",
      name: "IPTV M3U Catalog"
    }
  ]
});

// Handler do catálogo
builder.defineCatalogHandler(async ({ type, id }) => {
  console.time("catalogHandler");
  if (type !== "tv" || id !== "iptv-catalog") {
    console.timeEnd("catalogHandler");
    return { metas: [] };
  }

  // Recarregar canais a cada pedido (podes mudar para cachear se quiseres)
  try {
    channels = await loadChannels();
  } catch (err) {
    console.error("Erro a recarregar canais no catálogo:", err);
  }

  const metas = channels.map(ch => ({
    id: ch.id,
    type: "tv",
    name: ch.name,
    poster: ch.poster
  }));

  console.timeEnd("catalogHandler");
  return { metas };
});

// Handler dos streams
builder.defineStreamHandler(({ id }) => {
  console.log("Pedido stream para id:", id);
  const channel = channels.find(ch => ch.id === id);
  if (!channel) {
    return { streams: [] };
  }
  return {
    streams: [
      {
        title: channel.name,
        url: channel.url,
        // usa o protocolo correto, geralmente HTTP/HTTPS
        protocol: "http",
        mimetype: "video/mp2t"
      }
    ]
  };
});

// Cria servidor HTTP (Railway vai fazer proxy HTTPS por fora)
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  builder.getInterface()(req, res);
});

server.listen(PORT, () => {
  console.log(`⚡️ A minha app vai ouvir na porta: ${PORT}`);
  console.log(`🚀 Addon a correr na porta ${PORT}`);
});
