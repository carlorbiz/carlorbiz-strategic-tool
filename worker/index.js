/**
 * Cloudflare Worker — Bot-aware pre-rendering for Carlorbiz SPA.
 *
 * Human visitors → normal SPA (Cloudflare Pages)
 * Bot visitors → pre-rendered HTML snapshot (fully rendered content)
 *
 * This ensures AI search engines (Google AI Overviews, Perplexity, ChatGPT Search)
 * and social media preview crawlers see all accordion content, essays, and Nera
 * descriptions without needing to execute JavaScript.
 */

const BOT_AGENTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
  'whatsapp', 'slackbot', 'telegrambot', 'discordbot',
  'perplexitybot', 'chatgpt-user', 'claude-web', 'anthropic-ai',
  'gptbot', 'google-extended', 'ccbot', 'applebot',
  'amazonbot', 'bytespider',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = (request.headers.get('user-agent') || '').toLowerCase();

    // Only intercept for bot user agents on page routes (not assets)
    const isBot = BOT_AGENTS.some(bot => ua.includes(bot));
    const isPageRoute = !url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|map|json|xml|txt|pdf|mp4|webm)$/i);

    if (isBot && isPageRoute) {
      // Map the URL path to the pre-rendered file
      let prerenderPath = url.pathname;
      if (prerenderPath === '/' || prerenderPath === '') {
        prerenderPath = '/index';
      }
      // Strip trailing slash
      if (prerenderPath.endsWith('/') && prerenderPath.length > 1) {
        prerenderPath = prerenderPath.slice(0, -1);
      }

      const prerenderUrl = `${url.origin}/prerendered${prerenderPath}.html`;

      try {
        const prerenderResponse = await fetch(prerenderUrl);
        if (prerenderResponse.ok) {
          const html = await prerenderResponse.text();
          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'X-Prerender': 'true',
              'Cache-Control': 'public, max-age=86400', // 24hr cache
            },
          });
        }
      } catch {
        // Pre-rendered version not available — fall through to SPA
      }
    }

    // Human visitors (or no pre-render available) — pass through to Pages
    return fetch(request);
  },
};
