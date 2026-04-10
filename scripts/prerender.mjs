#!/usr/bin/env node
/**
 * Pre-render script for Carlorbiz website.
 *
 * After `vite build`, this script:
 * 1. Starts a local preview server serving the built dist/ folder
 * 2. Uses Puppeteer to visit each URL in the sitemap
 * 3. Waits for the SPA to render (accordion content, Nera viewer, etc.)
 * 4. Captures the fully-rendered HTML
 * 5. Saves it to dist/prerendered/<path>.html
 *
 * The Cloudflare Worker serves these snapshots to bot user agents.
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const PRERENDERED = resolve(ROOT, 'client', 'public', 'prerendered');
const SITEMAP = resolve(DIST, 'sitemap.xml');
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

// Extract URLs from sitemap
function extractUrls(sitemapPath) {
  const xml = readFileSync(sitemapPath, 'utf-8');
  const urls = [];
  const regex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

// Convert absolute URL to a file path for the prerendered snapshot
function urlToFilePath(url) {
  const u = new URL(url);
  let path = u.pathname;
  // Strip trailing slash
  if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
  // Handle hash-based deep links — flatten to parent page
  // (the accordion content is on the same page, just scrolled)
  const hash = u.hash;
  if (hash) {
    // e.g. /services#dais-framework → /services (same page, all accordions rendered)
    // We only need one snapshot per page, not per hash
    return path || '/index';
  }
  return path || '/index';
}

async function main() {
  console.log('🔍 Reading sitemap...');
  if (!existsSync(SITEMAP)) {
    console.error(`❌ Sitemap not found at ${SITEMAP}. Run 'vite build' first.`);
    process.exit(1);
  }

  const sitemapUrls = extractUrls(SITEMAP);
  console.log(`📄 Found ${sitemapUrls.length} URLs in sitemap`);

  // Deduplicate by page path (hash deep-links share the same page)
  const uniquePages = new Map();
  for (const url of sitemapUrls) {
    const u = new URL(url);
    const pagePath = u.pathname || '/';
    if (!uniquePages.has(pagePath)) {
      uniquePages.set(pagePath, url.replace('https://carlorbiz.com.au', ''));
    }
  }
  console.log(`📑 ${uniquePages.size} unique pages to render`);

  // Start preview server
  console.log('🚀 Starting preview server...');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host'], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: true,
  });

  // Wait for server to be ready
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('⏱️  Server timeout — proceeding anyway');
      resolve();
    }, 10000);

    server.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Local:') || msg.includes('localhost')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  // Small delay to ensure server is fully ready
  await new Promise((r) => setTimeout(r, 2000));

  console.log('🌐 Launching browser...');
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  mkdirSync(PRERENDERED, { recursive: true });

  let rendered = 0;
  for (const [pagePath, localPath] of uniquePages) {
    const url = `${BASE_URL}${localPath.split('#')[0]}`;
    const filePath = resolve(PRERENDERED, pagePath === '/' ? 'index.html' : `${pagePath.slice(1)}.html`);

    // Ensure directory exists
    mkdirSync(dirname(filePath), { recursive: true });

    console.log(`  📸 Rendering ${pagePath}...`);
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait for accordion content to render (CMS data loads async)
      await page.waitForSelector('[data-state]', { timeout: 10000 }).catch(() => {});
      // Extra wait for any lazy content
      await new Promise((r) => setTimeout(r, 1000));

      // Get the full rendered HTML
      let html = await page.content();

      // Inject a meta tag so we can detect pre-rendered pages
      html = html.replace(
        '</head>',
        '<meta name="prerender-status" content="rendered">\n</head>'
      );

      writeFileSync(filePath, html, 'utf-8');
      rendered++;
      console.log(`    ✅ Saved (${Math.round(html.length / 1024)}KB)`);
      await page.close();
    } catch (err) {
      console.error(`    ❌ Failed: ${err.message}`);
    }
  }

  await browser.close();
  server.kill();

  console.log(`\n✨ Pre-rendered ${rendered}/${uniquePages.size} pages to ${PRERENDERED}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
