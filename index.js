const express = require("express");
const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

const PORT = process.env.PORT || 8080;
const M3U_URL = "https://m3upt.com/iptv";

const manifest = {
  id: "org.miguel.iptv",
  version: "1.0.0",
  name: "Miguel IPTV Addon",
  description: "Addon IPTV com lista M3U do M3UPT",
  resources: ["catalog", "stream"],
  types: ["tv"],
  catalogs: [{ type: "tv", id: "iptv" }],
  idPrefixes: ["iptv:"],
};

let channels = [];

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(() => {
  console.log("📦 Pedido de catálogo recebido");
  if (!channels.length) {
    console.warn("⚠️ Ainda sem canais carregados!");
    return Promise.resolve({ metas: [] });
  }

  const metas = channels.map((ch) => ({
    id: ch.id,
    type: "tv",
    name: ch.name,
    poster: ch.poster,
  }));

  return Promise.resolve({ metas });
});

builder.defineStreamHandler(({ id }) => {
  console.log(`🎥 Pedido de stream para ${id}`);
  const channel = channels.find((ch) => ch.id === id);
  if (!channel) return Promise.resolve({ streams: [] });

  return Promise.resolve({
    streams: [{ title: channel.name, url: channel.url, isRemote: true }],
  });
});

async function loadChannels() {
  try {
    console.log("🔄 A carregar canais da M3U...");
    const res = await fetch(M3U_URL);
    const text = await res.text();
    const lines = text.split("\n");

    channels = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXTINF")) {
        const name = lines[i].split(",")[1]?.trim() || "Sem Nome";
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
    console.error("❌ Erro ao carregar canais:", err);
  }
}

// 🔧 Express + builder
const app = express();

app.use((req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    builder.getInterface()(req, res);
  } catch (err) {
    console.error("❌ ERRO INTERNO A RESPONDER:", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Addon a correr na porta ${PORT}`);
  await loadChannels();
});
