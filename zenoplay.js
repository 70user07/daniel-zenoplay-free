// Scraper for zenoplay.to (WordPress theme "zenoplay").
const BASE = 'https://zenoplay.to';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const PAGE_SIZE = 24;
const CACHE_TTL = 30 * 60 * 1000;

const cache = new Map();

async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': UA, 'Accept-Language': 'bg-BG,bg;q=0.9', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

function decode(s = '') {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8211;/g, '–').replace(/&#8217;/g, '’')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .trim();
}

// "https://zenoplay.to/movie/matricata-1999/" -> "matricata-1999"
const slugFromUrl = (url) => url.replace(/\/+$/, '').split('/').pop();
const toId = (slug) => `zeno:${slug}`;
const fromId = (id) => id.replace(/^zeno:/, '');
const movieUrl = (slug) => `${BASE}/movie/${slug}/`;

function parseCards(html) {
  const out = [];
  const re = /<a class="media-card" href="([^"]+)">([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, href, body] = m;
    if (!href.includes('/movie/')) continue; // only movies, skip tv shows
    const slug = slugFromUrl(href);
    const poster = body.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const name = decode(body.match(/<div class="media-title">([\s\S]*?)<\/div>/)?.[1]);
    const year = body.match(/<span class="media-year">(\d{4})<\/span>/)?.[1];
    out.push({ id: toId(slug), type: 'movie', name, poster, releaseInfo: year, posterShape: 'poster' });
  }
  return out;
}

async function listPage(path, page) {
  const url = page > 1 ? `${BASE}${path}page/${page}/` : `${BASE}${path}`;
  return cached(url, async () => {
    try {
      return parseCards(await fetchText(url));
    } catch (e) {
      if (String(e.message).includes('HTTP 404')) return []; // past the last page
      throw e;
    }
  });
}

async function catalog(catalogId, { skip = 0, search, genre } = {}) {
  if (search) {
    const url = `${BASE}/?s=${encodeURIComponent(search)}`;
    return cached(url, async () => parseCards(await fetchText(url)));
  }
  const page = Math.floor(Number(skip) / PAGE_SIZE) + 1;
  let path = '/movies/';
  if (catalogId === 'zenoplay-bg-audio') path = '/genre/bg-audio/';
  if (genre && GENRES[genre]) path = `/genre/${GENRES[genre]}/`;
  return listPage(path, page);
}

async function moviePage(slug) {
  const url = movieUrl(slug);
  return cached(`page:${url}`, () => fetchText(url));
}

async function meta(id) {
  const slug = fromId(id);
  const html = await moviePage(slug);
  const pick = (re) => html.match(re)?.[1];
  const genres = [...(pick(/<div class="chip-row genre-chip-row">([\s\S]*?)<\/div>/) || '').matchAll(/>([^<]+)<\/a>/g)].map((g) => decode(g[1]));
  const runtime = pick(/<span>(\d+ min)<\/span>/);
  const rating = pick(/rating-pill">★\s*([\d.]+)/);
  return {
    id,
    type: 'movie',
    name: decode(pick(/<h1>([\s\S]*?)<\/h1>/)) || slug,
    poster: pick(/class="detail-poster" src="([^"]+)"/),
    background: pick(/--detail-bg:url\('([^']+)'\)/),
    description: decode(pick(/<p class="detail-overview[^"]*">([\s\S]*?)<\/p>/)),
    releaseInfo: pick(/class="detail-year-link"[^>]*>(\d{4})</),
    runtime,
    imdbRating: rating,
    genres,
    country: decode(pick(/<div class="detail-country">Country:\s*([^<]+)<\/div>/)),
    website: movieUrl(slug),
  };
}

// Returns the providers list from the site's player AJAX endpoint.
async function providers(slug) {
  const url = movieUrl(slug);
  const html = await moviePage(slug);
  const postId = html.match(/data-post-id="(\d+)"/)?.[1];
  const token = html.match(/data-player-token="([^"]+)"/)?.[1];
  if (!postId || !token) return [];
  const body = await fetchText(`${BASE}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: url,
      Origin: BASE,
    },
    body: new URLSearchParams({ action: 'zenoplay_player_sources', post_id: postId, token }).toString(),
  });
  const json = JSON.parse(body);
  return (json?.data?.providers || []).filter((p) => p && p.enabled !== false && p.url);
}

async function streams(id) {
  const slug = fromId(id);
  const list = await cached(`prov:${slug}`, () => providers(slug));
  // Only the Bulgarian players (group "bg", e.g. "BG Player").
  const bg = list.filter((p) => String(p.group || '').toLowerCase() === 'bg');
  // The BG player embed only works inside zenoplay.to, so the stream opens the
  // movie page, where the site auto-selects the BG player first.
  return bg.map((p) => ({
    name: 'Daniel-zenoplay',
    title: `🇧🇬 ${p.name}`,
    externalUrl: `${movieUrl(slug)}#player`,
  }));
}

// Display name -> site slug for the genre filter.
const GENRES = {
  'БГ Аудио': 'bg-audio', 'Комедия': 'comedy', 'Романтичен': 'romance', 'Драма': 'drama',
  'Анимация': 'animation', 'Екшън': 'action', 'Приключенски': 'adventure', 'Криминален': 'crime',
  'Научна фантастика': 'science-fiction', 'Фентъзи': 'fantasy', 'Мистерия': 'mystery',
  'Ужаси': 'horror', 'Трилър': 'thriller', 'Коледни': 'christmas', 'Семеен': 'family',
  'Военен': 'war', 'Музикален': 'music', 'Уестърн': 'western', 'Исторически': 'history',
  'Документален': 'documentary', 'Детски': 'kids',
};

module.exports = { catalog, meta, streams, GENRES };
