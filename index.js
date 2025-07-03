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
  resources: ['stream', 'c]()
