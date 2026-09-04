/**
 * GET /api/embed?slug=xxx — the script a business pastes into their website.
 *
 * One line on their side:
 *   <script src="https://…/api/embed?slug=damai-clinic" async></script>
 *
 * Everything is built in an iframe rather than injected into their page. That
 * matters: their CSS can't break the widget, our CSS can't break their site,
 * and their page can't read the conversation.
 *
 * Served as JavaScript with permissive CORS because that's what a <script> tag
 * needs. It contains no secrets — only a public slug that the chat API already
 * checks against the domain whitelist.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return new NextResponse("console.error('[automology] missing slug');", {
      status: 400, headers: js(),
    });
  }

  let color = "#1D6A8C";
  let agent = "Assistant";
  let greeting = "Hi! How can I help?";
  try {
    const db = supabaseAdmin();
    const { data } = await db.rpc("get_widget_config", { p_slug: slug });
    const c = data as any;
    if (c) {
      color = c.color ?? color;
      agent = c.agent_name ?? agent;
      greeting = c.greeting ?? greeting;
    }
  } catch { /* fall back to defaults rather than failing their page */ }

  const origin = req.nextUrl.origin;
  const script = build({ slug, origin, color, agent, greeting });

  return new NextResponse(script, { status: 200, headers: js() });
}

function js() {
  return {
    "content-type": "application/javascript; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=300, s-maxage=300",
  };
}

function build(o: { slug: string; origin: string; color: string;
                    agent: string; greeting: string }) {
  const cfg = JSON.stringify(o);
  return `(function () {
  if (window.__automology) return;            // never load twice
  window.__automology = true;

  var C = ${cfg};
  var open = false;
  var loaded = false;

  var css = document.createElement('style');
  css.textContent = [
    '.aml-btn{position:fixed;bottom:20px;right:20px;z-index:2147483000;',
      'background:' + C.color + ';color:#fff;border:0;border-radius:999px;',
      'padding:14px 22px;font:600 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.22);display:flex;align-items:center;gap:9px;',
      'transition:transform .18s ease}',
    '.aml-btn:hover{transform:translateY(-2px)}',
    '.aml-btn i{width:8px;height:8px;border-radius:50%;background:#fff;opacity:.9;display:block}',
    '.aml-fr{position:fixed;bottom:20px;right:20px;z-index:2147483001;width:390px;',
      'height:600px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);',
      'border:0;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.28);',
      'background:#fff;display:none}',
    '.aml-fr.on{display:block}',
    '.aml-x{position:fixed;bottom:20px;right:20px;z-index:2147483002;width:46px;height:46px;',
      'border-radius:50%;background:' + C.color + ';color:#fff;border:0;font-size:22px;',
      'cursor:pointer;display:none;box-shadow:0 8px 30px rgba(0,0,0,.22)}',
    '.aml-x.on{display:block}',
    '@media(max-width:520px){.aml-fr{inset:0;width:100%;height:100%;max-width:none;',
      'max-height:none;border-radius:0}.aml-x{bottom:auto;top:12px}}'
  ].join('');
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.className = 'aml-btn';
  btn.setAttribute('aria-label', 'Chat with ' + C.agent);
  btn.innerHTML = '<i></i>' + 'Chat with ' + C.agent;

  var frame = document.createElement('iframe');
  frame.className = 'aml-fr';
  frame.title = 'Chat with ' + C.agent;
  frame.setAttribute('allow', 'clipboard-write');

  var close = document.createElement('button');
  close.className = 'aml-x';
  close.setAttribute('aria-label', 'Close chat');
  close.innerHTML = '&times;';

  function show() {
    open = true;
    if (!loaded) {
      // only load the chat when someone actually wants it
      frame.src = C.origin + '/embed/' + encodeURIComponent(C.slug);
      loaded = true;
    }
    frame.classList.add('on');
    close.classList.add('on');
    btn.style.display = 'none';
  }
  function hide() {
    open = false;
    frame.classList.remove('on');
    close.classList.remove('on');
    btn.style.display = 'flex';
  }

  btn.addEventListener('click', show);
  close.addEventListener('click', hide);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) hide();
  });

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(frame);
    document.body.appendChild(close);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else { mount(); }

  // let the host page open it: window.Automology.open()
  window.Automology = { open: show, close: hide, slug: C.slug };
})();`;
}
