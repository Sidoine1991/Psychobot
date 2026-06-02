/**
 * Career-Ops / K_JobAgent → WhatsApp bridge for Psychobot (Express + Baileys).
 *
 * Usage in index.js (after `const app = express();` and before server.listen):
 *   const { registerCareerOpsRoutes } = require('./integrations/careerOpsRoutes');
 *   registerCareerOpsRoutes(app, () => sock);
 *
 * Env:
 *   CAREER_OPS_WEBHOOK_SECRET  — optional; if set, require header x-career-ops-secret
 *   CAREER_OPS_NOTIFY_JID      — default recipient, e.g. 229019691346@s.whatsapp.net
 */
function registerCareerOpsRoutes(app, getSock) {
  app.post('/career-ops/notify', async (req, res) => {
    const secret = process.env.CAREER_OPS_WEBHOOK_SECRET;
    if (secret && req.headers['x-career-ops-secret'] !== secret) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const body = req.body || {};
    const text =
      typeof body.message === 'string'
        ? body.message
        : typeof body.text === 'string'
          ? body.text
          : '';

    if (!text.trim()) {
      return res.status(400).json({ ok: false, error: 'missing message' });
    }

    const jid = body.jid || process.env.CAREER_OPS_NOTIFY_JID;
    if (!jid) {
      return res.status(400).json({ ok: false, error: 'missing jid (set CAREER_OPS_NOTIFY_JID or pass body.jid)' });
    }

    const sock = getSock && getSock();
    if (!sock?.user) {
      return res.status(503).json({ ok: false, error: 'whatsapp not connected' });
    }

    try {
      await sock.sendMessage(jid, { text: text.slice(0, 4000) });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.get('/career-ops/health', (req, res) => {
    const sock = getSock && getSock();
    res.json({ ok: true, whatsapp: Boolean(sock?.user) });
  });
}

module.exports = { registerCareerOpsRoutes };
