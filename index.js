const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const http = require("http");

// Manifesto do addon
const manifest = {
  id: "community.iptvaddon.pt",
  version: "1.0.0",
  name: "IPTV Portugal (M3UPT)",
  description: "Addon para ver canais IPTV via M3UPT",
  resources: ["catalog", "stream"],
  types: ["tv"],
  idPrefixes: ["iptvpt_"],
  catalogs: [
    {
      type: "tv",
      id: "iptv-catalog",
      name: "Canais M3UPT",
      extra: []
    }
  ]
};

const builder = new addonBuilder(manifest);

let channels = [];

async function loadChannels() {
  try {
    const res = await fetch("https://m3upt.com/iptv");
    const text = await res.text();
    const lines = text.split("\n");
    let currentName = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("#EXTINF")) {
        const match = line.match(/,(.*)/);
        if (match) currentName = match[1].trim();
      } else if (line.startsWith("http")) {
        const url = line.trim();
        channels.push({
          name: currentName || "Canal IPTV",
          url,
          id: "iptvpt_" + Buffer.from(url).toString("base64")
        });
      }
    }

    console.log(`✅ ${channels.length} canais carregados da M3UPT`);
  } catch (err) {
    console.error("❌ Erro a carregar lista M3U:", err);
  }
}

loadChannels();

builder.defineCatalogHandler(({ type, id }) => {
  if (type !== "tv" || id !== "iptv-catalog") return { metas: [] };
  return {
    metas: channels.map(channel => ({
      id: channel.id,
      type: "tv",
      name: channel.name,
      poster: "https://img.icons8.com/color/240/tv.png"
    }))
  };
});

builder.defineStreamHandler(({ id }) => {
  const ch = channels.find(c => c.id === id);
  if (!ch) return { streams: [] };

  return {
    streams: [{
      title: ch.name,
      url: ch.url,
      isFree: true
    }]
  };
});

const PORT = process.env.PORT || 8080;
console.log(`⚡️ A minha app vai ouvir na porta: ${PORT}`);

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  builder.getInterface()(req, res);
});

server.listen(PORT, () => {
  console.log(`🚀 Addon a correr na porta ${PORT}`);
});
