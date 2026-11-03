const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const zeno = require('./zenoplay');

const manifest = {
  id: 'org.daniel.zenoplay',
  version: '1.0.0',
  name: 'Daniel-zenoplay',
  description: 'Всички филми от zenoplay.to – само с BG Player.',
  logo: 'https://zenoplay.to/wp-content/themes/zenoplay/assets/favicon/favicon-96x96.png',
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie'],
  idPrefixes: ['zeno:'],
  catalogs: [
    {
      type: 'movie',
      id: 'zenoplay-movies',
      name: 'Daniel-zenoplay – Филми',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'genre', isRequired: false, options: Object.keys(zeno.GENRES) },
        { name: 'skip', isRequired: false },
      ],
    },
    {
      type: 'movie',
      id: 'zenoplay-bg-audio',
      name: 'Daniel-zenoplay – БГ Аудио',
      extra: [{ name: 'skip', isRequired: false }],
    },
  ],
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ id, extra }) => {
  try {
    return { metas: await zeno.catalog(id, extra || {}), cacheMaxAge: 1800 };
  } catch (e) {
    console.error('catalog', id, e.message);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async ({ id }) => {
  try {
    return { meta: await zeno.meta(id), cacheMaxAge: 86400 };
  } catch (e) {
    console.error('meta', id, e.message);
    return { meta: null };
  }
});

builder.defineStreamHandler(async ({ id }) => {
  try {
    return { streams: await zeno.streams(id), cacheMaxAge: 1800 };
  } catch (e) {
    console.error('stream', id, e.message);
    return { streams: [] };
  }
});

const port = Number(process.env.PORT) || 7000;
serveHTTP(builder.getInterface(), { port });
console.log(`Daniel-zenoplay: http://127.0.0.1:${port}/manifest.json`);
