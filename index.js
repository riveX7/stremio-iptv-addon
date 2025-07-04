const express = require('express');
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const NodeCache = require('node-cache');

// Config
const M3U_URL = 'https://m3upt.com/iptv';
const PORT = process.env.PORT || 8080;
const FETCH_INTERVAL = parseInt(process.env.FETCH_INTERVAL) || 86400000; // 1 dia
const FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT) || 10000;

const app = express();
const cache = new NodeCache(); // TTL dinâmico

// Manifesto base
const manifest = {
	id: 'pt.iptv',
	version: '1.0.0',
	name: 'IPTV Portugal',
	description: 'Canais de televisão portugueses em direto',
	resources: ['catalog', 'meta', 'stream'],
	types: ['tv'],
	catalogs: [
		{
			type: 'tv',
			id: 'iptv-pt',
			name: 'Canais Portugueses',
		},
	],
	idPrefixes: ['pt-iptv-'],
	logo: 'https://cdn6.aptoide.com/imgs/9/1/d/91df98a9ef9df7f4377e24e7b9b9e20a_icon.png',
	background: 'https://img.freepik.com/free-photo/living-room-with-tv-sofas-blurred_1203-1104.jpg',
	icon: 'https://cdn6.aptoide.com/imgs/9/1/d/91df98a9ef9df7f4377e24e7b9b9e20a_icon.png',
	behaviorHints: {
		configurable: false,
		configurationRequired: false
	}
};

const addon = new addonBuilder(manifest);

// Função para fazer parse do ficheiro M3U
const parseM3U = (raw) => {
	const lines = raw.split('\n');
	const channels = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		if (line.startsWith('#EXTINF')) {
			const nameMatch = line.match(/,(.*)$/);
			const logoMatch = line.match(/tvg-logo="([^"]+)"/);

			const name = nameMatch ? nameMatch[1] : 'Canal Desconhecido';
			const logo = logoMatch ? logoMatch[1] : null;
			const url = lines[i + 1]?.trim();

			if (url && url.startsWith('http')) {
				channels.push({
					id: 'pt-iptv-' + Buffer.from(name).toString('base64'),
					name,
					logo,
					url
				});
			}
		}
	}
	return channels;
};

// Função para obter canais (com cache)
const fetchChannels = async () => {
	if (cache.has('channels')) {
		return cache.get('channels');
	}

	try {
		console.log('A obter lista M3U...');
		const res = await axios.get(M3U_URL, { timeout: FETCH_TIMEOUT });
		const channels = parseM3U(res.data);
		cache.set('channels', channels, FETCH_INTERVAL / 1000);
		console.log(`Foram carregados ${channels.length} canais.`);
		return channels;
	} catch (err) {
		console.error('Erro ao obter M3U:', err.message);
		return cache.get('channels') || [];
	}
};

// Catalog Handler
addon.defineCatalogHandler(async () => {
	const channels = await fetchChannels();

	const metas = channels.map((channel) => ({
		id: channel.id,
		type: 'tv',
		name: channel.name,
		poster: channel.logo,
		posterShape: 'square',
		logo: channel.logo,
		background: channel.logo,
	}));

	return { metas };
});

// Meta Handler
addon.defineMetaHandler(async ({ id }) => {
	const channels = await fetchChannels();
	const channel = channels.find((c) => c.id === id);

	if (!channel) return { meta: {} };

	return {
		meta: {
			id: channel.id,
			type: 'tv',
			name: channel.name,
			poster: channel.logo,
			posterShape: 'square',
			logo: channel.logo,
			background: channel.logo,
		},
	};
});

// Stream Handler
addon.defineStreamHandler(async ({ id }) => {
	const channels = await fetchChannels();
	const channel = channels.find((c) => c.id === id);

	if (!channel) return { streams: [] };

	return {
		streams: [
			{
				title: 'Live',
				url: channel.url,
			},
		],
	};
});

// Endpoint do manifesto
app.get('/manifest.json', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify(manifest));
});

serveHTTP(addon.getInterface(), { server: app, path: '/manifest.json', port: PORT });
