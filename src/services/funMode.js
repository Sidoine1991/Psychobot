/**
 * Fun Mode — Mode divertissement de PsychoBot
 *
 * Activé si l'interlocuteur dit qu'il s'ennuie, veut changer de sujet,
 * ou répond OUI à l'invite de jeu du bot.
 *
 * Activités : blagues, devinettes, test QI, vrai/faux, culture générale.
 * Anti-répétition : chaque contenu est marqué "utilisé" par JID.
 * Désactivation : mot-clé stop, ou 30 min d'inactivité.
 */

'use strict';

// ── État par JID ──────────────────────────────────────────────────────────────

const funStates = new Map();
const FUN_TTL_MS = 30 * 60 * 1000; // 30 min d'inactivité → mode désactivé

function getState(jid) {
    if (!funStates.has(jid)) {
        funStates.set(jid, {
            active: false,
            lastActivity: 0,
            pendingChallenge: null,   // { type, question, answer, points }
            score: 0,
            questionCount: 0,
            usedJokes: new Set(),
            usedRiddles: new Set(),
            usedIQ: new Set(),
            usedTrivia: new Set(),
        });
    }
    const state = funStates.get(jid);
    // Auto-expire après TTL
    if (state.active && Date.now() - state.lastActivity > FUN_TTL_MS) {
        state.active = false;
        state.pendingChallenge = null;
    }
    return state;
}

function isActive(jid) {
    return getState(jid).active;
}

function activate(jid) {
    const s = getState(jid);
    s.active = true;
    s.lastActivity = Date.now();
    s.score = 0;
    s.questionCount = 0;
    s.pendingChallenge = null;
}

function deactivate(jid) {
    const s = getState(jid);
    s.active = false;
    s.pendingChallenge = null;
}

function touch(jid) {
    const s = getState(jid);
    s.lastActivity = Date.now();
}

// ── Détection triggers ────────────────────────────────────────────────────────

const TRIGGER_PATTERNS = [
    /\bje\s+m['’]ennuie\b/i,
    /\bje\s+suis\s+ennuy[ée]/i,
    /\bc['’]est\s+ennuyeux\b/i,
    /\bje\s+m['’]ennuie?\b/i,
    /\bje\s+m['']ennuis?\b/i,
    /\bpas\s+grand[- ]chose\b/i,
    /\bchanger\s+de\s+sujet\b/i,
    /\bchange\s+de\s+sujet\b/i,
    /\bon\s+change\s+de\s+sujet\b/i,
    /\bamuse[- ]moi\b/i,
    /\bdivertis[- ]moi\b/i,
    /\bfais[- ]moi\s+rire\b/i,
    /\bjouer\b/i,
    /\bun\s+jeu\b/i,
    /\bjoue\s+avec\s+moi\b/i,
    /\brac(?:onte)?[- ]moi\s+une\s+blague\b/i,
    /\bune\s+blague\b/i,
    /\bune\s+devinette\b/i,
    /\btest\s+de?\s+qi\b/i,
    /\bteste\s+mon\s+qi\b/i,
    /\bi['']m\s+bored\b/i,
    /\bboring\b/i,
    /\bentertain\s+me\b/i,
    /\btell\s+me\s+a\s+joke\b/i,
    /\ba\s+riddle\b/i,
];

const STOP_PATTERNS = [
    /\b(stop|arr[eê]te|suffit|assez|stop\s+le\s+jeu|fin\s+du\s+jeu|quitter|quitte)\b/i,
    /\b(on\s+arr[eê]te|c['’]est\s+bon|merci\s+c['’]est\s+bon)\b/i,
    /\b(enough|quit|exit|done\s+playing)\b/i,
];

function detectTrigger(text) {
    return TRIGGER_PATTERNS.some(p => p.test(text));
}

function detectStop(text) {
    return STOP_PATTERNS.some(p => p.test(text));
}

// Réponse OUI à l'invite de jeu
const YES_WORDS = new Set(['oui', 'yes', 'ok', 'o', 'yep', 'yeah', 'allons-y', 'allez', 'vas-y', 'go', 'bien sûr', 'avec plaisir', 'd\'accord', 'dac', 'why not', 'pourquoi pas']);
function isYesToPlay(text) {
    return YES_WORDS.has(text.trim().toLowerCase().replace(/[!?.]/g, ''));
}

// ── Contenu ───────────────────────────────────────────────────────────────────

const JOKES = [
    { id: 'j1', text: 'Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? 🤿\n\n_…Parce que sinon ils tomberaient dans le bateau !_' },
    { id: 'j2', text: 'Un homme entre dans une bibliothèque et demande :\n— Avez-vous des livres sur la paranoïa ?\nLa bibliothécaire chuchote : _"Ils sont juste derrière vous…"_ 😨' },
    { id: 'j3', text: 'Pourquoi les mathématiciens confondent-ils Halloween et Noël ? 🎃🎄\n\n_Parce que Oct 31 = Dec 25._ (Octal 31 = Décimal 25 😄)' },
    { id: 'j4', text: 'Un wifi demande à un autre wifi : "Tu vis où ?" 📶\n\n_— Dans le nuage ! Et toi ?_\n_— Moi ? Dans les murs… je suis le câble._' },
    { id: 'j5', text: 'Quelle est la différence entre un crocodile ? 🐊\n\n_Plus c\'est jaune, moins c\'est un crocodile._ 😂' },
    { id: 'j6', text: 'Un patient dit au médecin : "Docteur, j\'ai l\'impression d\'être invisible."\nLe médecin répond : _"Désolé, je ne vous vois pas aujourd\'hui."_ 👻' },
    { id: 'j7', text: 'Pourquoi Superman porte-t-il son slip par-dessus son pantalon ? 🦸\n\n_Pour éviter les courants d\'air !_' },
    { id: 'j8', text: 'Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ? 🎨\n\n_Un chat-peint de Noël !_ 🐱' },
    { id: 'j9', text: 'Pourquoi les footballeurs sont-ils bons cuisiniers ? ⚽\n\n_Parce qu\'ils savent bien contrôler la balle… et le feu !_' },
    { id: 'j10', text: 'Un informaticien entre dans un bar. 💻\n\nLe barman : "On n\'a pas de bière."\nL\'informaticien : _"Have you tried turning it off and on again?"_' },
    { id: 'j11', text: 'Qu\'est-ce qu\'un canif ? 🔪\n\n_Un petit fien !_ 😄' },
    { id: 'j12', text: 'Pourquoi les fantômes ne mentent-ils jamais ? 👻\n\n_Parce qu\'on peut voir à travers eux !_' },
    { id: 'j13', text: 'Qu\'est-ce qu\'un croissant ? 🥐\n\n_Un ver de terre qui a réussi dans la vie !_' },
    { id: 'j14', text: 'Pourquoi les abeilles ont-elles du miel ? 🐝\n\n_Parce qu\'elles ont de bonnes ruches !_' },
    { id: 'j15', text: 'Un homme dit à sa femme : "Je t\'aime de tout mon cœur."\nElle répond : _"Et le reste, tu le donnes à qui ?"_ ❤️' },
];

const RIDDLES = [
    { id: 'r1', question: '🧩 *Devinette :*\nJ\'ai des villes, mais pas de maisons. Des forêts, mais pas d\'arbres. De l\'eau, mais pas de poissons. Qu\'est-ce que je suis ?', answer: 'carte', hint: 'On s\'en sert pour se repérer...', points: 10 },
    { id: 'r2', question: '🧩 *Devinette :*\nPlus je sèche, plus je suis mouillée. Qu\'est-ce que je suis ?', answer: 'serviette', hint: 'On l\'utilise après la douche...', points: 10 },
    { id: 'r3', question: '🧩 *Devinette :*\nJe parle sans bouche, j\'entends sans oreilles, n\'ai pas de corps, mais prends vie avec le vent. Qui suis-je ?', answer: ['écho', 'echo'], hint: 'Dans la montagne ou les grottes...', points: 15 },
    { id: 'r4', question: '🧩 *Devinette :*\nQuel est le comble pour un électricien ?', answer: 'ne pas être dans le courant', hint: 'C\'est un jeu de mots avec son métier...', points: 10 },
    { id: 'r5', question: '🧩 *Devinette :*\nJ\'ai un cœur qui ne bat pas. Des feuilles mais pas de branches. Qu\'est-ce que je suis ?', answer: 'livre', hint: 'On me lit...', points: 10 },
    { id: 'r6', question: '🧩 *Devinette :*\nLe père de Marie a 5 enfants : Nana, Nene, Nini, Nono... et le 5e ?', answer: 'marie', hint: 'Relis bien la question depuis le début 😉', points: 15 },
    { id: 'r7', question: '🧩 *Devinette :*\nUn avion s\'écrase exactement à la frontière entre la France et la Belgique. Où enterre-t-on les survivants ?', answer: ['on n\'enterre pas', 'on enterre pas', 'nulle part', 'les survivants'], hint: 'Les survivants... 🤔', points: 15 },
    { id: 'r8', question: '🧩 *Devinette :*\nQu\'est-ce qui a 4 doigts et un pouce mais n\'est pas une main ?', answer: 'gant', hint: 'On le porte en hiver...', points: 10 },
    { id: 'r9', question: '🧩 *Devinette :*\nJe suis toujours devant toi mais ne peut pas être vu. Qui suis-je ?', answer: ['futur', 'avenir'], hint: 'Pensez au temps...', points: 15 },
    { id: 'r10', question: '🧩 *Devinette :*\nPlus tu m\'enlèves, plus je deviens grand. Qui suis-je ?', answer: 'trou', hint: 'Dans le sol ou dans un mur...', points: 10 },
];

const IQ_QUESTIONS = [
    { id: 'q1', question: '🧠 *Question QI :*\nSi 5 machines font 5 objets en 5 minutes, combien faut-il de machines pour faire 100 objets en 100 minutes ?', answer: '5', explanation: '5 machines font 5 objets/5min → chaque machine fait 1 objet/5min → en 100min, 1 machine fait 20 objets → 5 machines font 100 objets.', points: 20 },
    { id: 'q2', question: '🧠 *Question QI :*\nUn lac contient un nénuphar. Chaque jour, sa surface double. Au bout de 48 jours le lac est entièrement couvert. Au bout de combien de jours était-il à moitié couvert ?', answer: '47', explanation: 'La surface double chaque jour → la veille du 48ème jour (donc jour 47), c\'était à moitié couvert.', points: 20 },
    { id: 'q3', question: '🧠 *Question QI :*\nMartin était né en 1957. Aujourd\'hui il n\'a que 30 ans. Comment est-ce possible ?', answer: ['médecin', 'couloir', '1957 est le numéro de la chambre', 'chambre'], explanation: '1957 est le numéro de la chambre d\'hôpital dans laquelle il est né, pas l\'année !', points: 25 },
    { id: 'q4', question: '🧠 *Question QI :*\nQuel nombre vient ensuite dans la suite ?\n2, 4, 8, 16, 32, ___', answer: '64', explanation: 'Chaque terme est multiplié par 2.', points: 10 },
    { id: 'q5', question: '🧠 *Question QI :*\nSi tu as 3 pommes et tu en enlèves 2, combien en as-tu ?', answer: '2', explanation: 'Tu *enlèves* (prends pour toi) 2 pommes → tu en as 2 !', points: 15 },
    { id: 'q6', question: '🧠 *Question QI :*\nUn homme habite au 30ème étage. Chaque matin, il prend l\'ascenseur pour descendre. Le soir, il prend l\'ascenseur jusqu\'au 15ème et monte à pied. Pourquoi ?', answer: ['petit', 'trop petit', 'pas assez grand', 'n\'atteint pas'], explanation: 'Il est trop petit pour atteindre le bouton du 30ème !', points: 25 },
    { id: 'q7', question: '🧠 *Question QI :*\nQu\'est-ce qui vient une fois par minute, deux fois par moment, mais jamais en cent ans ?', answer: ['m', 'la lettre m'], explanation: 'La lettre M : 1 fois dans "minute", 2 fois dans "moment", 0 fois dans "cent ans".', points: 25 },
    { id: 'q8', question: '🧠 *Question QI :*\nSi un coq pond un œuf au sommet d\'un toit, de quel côté tombe-t-il ?', answer: ['aucun', 'pas', 'coq ne pond pas', 'les coqs ne pondent pas'], explanation: 'Les coqs ne pondent pas ! 🐓', points: 15 },
    { id: 'q9', question: '🧠 *Question QI :*\nContinue la suite : 1, 11, 21, 1211, 111221, ___', answer: '312211', explanation: 'On décrit le nombre précédent : "un 1" → 11, "deux 1" → 21, "un 2, un 1" → 1211... etc.', points: 30 },
    { id: 'q10', question: '🧠 *Question QI :*\nUn paysan a 17 moutons. Tous sauf 9 meurent. Combien lui reste-t-il ?', answer: '9', explanation: '"Tous sauf 9" = 9 survivent !', points: 10 },
];

const TRIVIA = [
    { id: 't1', question: '🌍 *Culture générale :*\nQuelle est la capitale du Bénin ? (ville administrative)', answer: ['porto-novo', 'porto novo'], explanation: 'Porto-Novo est la capitale officielle du Bénin, même si Cotonou est la plus grande ville !', points: 10 },
    { id: 't2', question: '🌍 *Culture générale :*\nQuel est le plus grand océan du monde ?', answer: ['pacifique', 'ocean pacifique', 'océan pacifique'], explanation: 'Le Pacifique couvre plus de 165 millions de km².', points: 10 },
    { id: 't3', question: '🌍 *Culture générale :*\nEn quelle année l\'Homme a-t-il marché sur la Lune pour la première fois ? 🌙', answer: '1969', explanation: 'Apollo 11 — Neil Armstrong, le 20 juillet 1969.', points: 10 },
    { id: 't4', question: '🌍 *Culture générale :*\nQuel pays est surnommé "Le pays du soleil levant" ? ☀️', answer: 'japon', explanation: 'Le Japon, en japonais "Nippon" = origine du soleil.', points: 10 },
    { id: 't5', question: '🌍 *Culture générale :*\nCombien de cordes a une guitare classique ?', answer: '6', explanation: 'La guitare classique (et folk) a 6 cordes.', points: 10 },
    { id: 't6', question: '🌍 *Culture générale :*\nQuel est le symbole chimique de l\'or ? ✨', answer: 'au', explanation: 'Au, du latin "Aurum".', points: 10 },
    { id: 't7', question: '🌍 *Culture générale :*\nQuel artiste africain a popularisé l\'Afrobeats dans le monde entier ? 🎵', answer: ['wizkid', 'burna boy', 'davido'], explanation: 'Wizkid, Burna Boy et Davido sont les trois piliers de l\'Afrobeats mondial !', points: 15 },
    { id: 't8', question: '🌍 *Culture générale :*\nQuelle planète est surnommée "la planète rouge" ? 🔴', answer: 'mars', explanation: 'Mars, à cause de la couleur rougeâtre de son sol.', points: 10 },
    { id: 't9', question: '🌍 *Culture générale :*\nCombien de pays composent l\'Union Africaine (UA) ?', answer: '55', explanation: '55 États membres depuis l\'adhésion du Maroc en 2017.', points: 15 },
    { id: 't10', question: '🌍 *Culture générale :*\nQuel est le langage de programmation le plus utilisé au monde en 2024 ?', answer: ['python', 'javascript', 'js'], explanation: 'Python et JavaScript se disputent la première place depuis 2023 !', points: 15 },
];

// ── Sélecteur anti-répétition ─────────────────────────────────────────────────

function pickUnused(pool, usedSet) {
    const available = pool.filter(item => !usedSet.has(item.id));
    if (available.length === 0) {
        usedSet.clear(); // Tout utilisé → reset
        return pool[Math.floor(Math.random() * pool.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
}

// ── Vérification réponse ──────────────────────────────────────────────────────

function checkAnswer(userText, expected) {
    const clean = userText.trim().toLowerCase().replace(/[.,!?]/g, '');
    const answers = Array.isArray(expected) ? expected : [expected];
    return answers.some(a => {
        const ea = a.toString().toLowerCase().replace(/[.,!?]/g, '');
        return clean === ea || clean.includes(ea) || ea.includes(clean);
    });
}

// ── Activités ─────────────────────────────────────────────────────────────────

function doJoke(state) {
    const joke = pickUnused(JOKES, state.usedJokes);
    state.usedJokes.add(joke.id);
    return joke.text + '\n\n_😄 Tu veux une autre blague, une devinette, ou un test QI ?_';
}

function doRiddle(state) {
    const riddle = pickUnused(RIDDLES, state.usedRiddles);
    state.usedRiddles.add(riddle.id);
    state.pendingChallenge = {
        type: 'riddle',
        id: riddle.id,
        answer: riddle.answer,
        hint: riddle.hint,
        explanation: null,
        points: riddle.points,
        hintUsed: false,
    };
    state.questionCount++;
    return riddle.question + `\n\n_⏳ Tu as le temps — réponds quand tu veux !_\n_(Tape "indice" si tu séches)_`;
}

function doIQ(state) {
    const q = pickUnused(IQ_QUESTIONS, state.usedIQ);
    state.usedIQ.add(q.id);
    state.pendingChallenge = {
        type: 'iq',
        id: q.id,
        answer: q.answer,
        explanation: q.explanation,
        points: q.points,
        hintUsed: false,
    };
    state.questionCount++;
    return q.question + `\n\n_🧠 ${q.points} points en jeu — réfléchis bien !_`;
}

function doTrivia(state) {
    const q = pickUnused(TRIVIA, state.usedTrivia);
    state.usedTrivia.add(q.id);
    state.pendingChallenge = {
        type: 'trivia',
        id: q.id,
        answer: q.answer,
        explanation: q.explanation,
        points: q.points,
        hintUsed: false,
    };
    state.questionCount++;
    return q.question + `\n\n_💡 ${q.points} points en jeu !_`;
}

// ── Message de bienvenue mode fun ─────────────────────────────────────────────

function buildWelcomeMessage(name) {
    const n = name ? ` _*${name}*_` : '';
    return (
        `🎉 *Mode Divertissement activé !*${n}\n\n` +
        `Voici ce qu'on peut faire ensemble :\n\n` +
        `😂 *Blague* — une bonne blague\n` +
        `🧩 *Devinette* — teste ta logique\n` +
        `🧠 *QI* — une question de QI\n` +
        `🌍 *Culture* — culture générale\n` +
        `🎲 *Surprise* — je choisis pour toi !\n\n` +
        `_Dis-moi ce que tu veux, ou tape "surprise" 😄_\n` +
        `_(Tape "stop" pour revenir à la normale)_`
    );
}

// ── Dispatcher principal ──────────────────────────────────────────────────────

const ACTIVITY_PATTERNS = {
    joke:     /\b(blague|joke|rire|marrant|drôle|funny|rigol)\b/i,
    riddle:   /\b(devinette|devine|riddle|enigme|énigme)\b/i,
    iq:       /\b(qi|iq|intel|cogn|cerveau|brain|logique|logic)\b/i,
    trivia:   /\b(culture|cultu|general|générale|trivia|quiz|question)\b/i,
    surprise: /\b(surprise|aléatoire|random|choisis|au hasard)\b/i,
    hint:     /\b(indice|hint|aide|help|je sais pas|sais pas|sèche|sèche)\b/i,
    skip:     /\b(passer|skip|autre|suivant|next)\b/i,
    score:    /\b(score|point|résultat|combien|total)\b/i,
};

function pickRandomActivity() {
    const activities = ['joke', 'riddle', 'iq', 'trivia'];
    return activities[Math.floor(Math.random() * activities.length)];
}

/**
 * Point d'entrée principal.
 * Retourne { text: string, handled: boolean }
 */
function handle(jid, text, contactName) {
    const state = getState(jid);
    touch(jid);

    // ── Stop ──
    if (detectStop(text)) {
        deactivate(jid);
        const n = contactName ? ` _*${contactName}*_` : '';
        const finalScore = state.score > 0
            ? `\n\n🏆 Score final : *${state.score} points* sur ${state.questionCount} question(s) !`
            : '';
        return {
            handled: true,
            text: `👋 Mode divertissement désactivé${n}.${finalScore}\n_À bientôt pour de nouvelles aventures ! 😄_`,
        };
    }

    // ── Pas encore actif : détecter si c'est une invitation ──
    if (!state.active) {
        return { handled: false, text: null };
    }

    // ── Challenge en attente : vérifier la réponse ──
    if (state.pendingChallenge) {
        const ch = state.pendingChallenge;

        // Indice demandé
        if (ACTIVITY_PATTERNS.hint.test(text)) {
            if (ch.hint && !ch.hintUsed) {
                ch.hintUsed = true;
                return { handled: true, text: `💡 *Indice :* ${ch.hint}\n\n_Essaie maintenant !_` };
            }
            if (!ch.hint) {
                return { handled: true, text: `😅 Pas d'indice pour celle-là ! Réfléchis encore un peu… 🤔` };
            }
            return { handled: true, text: `💡 Je t'ai déjà donné l'indice : *${ch.hint}*\n_Allez, tu peux y arriver !_` };
        }

        // Skip
        if (ACTIVITY_PATTERNS.skip.test(text)) {
            const explanation = ch.explanation || '';
            const answer = Array.isArray(ch.answer) ? ch.answer[0] : ch.answer;
            state.pendingChallenge = null;
            return {
                handled: true,
                text: `⏭ *Passée !*\nLa réponse était : *${answer}*\n${explanation ? `_${explanation}_` : ''}\n\n_Prochaine activité ?_`,
            };
        }

        // Vérifier la réponse
        if (checkAnswer(text, ch.answer)) {
            const points = ch.hintUsed ? Math.round(ch.points / 2) : ch.points;
            state.score += points;
            state.pendingChallenge = null;
            const explanation = ch.explanation ? `\n_${ch.explanation}_` : '';
            const pointsMsg = ch.hintUsed ? ` (+${points} pts, moitié car indice utilisé)` : ` (+${points} pts)`;
            return {
                handled: true,
                text: `✅ *Bonne réponse !* 🎉${pointsMsg}${explanation}\n\n🏆 Score : *${state.score} pts*\n\n_Prochaine activité ? (blague/devinette/QI/culture/surprise)_`,
            };
        } else {
            // Mauvaise réponse — ne pas dévoiler, encourager
            const encouragements = [
                'Hmm, pas tout à fait… Réessaie ! 💪',
                'Presque ! Mais non 😄 Encore une tentative ?',
                'C\'est pas ça… Tu veux un indice ? Tape *indice*',
                'Non non non ! Tu y es presque peut-être ? 🤔',
                'Pas encore ! Continue à réfléchir 🧠',
            ];
            const msg = encouragements[Math.floor(Math.random() * encouragements.length)];
            return { handled: true, text: msg };
        }
    }

    // ── Score ──
    if (ACTIVITY_PATTERNS.score.test(text)) {
        return {
            handled: true,
            text: `🏆 *Ton score actuel :* ${state.score} points sur ${state.questionCount} question(s) !\n\n_Continue ? (blague/devinette/QI/culture/surprise)_`,
        };
    }

    // ── Choisir l'activité ──
    let activity = null;
    if (ACTIVITY_PATTERNS.joke.test(text))     activity = 'joke';
    else if (ACTIVITY_PATTERNS.riddle.test(text)) activity = 'riddle';
    else if (ACTIVITY_PATTERNS.iq.test(text))     activity = 'iq';
    else if (ACTIVITY_PATTERNS.trivia.test(text)) activity = 'trivia';
    else if (ACTIVITY_PATTERNS.surprise.test(text) || text.trim().length < 15) {
        activity = pickRandomActivity();
    }

    if (!activity) {
        // Message non compris — suggérer
        return {
            handled: true,
            text: `😄 Je n'ai pas compris ! Dis-moi ce que tu veux :\n_blague · devinette · QI · culture · surprise_\n_(ou "stop" pour quitter)_`,
        };
    }

    let responseText;
    if (activity === 'joke')    responseText = doJoke(state);
    else if (activity === 'riddle') responseText = doRiddle(state);
    else if (activity === 'iq')     responseText = doIQ(state);
    else                            responseText = doTrivia(state);

    return { handled: true, text: responseText };
}

// ── Invite proactive ──────────────────────────────────────────────────────────

/**
 * Retourne un message d'invite si la conv est longue et monotone.
 * À appeler de temps en temps (ex: tous les 10 messages).
 */
function buildPlayInvite(contactName) {
    const n = contactName ? ` _*${contactName}*_` : '';
    const invites = [
        `Hé${n} ! 😄 La conversation est sympa, mais si tu veux changer d'air, je peux te raconter une blague ou te poser une devinette. _Tu veux qu'on joue ?_`,
        `Au fait${n} 🎲 j'ai quelques devinettes et questions QI en stock… _Ça te dit de faire une petite pause fun ?_`,
        `Tu savais${n} 🧠 que les petits défis mentaux boostent la concentration ? J'en ai quelques-uns pour toi si tu veux ! _On joue ?_`,
    ];
    return invites[Math.floor(Math.random() * invites.length)];
}

module.exports = {
    isActive,
    activate,
    deactivate,
    detectTrigger,
    detectStop,
    isYesToPlay,
    handle,
    buildWelcomeMessage,
    buildPlayInvite,
};
