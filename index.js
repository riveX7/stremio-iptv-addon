const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const http = require("http");

const M3U_URL = "https://m3upt.com/iptv";

const manifest = {
  id: "org.miguel.iptv",
  version: "1.0.0",
  name: "Miguel IPTV Addon",
  description: "Addon IPTV usando lista M3U do M3UPT",
  resources: ["catalog", "stream"],
  types: ["tv"],
  catalogs: [{ type: "tv", id: "iptv" }],
  idPrefixes: ["iptv:"],
};

const builder = new addonBuilder(manifest);

let channels = [];

async function loadChannels() {
  console.log("🔄 A carregar canais da M3U...");
  try {
    const res = await fetch(M3U_URL);
    const text = await res.text();

    const lines = text.split("\n");
    channels = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXTINF")) {
        const info = lines[i];
        const url = lines[i + 1]?.trim();
        if (!url) continue;

        const nameMatch = info.match(/,(.+)$/);
        const name = nameMatch ? nameMatch[1] : "Unknown";

        // Criar um id simples para o canal
        const id = "iptv:" + encodeURIComponent(name.toLowerCase().replace(/\s/g, "-"));

        channels.push({
          id,
          name,
          type: "tv",
          poster: "", // podes colocar poster default se quiseres
          url,
        });
      }
    }

    console.log(`✅ ${channels.length} canais carregados da M3UPT`);
  } catch (e) {
    console.error("Erro a carregar canais:", e);
  }
}

// Catalog
builder.defineCatalogHandler(({ type, id }) => {
  if (type !== "tv" || id !== "iptv") {
    return Promise.resolve({ metas: [] });
  }
  return Promise.resolve({ metas: channels });
});

// Streams
builder.defineStreamHandler(({ id }) => {
  const channel = channels.find((ch) => ch.id === id);
  if (!channel) {
    return Promise.resolve({ streams: [] });
  }
  return Promise.resolve({
    streams: [
      {
        title: channel.name,
        url: channel.url,
        isRemote: true,
      },
    ],
  });
});

const PORT = process.env.PORT || 8080;

loadChannels().then(() => {
  const server = http.createServer(builder.getInterface());
  server.listen(PORT, () => {
    console.log(`🚀 Addon a correr na porta ${PORT}`);
  });
});
