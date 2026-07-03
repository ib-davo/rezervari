<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="ro">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>Sitemap XML — DAVO Group</title>
        <style>
          :root {
            --navy-900: #0b2653;
            --red-500: #e11e2b;
            --red-400: #ee2c3a;
            --ink-50:  #f5f7fb;
            --ink-100: #eef2f8;
            --ink-200: #d6dde9;
            --ink-300: #9aa6b8;
            --ink-500: #5b6677;
            --ink-700: #2c3a4f;
            --success: #10c49b;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
              Helvetica, Arial, sans-serif;
            background: var(--ink-50);
            color: var(--ink-700);
            line-height: 1.5;
          }
          .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
          header.hero {
            background: var(--navy-900);
            color: #fff;
            border-radius: 24px;
            padding: 32px 28px;
            position: relative;
            overflow: hidden;
            margin-bottom: 28px;
          }
          header.hero::before {
            content: '';
            position: absolute; left: 0; top: 0;
            width: 6px; height: 100%;
            background: var(--red-500);
          }
          .eyebrow {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.32em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.7);
            margin-bottom: 14px;
          }
          h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.01em;
          }
          h1 span { color: #ff6b75; }
          .lede {
            margin-top: 12px;
            color: rgba(255,255,255,0.78);
            font-size: 15px;
            max-width: 60ch;
          }
          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 22px;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 700;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.18);
            color: #fff;
            padding: 6px 12px;
            border-radius: 999px;
          }
          .badge strong { color: #ff8a92; }
          .actions { margin-top: 22px; display: flex; gap: 10px; flex-wrap: wrap; }
          .btn {
            display: inline-flex; align-items: center; gap: 6px;
            text-decoration: none; font-weight: 700; font-size: 13px;
            padding: 10px 18px; border-radius: 999px;
          }
          .btn-primary { background: var(--red-500); color: #fff; }
          .btn-secondary { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); }

          .panel {
            background: #fff;
            border: 1px solid var(--ink-200);
            border-radius: 20px;
            overflow: hidden;
          }
          .panel-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 18px 22px;
            border-bottom: 1px solid var(--ink-100);
          }
          .panel-head h2 {
            margin: 0;
            font-size: 16px;
            color: var(--navy-900);
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          .panel-head .count {
            font-size: 12px; color: var(--ink-500); font-weight: 600;
          }
          table {
            width: 100%; border-collapse: collapse;
            font-size: 13px;
          }
          thead th {
            text-align: left;
            background: var(--ink-50);
            color: var(--ink-500);
            font-weight: 700;
            font-size: 11px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            padding: 10px 16px;
            border-bottom: 1px solid var(--ink-200);
          }
          tbody td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--ink-100);
            vertical-align: top;
          }
          tbody tr:last-child td { border-bottom: none; }
          tbody tr:hover { background: var(--ink-50); }
          a.url {
            color: var(--red-500);
            text-decoration: none;
            font-weight: 600;
            word-break: break-all;
          }
          a.url:hover { text-decoration: underline; }
          .col-num { color: var(--ink-300); width: 1%; white-space: nowrap; font-variant-numeric: tabular-nums; }
          .col-priority { width: 1%; white-space: nowrap; }
          .col-freq { width: 1%; white-space: nowrap; }
          .col-mod { width: 1%; white-space: nowrap; color: var(--ink-500); }
          .pill {
            display: inline-block;
            font-size: 11px; font-weight: 700;
            padding: 3px 9px; border-radius: 999px;
            background: var(--ink-100); color: var(--ink-700);
          }
          .pill.weekly { background: #d8f5ec; color: #0d8a6c; }
          .pill.monthly { background: #e6edfc; color: #2e57c0; }
          .pill.daily { background: #fde6e8; color: #c9192a; }
          .pill.yearly { background: #fff2d6; color: #8a5a08; }
          .pri {
            display: inline-flex; align-items: center; gap: 8px;
            font-size: 12px; font-weight: 700; color: var(--navy-900);
          }
          .bar {
            width: 60px; height: 6px; border-radius: 999px;
            background: var(--ink-100); overflow: hidden;
          }
          .bar > i {
            display: block; height: 100%;
            background: linear-gradient(90deg, var(--red-400), var(--red-500));
          }
          footer {
            margin-top: 28px;
            text-align: center;
            font-size: 12px;
            color: var(--ink-500);
          }
          @media (max-width: 640px) {
            h1 { font-size: 24px; }
            .col-mod, .col-freq, thead th.col-mod, thead th.col-freq { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <header class="hero">
            <div class="eyebrow">DAVO Group · Sitemap XML</div>
            <h1>Toate paginile, <span>navigabile</span></h1>
            <p class="lede">
              Aceasta este versiunea XML a sitemap-ului, citită de motoarele de căutare.
              Pentru o privire centrată pe utilizator, vezi <a href="/harta-site" style="color:#ff8a92;">harta site-ului</a>.
            </p>
            <div class="meta">
              <span class="badge"><strong><xsl:value-of select="count(s:urlset/s:url)"/></strong> URL-uri</span>
              <span class="badge">Stylesheet XSLT</span>
              <span class="badge">UTF-8</span>
            </div>
            <div class="actions">
              <a class="btn btn-primary" href="/harta-site">Vezi harta site →</a>
              <a class="btn btn-secondary" href="/">DAVO Group</a>
            </div>
          </header>

          <section class="panel">
            <div class="panel-head">
              <h2>URL-uri indexate</h2>
              <span class="count"><xsl:value-of select="count(s:urlset/s:url)"/> înregistrări</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th class="col-num">#</th>
                  <th>URL</th>
                  <th class="col-priority">Prioritate</th>
                  <th class="col-freq">Frecvență</th>
                  <th class="col-mod">Modificat</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="s:urlset/s:url">
                  <tr>
                    <td class="col-num"><xsl:value-of select="position()"/></td>
                    <td>
                      <a class="url" target="_blank" rel="noopener">
                        <xsl:attribute name="href"><xsl:value-of select="s:loc"/></xsl:attribute>
                        <xsl:value-of select="s:loc"/>
                      </a>
                    </td>
                    <td class="col-priority">
                      <span class="pri">
                        <xsl:value-of select="s:priority"/>
                        <span class="bar">
                          <i>
                            <xsl:attribute name="style">
                              width: <xsl:value-of select="number(s:priority) * 100"/>%;
                            </xsl:attribute>
                          </i>
                        </span>
                      </span>
                    </td>
                    <td class="col-freq">
                      <span>
                        <xsl:attribute name="class">pill <xsl:value-of select="s:changefreq"/></xsl:attribute>
                        <xsl:value-of select="s:changefreq"/>
                      </span>
                    </td>
                    <td class="col-mod"><xsl:value-of select="substring(s:lastmod, 1, 10)"/></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </section>

          <footer>
            © DAVO GROUP SRL · sitemap generat automat · stilizat cu XSLT
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
