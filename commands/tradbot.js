// commands/tradbot.js — Commandes TradBOT : bridge, MCP, ordres, statut
const axios = require('axios');
const log = require('../logger')(module);

const AI_SERVER = process.env.AI_SERVER_URL || 'http://127.0.0.1:8000';
const SYMBOL    = 'XAUUSD';

async function getAI(path, params = {}) {
    try {
        const r = await axios.get(`${AI_SERVER}${path}`, { params, timeout: 15000 });
        return r.data;
    } catch (e) {
        return null;
    }
}

async function postAI(path, data = {}) {
    try {
        const r = await axios.post(`${AI_SERVER}${path}`, data, { timeout: 15000 });
        return r.data;
    } catch (e) {
        return null;
    }
}

function fmt(v, decimals = 2) {
    return v != null ? `$${Number(v).toFixed(decimals)}` : 'N/A';
}

module.exports = {
    name: 'tradbot',
    description: 'TradBOT — statut marche, ordres, biais, GOM, signal',
    run: async ({ sock, msg, args, replyWithTag }) => {
        const from = msg.key.remoteJid;
        const sub  = (args[0] || 'status').toLowerCase();

        // ── !tradbot status ────────────────────────────────────────
        if (sub === 'status' || sub === 'stat') {
            const [bias, order, ta, gom] = await Promise.all([
                getAI('/session-bias',                { symbol: SYMBOL }),
                getAI('/pending-order',               { symbol: SYMBOL }),
                getAI('/tradingagents/report-status', { symbol: SYMBOL }),
                getAI('/gom-verdict',                 { symbol: SYMBOL }),
            ]);

            const bd   = bias?.data || {};
            const bDir = bd.direction || 'N/A';
            const bPct = bd.confidence ? `${Math.round(bd.confidence * 100)}%` : 'N/A';
            const bVal = bd.valid ? `valide ${(bd.expires_in_hours || 0).toFixed(1)}h` : 'expire';

            let orderTxt = '📭 Aucun ordre actif';
            if (order?.ok && order?.order) {
                const o = order.order;
                const act = (o.action || '').toUpperCase();
                const rr  = (o.entry_price && o.stop_loss && o.take_profit)
                    ? (Math.abs(o.take_profit - o.entry_price) / Math.abs(o.stop_loss - o.entry_price)).toFixed(1)
                    : '?';
                orderTxt = `📦 ${act} ${(o.execution_type||'').toUpperCase()} | Entree ${fmt(o.entry_price)} | SL ${fmt(o.stop_loss)} | TP ${fmt(o.take_profit)} | RR 1:${rr}`;
            } else if (order?.message) {
                orderTxt = `⏳ ${order.message}`;
            }

            let taTxt = '🔘 Rapport TA : aucun';
            if (ta?.ok) {
                taTxt = `${ta.direction === 'SELL' ? '🔴' : '🟢'} TA ${ta.direction} ${Math.round((ta.confidence||0)*100)}% | Age: ${(ta.age_minutes||0).toFixed(0)}min | Expire: ${(ta.expires_in_minutes||0).toFixed(0)}min`;
            }

            let gomTxt = '🟡 GOM : N/A';
            if (gom?.ok) {
                const v = gom.verdict || 'WAIT';
                gomTxt = `${v==='SELL'?'🔴':v==='BUY'?'🟢':'🟡'} GOM ${v} | BUY=${gom.score_buy} SELL=${gom.score_sell} Spike=${gom.spike_pct}%`;
            }

            const text = [
                `╭─── 📊 *TRADBOT STATUS* ───╮`,
                `│ Symbole : *${SYMBOL}*`,
                `│`,
                `│ *Biais session :*`,
                `│ ${bDir} ${bPct} | ${bVal}`,
                `│`,
                `│ *Ordre EA :*`,
                `│ ${orderTxt}`,
                `│`,
                `│ *TradingAgents :*`,
                `│ ${taTxt}`,
                `│`,
                `│ *GOM KOLA :*`,
                `│ ${gomTxt}`,
                `╰───────────────────────────╯`,
                `_Tape !tradbot help pour toutes les commandes_`,
            ].join('\n');

            return replyWithTag(sock, from, msg, text);
        }

        // ── !tradbot order ─────────────────────────────────────────
        if (sub === 'order' || sub === 'ordre') {
            const order = await getAI('/pending-order', { symbol: SYMBOL });
            if (order?.ok && order?.order) {
                const o   = order.order;
                const act = (o.action || '').toUpperCase();
                const rr  = (o.entry_price && o.stop_loss && o.take_profit)
                    ? (Math.abs(o.take_profit - o.entry_price) / Math.abs(o.stop_loss - o.entry_price)).toFixed(2)
                    : '?';
                const text = [
                    `╭─── 📦 *ORDRE PENDING* ───╮`,
                    `│ ${act} ${(o.execution_type||'market').toUpperCase()}`,
                    `│ Entree  : ${fmt(o.entry_price)}`,
                    `│ SL      : ${fmt(o.stop_loss)}`,
                    `│ TP      : ${fmt(o.take_profit)}`,
                    `│ Lot     : ${o.lot || 'auto'}`,
                    `│ R:R     : 1:${rr}`,
                    `│ Conf.   : ${Math.round((o.confidence||0)*100)}%`,
                    `│ Status  : ${o.status || 'ready'}`,
                    `╰──────────────────────────╯`,
                ].join('\n');
                return replyWithTag(sock, from, msg, text);
            }
            const msg2 = order?.message || 'Aucun ordre pending';
            return replyWithTag(sock, from, msg, `📭 ${msg2}`);
        }

        // ── !tradbot cancel ────────────────────────────────────────
        if (sub === 'cancel' || sub === 'annuler') {
            const r = await axios.delete(`${AI_SERVER}/pending-order`, { params: { symbol: SYMBOL }, timeout: 10000 }).catch(() => null);
            if (r?.data?.ok) {
                return replyWithTag(sock, from, msg, `✅ Ordre pending *${SYMBOL}* annulé.`);
            }
            return replyWithTag(sock, from, msg, `❌ Impossible d'annuler — ordre introuvable ou serveur hors ligne.`);
        }

        // ── !tradbot bias ──────────────────────────────────────────
        if (sub === 'bias' || sub === 'biais') {
            const bias = await getAI('/session-bias', { symbol: SYMBOL });
            if (bias?.success) {
                const bd = bias.data || {};
                return replyWithTag(sock, from, msg,
                    `📊 *Biais session ${SYMBOL}*\n` +
                    `Direction : *${bd.direction}* ${Math.round((bd.confidence||0)*100)}%\n` +
                    `Validite  : ${bd.valid ? 'valide' : 'expire'} | Expire dans ${(bd.expires_in_hours||0).toFixed(1)}h`
                );
            }
            return replyWithTag(sock, from, msg, '❌ AI server inaccessible.');
        }

        // ── !tradbot gom ───────────────────────────────────────────
        if (sub === 'gom') {
            const gom = await getAI('/gom-verdict', { symbol: SYMBOL });
            if (gom?.ok) {
                const v = gom.verdict || 'WAIT';
                return replyWithTag(sock, from, msg,
                    `📊 *GOM KOLA ${SYMBOL}*\n` +
                    `Verdict : *${v}*\n` +
                    `BUY=${gom.score_buy} | SELL=${gom.score_sell} | Spike=${gom.spike_pct}%\n` +
                    `RSI=${gom.rsi} | ST=${gom.st_dir === 1 ? 'haussier' : 'baissier'}`
                );
            }
            return replyWithTag(sock, from, msg, '🟡 GOM KOLA : aucune donnee (script TV non actif).');
        }

        // ── !tradbot resolve ───────────────────────────────────────
        if (sub === 'resolve') {
            const r = await postAI('/pending-order/resolve', { symbol: SYMBOL });
            if (r?.ok) {
                return replyWithTag(sock, from, msg, `✅ Conflit resolu — ordre *${SYMBOL}* passe en *ready*. TradeManager va executer au prochain poll.`);
            }
            return replyWithTag(sock, from, msg, '❌ Echec resolve — aucun ordre pending ou serveur hors ligne.');
        }

        // ── !tradbot ta ────────────────────────────────────────────
        if (sub === 'ta' || sub === 'report') {
            const ta = await getAI('/tradingagents/report-status', { symbol: SYMBOL });
            if (ta?.ok) {
                return replyWithTag(sock, from, msg,
                    `📋 *Rapport TradingAgents ${SYMBOL}*\n` +
                    `Direction : *${ta.direction}* ${Math.round((ta.confidence||0)*100)}%\n` +
                    `Age       : ${(ta.age_minutes||0).toFixed(0)}min | Expire: ${(ta.expires_in_minutes||0).toFixed(0)}min\n` +
                    `Entree    : ${fmt(ta.entry_price)} | SL: ${fmt(ta.stop_loss)} | TP: ${fmt(ta.take_profit)}\n` +
                    `Note      : ${(ta.reasoning_snippet||'').substring(0,200)}`
                );
            }
            return replyWithTag(sock, from, msg, `🔘 Rapport TA : expire ou aucun — relancer bridge.bat`);
        }

        // ── !tradbot server ────────────────────────────────────────
        if (sub === 'server' || sub === 'ping') {
            const r = await axios.get(`${AI_SERVER}/health`, { timeout: 5000 }).catch(() => null);
            if (r?.status === 200) {
                return replyWithTag(sock, from, msg, `✅ AI Server en ligne — ${AI_SERVER}`);
            }
            return replyWithTag(sock, from, msg, `❌ AI Server hors ligne — ${AI_SERVER}`);
        }

        // ── !tradbot help ──────────────────────────────────────────
        const helpText = [
            `╭─── 🤖 *TRADBOT COMMANDS* ───╮`,
            `│`,
            `│  *!tradbot status*`,
            `│  Statut complet : biais + ordre + TA + GOM`,
            `│`,
            `│  *!tradbot order*`,
            `│  Detail de l'ordre pending actif`,
            `│`,
            `│  *!tradbot cancel*`,
            `│  Annuler l'ordre pending`,
            `│`,
            `│  *!tradbot resolve*`,
            `│  Resoudre un conflit TA/TV -> activer l'ordre`,
            `│`,
            `│  *!tradbot bias*`,
            `│  Biais session TradingAgents`,
            `│`,
            `│  *!tradbot gom*`,
            `│  Verdict GOM KOLA (Pine Script TV)`,
            `│`,
            `│  *!tradbot ta*`,
            `│  Rapport TradingAgents en memoire`,
            `│`,
            `│  *!tradbot server*`,
            `│  Ping AI server`,
            `│`,
            `╰─────────────────────────────╯`,
        ].join('\n');
        return replyWithTag(sock, from, msg, helpText);
    }
};
