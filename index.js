const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const SCRAPER_API_KEY = "YOUR_SCRAPERAPI_KEY";
const BASE_URL = "https://zenoplay.to/genre/bg-audio/";

const builder = new addonBuilder({
    id: "org.daniel.zenoplay",
    version: "1.0.0",
    name: "Daniel-zenoplay",
    catalogs: [{ type: "movie", id: "bg-audio", name: "BG Audio" }],
    resources: ["catalog", "stream"],
    types: ["movie"]
});

builder.defineCatalogHandler(async (args) => {
    const targetUrl = http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(BASE_URL)};
    const { data } = await axios.get(targetUrl);
    const $ = cheerio.load(data);
    const metas = [];

    $('.ml-item').each((i, el) => {
        metas.push({
            id: "zeno_" + $(el).find('a').attr('href').split('/').pop(),
            name: $(el).find('.mli-info h2').text().trim(),
            poster: $(el).find('.mli-thumb img').attr('data-original'),
            type: 'movie'
        });
    });

    return { metas };
});

builder.defineStreamHandler(async (args) => {
    const id = args.id.replace("zeno_", "");
    const targetUrl = http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent("https://zenoplay.to/" + id)};
    const { data } = await axios.get(targetUrl);
    const $ = cheerio.load(data);
    
    // Extracting the iframe source for the player
    const streamUrl = $('iframe#iframe-embed').attr('src');
    
    return { streams: [{ title: "BG Audio", url: streamUrl }] };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
