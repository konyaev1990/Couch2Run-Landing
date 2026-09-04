"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const articlesDir = path.join(root, "articles");
const blogDir = path.join(root, "blog");

const escapeHtml = (value) => String(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));

function inline(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown) {
  const lines = markdown.trim().split(/\r?\n/);
  const html = [];
  let list = null;
  let paragraph = [];
  const closeParagraph = () => { if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`); paragraph = []; };
  const closeList = () => { if (list) html.push(`</${list}>`); list = null; };
  for (const line of lines) {
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) { closeParagraph(); closeList(); html.push(`<h2>${inline(heading[1])}</h2>`); }
    else if (unordered || ordered) { closeParagraph(); const type = unordered ? "ul" : "ol"; if (list !== type) { closeList(); html.push(`<${type}>`); list = type; } html.push(`<li>${inline((unordered || ordered)[1])}</li>`); }
    else if (!line.trim()) { closeParagraph(); closeList(); }
    else paragraph.push(line.trim());
  }
  closeParagraph(); closeList();
  return html.join("\n");
}

function parseArticle(filename) {
  const source = fs.readFileSync(path.join(articlesDir, filename), "utf8");
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: добавьте YAML-блок между строками ---`);
  const meta = Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const separator = line.indexOf(":");
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^"|"$/g, "")];
  }));
  for (const field of ["title", "description", "date", "slug"]) if (!meta[field]) throw new Error(`${filename}: не заполнено поле ${field}`);
  if (!/^[a-z0-9-]+$/.test(meta.slug)) throw new Error(`${filename}: slug содержит только латиницу, цифры и дефисы`);
  return { ...meta, body: markdownToHtml(match[2]) };
}

function layout({ title, description, content, depth }) {
  const prefix = "../".repeat(depth);
  const metrikaCode = `  <!-- Yandex.Metrika counter -->\n  <script type="text/javascript">\n    (function(m,e,t,r,i,k,a){\n      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};\n      m[i].l=1*new Date();\n      for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }\n      k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)\n    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=112170318", "ym");\n    ym(112170318, "init", { ssr: true, webvisor: true, clickmap: true, ecommerce: "dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce: true, trackLinks: true });\n  </script>\n  <!-- /Yandex.Metrika counter -->`;
  const metrikaFallback = `  <noscript><div><img src="https://mc.yandex.ru/watch/112170318" style="position:absolute; left:-9999px;" alt=""></div></noscript>`;
  return `<!doctype html>\n<html lang="ru">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${escapeHtml(title)} | Couch2Run</title>\n  <meta name="description" content="${escapeHtml(description)}">\n  <link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml">\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">\n  <link rel="stylesheet" href="${prefix}blog.css">\n${metrikaCode}\n</head>\n<body>\n${metrikaFallback}\n  <header class="blog-header"><div class="blog-header__inner"><a class="blog-logo" href="${prefix}index.html">Couch2Run</a></div></header>\n  <main class="blog-main">${content}</main>\n</body>\n</html>\n`;
}

fs.mkdirSync(blogDir, { recursive: true });
const articles = fs.readdirSync(articlesDir).filter((file) => file.endsWith(".md") && file !== "README.md").map(parseArticle).sort((a, b) => b.date.localeCompare(a.date));
for (const article of articles) {
  const articleDir = path.join(blogDir, article.slug);
  fs.mkdirSync(articleDir, { recursive: true });
  const content = `<a href="../index.html">← Все статьи</a><p class="blog-kicker">БЕГ ДЛЯ НАЧИНАЮЩИХ</p><h1>${escapeHtml(article.title)}</h1><p class="blog-lead">${escapeHtml(article.description)}</p><p class="blog-date">${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${article.date}T12:00:00`))}</p><article class="article">${article.body}</article><p class="article-cta">Хотите тренироваться с понятным планом? <a href="../../index.html#contacts">Запишитесь на тренировку</a>.</p>`;
  fs.writeFileSync(path.join(articleDir, "index.html"), layout({ ...article, content, depth: 2 }));
}
const cards = articles.map((article) => `<a class="article-card" href="${article.slug}/"><span class="blog-date">${escapeHtml(article.date)}</span><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.description)}</p></a>`).join("\n");
fs.writeFileSync(path.join(blogDir, "index.html"), layout({ title: "Статьи о беге", description: "Практические статьи Couch2Run о беге и тренировках.", content: `<a href="../index.html">← На главную</a><p class="blog-kicker">COUCH2RUN JOURNAL</p><h1>Статьи о беге</h1><p class="blog-lead">Практические рекомендации, которые помогут бегать регулярно и с удовольствием.</p><section class="article-list">${cards}</section>`, depth: 1 }));
console.log(`Готово: ${articles.length} статей в папке blog/.`);
