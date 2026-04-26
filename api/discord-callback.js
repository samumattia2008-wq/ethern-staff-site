const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1498061742561820702';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1221140667313688606';
const ROLE_ID = process.env.DISCORD_ROLE_ID || '1457884973913735282';

function getSiteUrl(req) {
  const host = req.headers.host;
  return (process.env.SITE_URL || 'https://ethern-staff.vercel.app').replace(/\/$/, '');
}

function getCookie(req, name) {
  const cookie = req.headers.cookie || '';
  return cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

function renderPage(title, message) {
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #070707; color: #efefef; font-family: Arial, sans-serif; }
    main { width: min(460px, calc(100vw - 32px)); border: 1px solid rgba(240,165,0,.28); background: rgba(18,18,18,.94); padding: 28px; text-align: center; }
    h1 { color: #f0a500; letter-spacing: 2px; text-transform: uppercase; }
    p { color: #b7b7b7; line-height: 1.5; }
    a { color: #f0a500; font-weight: 700; }
  </style>
</head>
<body><main><h1>${title}</h1><p>${message}</p><a href="/">Torna al login</a></main></body>
</html>`;
}

module.exports = async function handler(req, res) {
  const code = req.query.code;
  const state = req.query.state;
  const savedState = getCookie(req, 'discord_oauth_state');
  const siteUrl = getSiteUrl(req);
  const redirectUri = `${siteUrl}/api/discord-callback`;

  if (!CLIENT_SECRET) {
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderPage('Config mancante', 'Manca DISCORD_CLIENT_SECRET nelle variabili ambiente di Vercel.'));
    return;
  }

  if (!code || !state || state !== savedState) {
    res.status(401).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderPage('Accesso non valido', 'La sessione Discord non e valida o e scaduta. Riprova.'));
    return;
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const token = await tokenRes.json();

    const [userRes, memberRes] = await Promise.all([
      fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }),
      fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }),
    ]);

    if (!userRes.ok || !memberRes.ok) {
      res.status(403).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderPage('Accesso negato', 'Devi essere nel server Discord autorizzato per accedere.'));
      return;
    }

    const user = await userRes.json();
    const member = await memberRes.json();
    const roles = Array.isArray(member.roles) ? member.roles : [];

    if (!roles.includes(ROLE_ID)) {
      res.status(403).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderPage('Accesso negato', 'Non hai il ruolo Discord richiesto per accedere a questo portale.'));
      return;
    }

    const displayName = member.nick || user.global_name || user.username || 'STAFF';

    res.status(200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Set-Cookie', 'discord_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    res.setHeader('Cache-Control', 'no-store');
    res.end(`<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><title>Accesso Discord</title></head>
<body>
<script>
  sessionStorage.setItem('ethern_auth', '1');
  sessionStorage.setItem('ethern_user', ${JSON.stringify(displayName)});
  localStorage.setItem('ethern_last_user', ${JSON.stringify(displayName)});
  window.location.replace('/');
</script>
</body>
</html>`);
  } catch (err) {
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderPage('Errore Discord', 'Accesso Discord non riuscito. Controlla redirect URL e variabili ambiente Vercel.'));
  }
};
