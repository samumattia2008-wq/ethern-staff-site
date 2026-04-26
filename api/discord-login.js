const crypto = require('crypto');

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1498061742561820702';

function getSiteUrl(req) {
  const host = req.headers.host;
  return (process.env.SITE_URL || 'https://ethern-staff.vercel.app').replace(/\/$/, '');
}

module.exports = async function handler(req, res) {
  const siteUrl = getSiteUrl(req);
  const redirectUri = `${siteUrl}/api/discord-callback`;
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state,
  });

  res.setHeader('Set-Cookie', `discord_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, `https://discord.com/oauth2/authorize?${params.toString()}`);
};
