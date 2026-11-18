/* ==========================================================================
   FOR3NSIQ sign-in gate · Vercel Routing Middleware (Node.js runtime, no dependencies)

   Every request passes through here before Vercel sends a page or image:
     GET  /login    sign-in page (or straight to the site if already signed in)
     POST /login    checks username + password, then sets a signed session cookie
     GET  /logout   clears the session cookie
     anything else  allowed only with a valid session cookie

   Settings live in Vercel > Project > Settings > Environment Variables, never in this file:
     AUTH_SECRET          long random text that signs session cookies (32+ characters)
     AUTH_USERS           one entry per person:  username:pbkdf2.<iterations>.<salt>.<hash>
                          separate entries with a new line or a comma
     AUTH_SESSION_HOURS   optional, how long a normal sign-in lasts (default 12)
     AUTH_REMEMBER_DAYS   optional, how long "Keep me signed in" lasts (default 7)
   Create entries and the secret with tools/password-tool.html. Redeploy after any change.

   Passwords are never stored: only a PBKDF2-SHA256 hash (600,000 rounds, random salt).
   With no AUTH_SECRET or AUTH_USERS the gate stays closed (nobody can get in).
   ========================================================================== */

export const config = {
  runtime: 'nodejs',
  // Run for everything except the few public files the sign-in page needs.
  matcher: ['/((?!assets/css/|assets/js/login|assets/img/logo-|assets/img/hero-).*)'],
};

const SESSION_COOKIE = 'f3_session';
const USER_COOKIE = 'f3_user'; // not secret: lets the site show "Signed in as …"
const USERNAME_RE = /^[a-z0-9._@-]{1,64}$/;
const enc = new TextEncoder();
const dec = new TextDecoder();

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isLogin = path === '/login' || path === '/login.html';
  const env = (globalThis.process && globalThis.process.env) || {};
  const secret = String(env.AUTH_SECRET || '');
  const users = parseUsers(String(env.AUTH_USERS || ''));

  // Fail closed when sign-in has not been set up.
  if (secret.length < 32 || users.size === 0) {
    if (isLogin && request.method !== 'POST') return; // show the page so it can explain
    if (wantsPage(request, path) || isLogin) return redirect('/login?error=config');
    return plain(503, 'Sign-in is not configured');
  }

  if (path === '/logout') return redirect('/login?signed_out=1', clearCookies());

  const session = await readSession(request.headers.get('cookie'), secret, users);

  if (isLogin) {
    if (request.method === 'POST') return handleLogin(request, secret, users, env);
    if (session.state === 'valid') return redirect(safeNext(url.searchParams.get('next')));
    return; // serve login.html
  }

  if (session.state === 'valid') return; // signed in: continue to the requested file

  if (wantsPage(request, path)) {
    const next = path + url.search;
    let target = '/login';
    const query = [];
    if (next !== '/') query.push('next=' + encodeURIComponent(next));
    if (session.state === 'expired') query.push('expired=1');
    if (query.length) target += '?' + query.join('&');
    return redirect(target, session.state === 'none' ? [] : clearCookies());
  }
  return plain(401, 'Sign in required');
}

/* ------------------------------------------------------------- sign in */
async function handleLogin(request, secret, users, env) {
  let form = null;
  try { form = await request.formData(); } catch (e) { form = null; }
  const field = (name) => (form && typeof form.get(name) === 'string' ? form.get(name) : '');
  const username = field('username').trim().toLowerCase();
  const password = field('password');
  const next = safeNext(field('next'));
  const hash = safeHash(field('hash'));
  const remember = field('remember') === 'on';

  const user = users.get(username);
  // Always run the hash, even for unknown usernames, so timing doesn't reveal who exists.
  const ok = (await checkPassword(password || ' ', user || DUMMY_USER)) && Boolean(user) && password.length > 0;

  if (!ok) {
    await sleep(400); // slows down password guessing
    const back = '/login?error=1' + (next !== '/' ? '&next=' + encodeURIComponent(next) : '') + hash;
    return redirect(back);
  }

  const hours = positive(env.AUTH_SESSION_HOURS, 12);
  const days = positive(env.AUTH_REMEMBER_DAYS, 7);
  const lifetime = remember ? days * 86400 : hours * 3600;
  const token = await signSession({ u: username, exp: now() + lifetime, v: await fingerprint(user.spec, secret) }, secret);
  const maxAge = remember ? lifetime : null; // without "remember", the cookie ends when the browser closes
  return redirect(next + hash, [
    cookie(SESSION_COOKIE, token, { maxAge, httpOnly: true }),
    cookie(USER_COOKIE, encodeURIComponent(username), { maxAge, httpOnly: false }),
  ]);
}

/* ------------------------------------------------------------ sessions */
async function readSession(cookieHeader, secret, users) {
  const token = getCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return { state: 'none' };
  const parts = token.split('.');
  if (parts.length !== 2) return { state: 'invalid' };
  let data;
  try {
    const sig = bytesFromB64url(parts[1]);
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(parts[0]));
    if (!valid) return { state: 'invalid' };
    data = JSON.parse(dec.decode(bytesFromB64url(parts[0])));
  } catch (e) {
    return { state: 'invalid' };
  }
  if (!data || typeof data.u !== 'string' || typeof data.exp !== 'number') return { state: 'invalid' };
  if (data.exp <= now()) return { state: 'expired' };
  const user = users.get(data.u);
  if (!user) return { state: 'invalid' };                                        // user removed
  if (data.v !== (await fingerprint(user.spec, secret))) return { state: 'invalid' }; // password changed
  return { state: 'valid', user: data.u };
}

async function signSession(data, secret) {
  const payload = b64urlFromBytes(enc.encode(JSON.stringify(data)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload)));
  return payload + '.' + b64urlFromBytes(sig);
}

// Short tag of the stored hash: changing someone's password signs out their old sessions.
async function fingerprint(spec, secret) {
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode('v1|' + spec)));
  return b64urlFromBytes(sig).slice(0, 16);
}

let cachedKey = null;
let cachedSecret = null;
async function hmacKey(secret) {
  if (cachedKey && cachedSecret === secret) return cachedKey;
  cachedKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  cachedSecret = secret;
  return cachedKey;
}

/* ----------------------------------------------------------- passwords */
// AUTH_USERS entry: username:pbkdf2.<iterations>.<salt b64url>.<hash b64url>
function parseUsers(raw) {
  const users = new Map();
  for (const entry of raw.split(/[\s,;]+/)) {
    const i = entry.indexOf(':');
    if (i < 1) continue;
    const name = entry.slice(0, i).trim().toLowerCase();
    const spec = entry.slice(i + 1).trim();
    const parts = spec.split('.');
    if (!USERNAME_RE.test(name) || parts.length !== 4 || parts[0] !== 'pbkdf2') continue;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 5000000) continue;
    try {
      const salt = bytesFromB64url(parts[2]);
      const hash = bytesFromB64url(parts[3]);
      if (salt.length < 16 || hash.length < 32) continue;
      users.set(name, { spec, iterations, salt, hash });
    } catch (e) { /* skip malformed entry */ }
  }
  return users;
}

const DUMMY_USER = { iterations: 600000, salt: new Uint8Array(16), hash: new Uint8Array(32) };

async function checkPassword(password, user) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: user.salt, iterations: user.iterations }, key, user.hash.length * 8);
  return sameBytes(new Uint8Array(bits), user.hash);
}

function sameBytes(a, b) { // constant-time comparison
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ------------------------------------------------------------- helpers */
function wantsPage(request, path) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html') || path === '/' || path.endsWith('.html') || !/\.[a-z0-9]+$/i.test(path);
}

// Only allow redirects to paths on this site (blocks "//evil.com" style open redirects).
function safeNext(value) {
  if (typeof value !== 'string' || value.length > 512) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || /[\r\n]/.test(value)) return '/';
  if (value.startsWith('/login') || value.startsWith('/logout')) return '/';
  return value;
}
function safeHash(value) { return /^#[A-Za-z0-9_-]{1,64}$/.test(value) ? value : ''; }

function getCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
function cookie(name, value, { maxAge = null, httpOnly = true } = {}) {
  let c = name + '=' + value + '; Path=/; Secure; SameSite=Lax';
  if (httpOnly) c += '; HttpOnly';
  if (maxAge !== null) c += '; Max-Age=' + Math.floor(maxAge);
  return c;
}
function clearCookies() {
  return [
    SESSION_COOKIE + '=; Path=/; Secure; SameSite=Lax; HttpOnly; Max-Age=0',
    USER_COOKIE + '=; Path=/; Secure; SameSite=Lax; Max-Age=0',
  ];
}
function redirect(location, cookies = []) {
  const headers = [['Location', location], ['Cache-Control', 'no-store']];
  for (const c of cookies) headers.push(['Set-Cookie', c]);
  return new Response(null, { status: 303, headers });
}
function plain(status, text) {
  return new Response(text, { status, headers: [['Content-Type', 'text/plain; charset=utf-8'], ['Cache-Control', 'no-store']] });
}
function b64urlFromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function bytesFromB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function positive(value, fallback) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }
function now() { return Math.floor(Date.now() / 1000); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
