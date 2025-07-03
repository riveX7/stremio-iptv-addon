const express = require('express');
const fetch = require('node-fetch');
const { addonBuilder } = require('stremio-addon-sdk');

const app = express();
const PORT = process.env.PORT || 8080;

const M3U_URL = 'https://m3upt.com/iptv';

async function parseM3U(url) {
  const res = await fetch(url);
  const text = await res.text();

  const lines = text.split('\n');
  const channels = [];
  let currentTitle = null;
  let currentLogo = null;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#EXTINF')) {
      const titleMatch = line.match(/,(.*)$/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);

      currentTitle = titleMatch ? titleMatch[1].trim() : 'Canal sem nome';
      currentLogo = logoMatch ? logoMatch[1] : null;
    } else if (line && !line.startsWith('#')) {
      channels.push({
        name: currentTitle,
        logo: currentLogo,
        url: line
      });
      currentTitle = null;
      currentLogo = null;
    }
  }

  return channels;
}

const manifest = {
  id: 'org.miguel.m3upt',
  version: '1.0.0',
  name: 'Miguel IPTV M3UPT Addon',
  description: 'Addon IPTV com lista M3U da M3UPT para Stremio',
  resources: ['stream', 'catalog', 'meta'],
  types: ['tv'],
  idPrefixes: ['tt'],
  catalogs: [{
    type: 'tv',
    id: 'iptv',
    name: 'Canais M3UPT',
    extra: [{ name: 'search', isRequired: false }]
  }]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async () => {
  const channels = await parseM3U(M3U_URL);

  const metas = channels.map((channel, idx) => ({
    id: `tt${idx}`,
    type: 'tv',
    name: channel.name,
    poster: channel.logo || 'https://via.placeholder.com/256x144.png?text=Sem+Logo',
    description: '',
    releaseInfo: ''
  }));

  return { metas };
});

builder.defineMetaHandler(async ({ id }) => {
  const channels = await parseM3U(M3U_URL);
  const channel = channels.find((_, idx) => `tt${idx}` === id);

  if (!channel) return null;

  return {
    id,
    type: 'tv',
    name: channel.name,
    poster: channel.logo || 'https://via.placeholder.com/256x144.png?text=Sem+Logo',
    description: '',
    streams: [{
      title: channel.name,
      url: channel.url,
      type: 'live'
    }]
  };
});

app.use(builder.getMiddleware());

app.listen(PORT, () => {
  console.log(`🚀 Miguel IPTV Addon a correr na porta ${PORT}`);
});
