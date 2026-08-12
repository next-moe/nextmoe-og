import { Hono } from 'hono';
import { log } from '../log';
import { renderService } from '../render/renderer';
import { allTemplates, getTemplate } from '../templates';
import { OG_BRAND, escapeHtml, palette } from '../templates/layout';

export const previewRoutes = new Hono();

const samples = () =>
  Object.fromEntries(allTemplates().map((t) => [t.name, t.sample as unknown as object]));

const page = (): string => {
  const names = allTemplates().map((t) => t.name);
  const options = names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`);
  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(OG_BRAND)} OG preview</title>
<style>
  body { margin:0; background:${palette.bg}; color:${palette.fg};
         font-family: ui-sans-serif, system-ui, "Noto Sans SC", sans-serif; }
  main { display:flex; gap:24px; padding:24px; align-items:flex-start; flex-wrap:wrap; }
  .panel { display:flex; flex-direction:column; gap:12px; width:440px; }
  select, textarea, button { font:inherit; background:${palette.surface}; color:${palette.fg};
         border:1px solid ${palette.line}; border-radius:8px; padding:10px 12px; }
  textarea { min-height:340px; font-family: ui-monospace, monospace; font-size:13px; line-height:1.55; }
  button { background:${palette.primary}; border-color:${palette.primary}; color:#fff;
           font-weight:700; cursor:pointer; }
  .stage { flex:1; min-width:600px; display:flex; flex-direction:column; gap:12px; }
  img { width:100%; max-width:1200px; border:1px solid ${palette.line}; border-radius:8px; display:block; }
  .status { color:${palette.muted}; font-size:14px; min-height:20px; }
  .status.err { color:${palette.secondary}; }
</style>
</head>
<body>
<main>
  <div class="panel">
    <select id="tpl">${options.join('')}</select>
    <textarea id="fields" spellcheck="false"></textarea>
    <button id="go">Render</button>
    <div class="status" id="status"></div>
  </div>
  <div class="stage"><img id="out" alt="" /></div>
</main>
<script>
const SAMPLES = ${JSON.stringify(samples())};
const tpl = document.getElementById('tpl');
const fields = document.getElementById('fields');
const out = document.getElementById('out');
const status = document.getElementById('status');
let objectUrl = null;

const fill = () => { fields.value = JSON.stringify(SAMPLES[tpl.value], null, 2); };

const draw = async () => {
  let body;
  try { body = JSON.parse(fields.value); }
  catch (e) { status.className = 'status err'; status.textContent = 'JSON: ' + e.message; return; }
  status.className = 'status';
  status.textContent = 'rendering…';
  const started = performance.now();
  const res = await fetch('/preview/render/' + encodeURIComponent(tpl.value), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    status.className = 'status err';
    status.textContent = res.status + ' ' + (await res.text());
    return;
  }
  const blob = await res.blob();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(blob);
  out.src = objectUrl;
  status.textContent = Math.round(performance.now() - started) + ' ms · ' +
    (blob.size / 1024).toFixed(1) + ' KiB · ' + blob.type;
};

tpl.addEventListener('change', () => { fill(); draw(); });
document.getElementById('go').addEventListener('click', draw);
fields.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') draw();
});
fill();
draw();
</script>
</body>
</html>`;
};

previewRoutes.get('/', (c) => c.html(page()));
previewRoutes.get('/index.html', (c) => c.html(page()));

previewRoutes.post('/render/:template', async (c) => {
  const template = getTemplate(c.req.param('template'));
  if (!template) return c.text('unknown_template', 404);
  const body = await c.req.json().catch(() => null);
  const parsed = template.schema.safeParse(body);
  if (!parsed.success) return c.text(JSON.stringify(parsed.error.issues, null, 2), 400);
  try {
    const drawn = await renderService.draw(template, parsed.data as never);
    return c.body(new Uint8Array(drawn.body), 200, {
      'Content-Type': drawn.contentType,
      'Cache-Control': 'no-store',
    });
  } catch (e) {
    log.error({ err: (e as Error).message, template: template.name }, 'preview render failed');
    return c.text((e as Error).message, 500);
  }
});
