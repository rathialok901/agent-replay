// Renders a timeline (plus an optional recap) into one self-contained HTML file (no network requests).
import { agentLabel } from './adapters/index.js';
import { toolSummary } from './summary.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Escapes recap text and turns step citations like [#12] into links to that step.
const cite = (s) => esc(s).replace(/\[#(\d+)\]/g, '<a class="cite" href="#e$1">#$1</a>');

const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));

function renderRecap(recap) {
  if (!recap) return '';
  const sections = (recap.sections ?? [])
    .filter((s) => s?.items?.length)
    .map((s) => `<h3>${esc(s.heading)}</h3><ul>${s.items.map((i) => `<li>${cite(typeof i === 'string' ? i : JSON.stringify(i))}</li>`).join('')}</ul>`)
    .join('');
  return `<section class="recap"><div class="rk">Recap${recap.type ? ' · ' + esc(recap.type) : ''}</div>
${recap.tldr ? `<p class="tldr">${cite(recap.tldr)}</p>` : ''}${sections}</section>`;
}

function truncate(s, max = 20000) {
  if (!s || s.length <= max) return s;
  return s.slice(0, max) + `\n\n… [${s.length - max} more characters truncated]`;
}

function tokenBadge(t) {
  if (!t) return '';
  return `<span class="tok" title="input ${t.input} · output ${t.output} · cache read ${t.cacheRead} · cache write ${t.cacheWrite}">${fmt(t.input + t.cacheRead + t.cacheWrite)} in · ${fmt(t.output)} out</span>`;
}

function time(ts) {
  return ts ? `<time datetime="${esc(ts)}">${esc(new Date(ts).toLocaleTimeString())}</time>` : '';
}

function renderEvent(ev) {
  const i = ev.n;
  const num = `<a class="n" href="#e${i}">#${i}</a>`;
  const head = (label) => `<div class="head">${num}<span class="label">${label}</span>${time(ev.ts)}${tokenBadge(ev.tokens)}</div>`;
  switch (ev.kind) {
    case 'user':
      return `<article class="ev user" data-kind="user" id="e${i}">${head('You')}<pre class="body">${esc(ev.text)}</pre></article>`;
    case 'assistant':
      return `<article class="ev assistant" data-kind="assistant" id="e${i}">${head('Agent')}<pre class="body">${esc(ev.text)}</pre></article>`;
    case 'thinking':
      return `<article class="ev thinking" data-kind="thinking" id="e${i}"><details>${'<summary>' + head('Thinking') + '</summary>'}<pre class="body">${esc(ev.text)}</pre></details></article>`;
    case 'tool': {
      const status = ev.result == null ? 'pending' : ev.isError ? 'error' : 'ok';
      const dur = ev.durationMs != null ? `<span class="dur">${(ev.durationMs / 1000).toFixed(1)}s</span>` : '';
      return `<article class="ev tool ${status}" data-kind="tool" data-tool="${esc(ev.name)}" id="e${i}"><details>
<summary><div class="head">${num}<span class="label">${esc(ev.name)}</span><code class="sum">${esc(toolSummary(ev.input))}</code>${dur}${time(ev.ts)}${tokenBadge(ev.tokens)}</div></summary>
<div class="io"><h4>Input</h4><pre>${esc(JSON.stringify(ev.input, null, 2))}</pre>
<h4>${status === 'error' ? 'Error' : 'Result'}</h4><pre>${esc(truncate(ev.result ?? '(no result recorded)'))}</pre></div></details></article>`;
    }
    default:
      return '';
  }
}

export function renderHtml({ meta, events, totals, toolCounts }, { title, recap } = {}) {
  const durationMin = meta.start && meta.end ? ((Date.parse(meta.end) - Date.parse(meta.start)) / 60000).toFixed(1) : null;
  const totalIn = totals.input + totals.cacheRead + totals.cacheWrite;
  const toolList = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);
  const maxTool = toolList[0]?.[1] ?? 1;
  const pageTitle = title ?? 'Agent session replay';
  const userTurns = events.filter((e) => e.kind === 'user').length;
  const toolCalls = events.filter((e) => e.kind === 'tool').length;
  const errors = events.filter((e) => e.kind === 'tool' && e.isError).length;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pageTitle)}</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--muted:#6b6a65;--card:#fff;--line:#e6e3dc;--user:#2f6fdb;--agent:#1d1d1b;--tool:#7a5af5;--think:#9a8f75;--err:#c93c3c;--ok:#2e8b57;--code:#f3f1ec}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#ecebe6;--muted:#9d9b94;--card:#1f1f1c;--line:#33322e;--user:#6aa0ff;--agent:#ecebe6;--tool:#a990ff;--think:#b8ad92;--err:#ff7070;--ok:#5fcf8f;--code:#2a2a26}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}
.wrap{max-width:920px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--muted);font-size:13px;word-break:break-all}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:18px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}.stat b{display:block;font-size:20px}.stat span{color:var(--muted);font-size:12px}
.tools{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:18px}
.bar{display:grid;grid-template-columns:120px 1fr 40px;gap:8px;align-items:center;font-size:13px;margin:3px 0;cursor:pointer}
.bar i{display:block;height:8px;border-radius:4px;background:var(--tool)}.bar em{font-style:normal;color:var(--muted);text-align:right}
.controls{position:sticky;top:0;background:var(--bg);padding:10px 0;display:flex;flex-wrap:wrap;gap:8px;z-index:2;border-bottom:1px solid var(--line);margin-bottom:12px}
.controls input[type=search]{flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);font:inherit}
.controls label{font-size:13px;display:flex;align-items:center;gap:4px;color:var(--muted)}
.ev{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--line);border-radius:8px;margin:8px 0;padding:8px 12px}
.ev.user{border-left-color:var(--user)}.ev.assistant{border-left-color:var(--agent)}.ev.tool{border-left-color:var(--tool)}.ev.thinking{border-left-color:var(--think);opacity:.85}.ev.tool.error{border-left-color:var(--err)}
.head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;font-size:12px;color:var(--muted)}
.label{font-weight:600;color:var(--fg);font-size:13px}.user .label{color:var(--user)}.tool .label{color:var(--tool)}.error .label{color:var(--err)}
.sum{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--code);padding:1px 6px;border-radius:4px}
.tok,.dur{margin-left:auto;font-variant-numeric:tabular-nums}.dur+time,.tok{margin-left:0}
summary{cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}
pre{white-space:pre-wrap;word-break:break-word;margin:6px 0 0;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
.body{font-family:inherit;font-size:14px}.io pre{background:var(--code);padding:8px;border-radius:6px;max-height:420px;overflow:auto}
h4{margin:10px 0 0;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
mark{background:#ffe066;color:#000}.hidden{display:none}
.n{color:var(--muted);text-decoration:none;font-variant-numeric:tabular-nums}.ev:target{outline:2px solid var(--tool);outline-offset:2px}
.recap{background:var(--card);border:1px solid var(--line);border-top:3px solid var(--ok);border-radius:10px;padding:12px 16px;margin:18px 0}
.recap .rk{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--ok);font-weight:600}
.recap .tldr{font-size:16px;margin:6px 0 4px}.recap h3{font-size:13px;margin:12px 0 2px;color:var(--muted)}.recap ul{margin:2px 0;padding-left:20px}
.cite{font-size:12px;color:var(--tool);text-decoration:none;background:var(--code);padding:0 4px;border-radius:4px}
</style></head><body><div class="wrap">
<h1>${esc(pageTitle)}</h1>
<div class="sub">${[agentLabel(meta.agent) + (meta.version ? ' ' + meta.version : ''), meta.model, meta.cwd, meta.start && new Date(meta.start).toLocaleString()].filter(Boolean).map(esc).join(' · ')}</div>
${renderRecap(recap)}
<div class="stats">
<div class="stat"><b>${userTurns}</b><span>prompts</span></div>
<div class="stat"><b>${toolCalls}</b><span>tool calls${errors ? ` · ${errors} failed` : ''}</span></div>
<div class="stat"><b>${fmt(totalIn)}</b><span>input tokens (${fmt(totals.cacheRead)} cached)</span></div>
<div class="stat"><b>${fmt(totals.output)}</b><span>output tokens</span></div>
${durationMin ? `<div class="stat"><b>${durationMin}m</b><span>wall time</span></div>` : ''}
</div>
${toolList.length ? `<div class="tools">${toolList.map(([n, c]) => `<div class="bar" data-tool="${esc(n)}" title="Filter to ${esc(n)}"><span>${esc(n)}</span><i style="width:${(c / maxTool) * 100}%"></i><em>${c}</em></div>`).join('')}</div>` : ''}
<div class="controls">
<input type="search" id="q" placeholder="Search prompts, replies, tool inputs and results…">
<label><input type="checkbox" data-k="user" checked>You</label>
<label><input type="checkbox" data-k="assistant" checked>Agent</label>
<label><input type="checkbox" data-k="tool" checked>Tools</label>
<label><input type="checkbox" data-k="thinking" checked>Thinking</label>
</div>
<main id="tl">${events.map(renderEvent).join('\n')}</main>
</div>
<script>
const evs=[...document.querySelectorAll('.ev')];let toolFilter=null;
const orig=new Map(evs.map(e=>[e,e.innerHTML]));
function apply(){
  const q=document.getElementById('q').value.trim().toLowerCase();
  const kinds=new Set([...document.querySelectorAll('[data-k]')].filter(c=>c.checked).map(c=>c.dataset.k));
  for(const e of evs){
    e.innerHTML=orig.get(e);
    let show=kinds.has(e.dataset.kind)&&(!toolFilter||e.dataset.tool===toolFilter);
    if(show&&q){show=e.textContent.toLowerCase().includes(q);if(show){e.querySelectorAll('details').forEach(d=>d.open=true);mark(e,q);}}
    e.classList.toggle('hidden',!show);
  }
}
function mark(root,q){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  for(const n of nodes){const i=n.data.toLowerCase().indexOf(q);if(i<0)continue;
    const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+q.length);const m=document.createElement('mark');r.surroundContents(m);}
}
document.getElementById('q').addEventListener('input',apply);
document.querySelectorAll('[data-k]').forEach(c=>c.addEventListener('change',apply));
document.querySelectorAll('.bar').forEach(b=>b.addEventListener('click',()=>{toolFilter=toolFilter===b.dataset.tool?null:b.dataset.tool;
  document.querySelectorAll('.bar').forEach(x=>x.style.opacity=toolFilter&&x.dataset.tool!==toolFilter?.35:1);apply();}));
</script></body></html>`;
}
