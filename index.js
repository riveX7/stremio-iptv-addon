const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const http = require("http");

const PORT = process.env.PORT || 8080;
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

builder.defineCatalogHandler(() => {
  const metas = channels.map((ch) => ({
    id: ch.id,
    type: "tv",
    name: ch.name,
    poster: ch.poster,
  }));
  return Promise.resolve({ metas });
});

builder.defineStreamHandler(({ id }) => {
  const channel = channels.find((ch) => ch.id === id);
  if (!channel) return Promise.resolve({ streams: [] });

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

// Criar o servidor imediatamente
const server = http.createServer(builder.getInterface());

server.listen(PORT, () => {
  console.log(`🚀 Addon a correr na porta ${PORT}`);
});

// Carregar canais em background (não bloqueia o Railway)
(async () => {
  try {
    console.log("🔄 A carregar canais da M3U...");
    const res = await fetch(M3U_URL);
    const text = await res.text();

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXTINF")) {
        const name = lines[i].split(",")[1]?.trim() || "Desconhecido";
        const url = lines[i + 1]?.trim();
        if (!url) continue;

        channels.push({
          id: "iptv:" + encodeURIComponent(name.toLowerCase().replace(/\s/g, "-")),
          name,
          type: "tv",
          poster: "https://img.icons8.com/color/240/tv.png",
          url,
        });
      }
    }

    console.log(`✅ ${channels.length} canais carregados da M3UPT`);
  } catch (err) {
    console.error("❌ Erro a carregar canais:", err);
  }
})();
