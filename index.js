const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { fetchWithBypass } = require("./zenoplay");

const manifest = {
    id: "org.daniel.zenoplay",
    version: "1.0.0",
    name: "Daniel-zenoplay",
    description: "BG Audio Movies with CF Bypass",
    types: ["movie"],
    catalogs: [{ type: "movie", id: "bg-audio", name: "BG Audio" }],
    resources: ["catalog", "meta"]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async (args) => {
    const $ = await fetchWithBypass("https://zenoplay.to/genre/bg-audio/");
    if (!$) return { metas: [] };

    const metas = [];
    $('.movie-item').each((i, el) => {
        metas.push({
            id: $(el).find('a').attr('href'),
            name: $(el).find('.title').text(),
            type: 'movie',
            poster: $(el).find('img').attr('src')
        });
    });
    return { metas };
});

serveHTTP(builder.getInterface(), { port: 7000 });
