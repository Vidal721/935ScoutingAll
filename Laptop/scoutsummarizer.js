/**
 * ═══════════════════════════════════════════════════════════════
 *  SCOUT SUMMARIZER  —  Team 935 & 757 Strategy Portal
 *  Pure local tokenization — no API, no ML, fully offline
 *  Reads freeform scouter notes + stats → structured intel bullets
 * ═══════════════════════════════════════════════════════════════
 */

const ScoutSummarizer = (() => {

  // ─────────────────────────────────────────────────────────────
  //  TOKENIZER
  // ─────────────────────────────────────────────────────────────
  function tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text.toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  function ngrams(tokens, n) {
    const out = [];
    for (let i = 0; i <= tokens.length - n; i++) out.push(tokens.slice(i, i + n).join(' '));
    return out;
  }

  const NEGATORS = new Set([
    'not','no','never','didnt',"didn't",'doesnt',"doesn't",'dont',"don't",
    'couldnt',"couldn't",'wasnt',"wasn't",'wont',"won't",'cant',"can't",
    'failed','unable','without','hardly','barely','stopped','broke','wouldnt',"wouldn't"
  ]);

  function hasNegationBefore(tokens, phraseStart) {
    const idx = tokens.indexOf(phraseStart);
    if (idx < 0) return false;
    const window = tokens.slice(Math.max(0, idx - 5), idx);
    return window.some(t => NEGATORS.has(t));
  }

  // ─────────────────────────────────────────────────────────────
  //  SIGNAL TAXONOMY
  // ─────────────────────────────────────────────────────────────
  const SIGNALS = [
    // AUTO
    { id:'auto_strong',    cat:'auto',        pol:+2, w:2, phrases:['great auto','strong auto','good auto','solid auto','consistent auto','auto worked','auto scored every','perfect auto','auto every match','amazing auto','best auto'] },
    { id:'auto_ok',        cat:'auto',        pol:+1, w:1, phrases:['auto score','auto scored','auto piece','auto note','auto preloaded','auto line','left zone','auto move','auto loaded','has auto','auto works'] },
    { id:'auto_bad',       cat:'auto',        pol:-2, w:2, phrases:['no auto','missed auto','auto failed','auto off','auto problem','auto issue','auto broke','auto wrong','bad auto','auto miss','auto nothing','no autonomous','auto not working','auto went wrong','auto didnt work','auto didnt score'] },
    { id:'auto_inconsistent', cat:'auto',     pol:-1, w:1, phrases:['auto sometimes','auto inconsistent','auto hit','auto partial','auto half'] },

    // CLIMB
    { id:'climb_l4',       cat:'climb',       pol:+4, w:3, phrases:['l4','level 4','l4 climb','top rung','highest rung'] },
    { id:'climb_l3',       cat:'climb',       pol:+3, w:3, phrases:['l3','level 3','l3 climb','third rung','high bar'] },
    { id:'climb_l2',       cat:'climb',       pol:+2, w:2, phrases:['l2','level 2','l2 climb','second rung'] },
    { id:'climb_l1',       cat:'climb',       pol:+1, w:1, phrases:['l1','level 1','l1 climb','low rung','low bar'] },
    { id:'climb_strong',   cat:'climb',       pol:+2, w:2, phrases:['climbed','climb success','climbs fast','fast climb','always climbs','reliable climb','consistent climb','made the climb','got up','hung','hangs','chain climb','bar hang','good climb','great climb','solid climb','quick climb'] },
    { id:'climb_fail',     cat:'climb',       pol:-3, w:3, phrases:['no climb','failed climb','climb fail','fell off','dropped off','climb broke','missed climb','climb issue','climb problem','partial climb','almost climbed','climb attempt failed','slipped off','lost grip','couldnt climb','climb didnt work','climb mechanism','fell from bar'] },
    { id:'climb_slow',     cat:'climb',       pol:-1, w:1, phrases:['slow climb','barely climbed','climbed late','last second climb','climb too slow','struggled to climb'] },

    // SCORING
    { id:'score_strong',   cat:'scoring',     pol:+2, w:2, phrases:['fast cycles','high cycles','lots of cycles','many pieces','scored a lot','top scorer','high scorer','quick cycles','efficient scoring','smooth cycles','great scoring','scored well','scored high','dominated','lots of notes','high output','great cycles'] },
    { id:'score_ok',       cat:'scoring',     pol:+1, w:1, phrases:['scored','good cycles','decent cycles','average cycles','solid scoring','made shots','consistent scoring','good scoring','scored notes','scored pieces'] },
    { id:'score_intake_bad',cat:'scoring',    pol:-2, w:2, phrases:['intake issue','intake problem','intake broke','intake jam','intake jammed','intake failed','intake not working','intake stuck','bad intake','slow intake','couldnt pick up','piece fell','dropped note','dropped piece','fumbled','lost piece','missed pickup'] },
    { id:'score_aim_bad',  cat:'scoring',     pol:-2, w:2, phrases:['missed shots','missed scoring','shots missed','bad aim','cant score','couldnt score','scoring issue','scoring problem','shooter off','shooter issue','shooter problem','shooter broke','shooter not working','shooter failed'] },
    { id:'score_low',      cat:'scoring',     pol:-1, w:1, phrases:['few cycles','slow cycles','low cycles','not many','struggled scoring','low scoring','didnt score much'] },

    // RELIABILITY
    { id:'reliable',       cat:'reliability', pol:+2, w:2, phrases:['very reliable','super reliable','no issues','worked great','ran perfectly','no problems','always works','solid robot','no mechanical','dependable','no breakdowns','ran clean','zero issues','perfect robot','no failures'] },
    { id:'broke_general',  cat:'reliability', pol:-3, w:3, phrases:['broke','broken','mechanical issue','mechanical failure','robot broke','something broke','stopped working','robot stopped','couldnt move','mechanism broke','part broke','mechanism failed','hardware issue'] },
    { id:'arm_broke',      cat:'mechanism',   pol:-2, w:2, phrases:['arm broke','arm issue','arm stuck','arm problem','arm failed','arm not working','arm wouldnt','arm fell','arm snapped','arm bent','arm cracked'] },
    { id:'shooter_broke',  cat:'mechanism',   pol:-2, w:2, phrases:['shooter broke','shooter issue','shooter problem','shooter not working','shooter failed','shooter off','shooting problem','flywheel issue','flywheel broke'] },
    { id:'intake_broke',   cat:'mechanism',   pol:-2, w:2, phrases:['intake broke','intake issue','intake problem','intake failed','intake stuck','intake not working','intake jam','intake jammed'] },
    { id:'disabled',       cat:'reliability', pol:-3, w:3, phrases:['disabled','e-stop','estop','brownout','disconnected','radio issue','rio issue','connection lost','lost connection','electrical issue','code crash','rebooted','restarted mid match','tipped over','fell over','tipped','robot tipped','fell','got stuck','stuck on field'] },
    { id:'slow_restart',   cat:'reliability', pol:-2, w:2, phrases:['had to restart','reset mid match','reboot','code issue','roborio','fms disconnect','slow restart','manual restart'] },

    // DEFENSE
    { id:'defense_great',  cat:'defense',     pol:+1, w:2, phrases:['great defense','good defense','effective defense','played great defense','shut them down','physical defense','strong defense','blocked well','pinned','disrupted','held them back','great defender','good defender'] },
    { id:'defense_played', cat:'defense',     pol: 0, w:1, phrases:['played defense','was defending','ran defense','plays defense','defensive','defense robot','wall bot'] },
    { id:'foul_risk',      cat:'fouls',       pol:-2, w:2, phrases:['fouls','tech foul','penalty','got penalized','called for foul','foul call','given a penalty','yellow card','red card','lots of fouls','multiple fouls','kept fouling','foul prone','foul heavy','foul issues'] },

    // DRIVING
    { id:'drive_great',    cat:'driving',     pol:+2, w:2, phrases:['great driver','great driving','smart driving','precise driving','accurate driver','great awareness','good positioning','well positioned','strategic driving','smooth driver','confident driver','skilled driver','amazing driver'] },
    { id:'drive_ok',       cat:'driving',     pol:+1, w:1, phrases:['good driver','decent driver','solid driver','good driving','decent driving'] },
    { id:'drive_bad',      cat:'driving',     pol:-2, w:2, phrases:['ran into','collided','bad driving','reckless','out of control','hit alliance','hit our bot','bumped wall','poor driving','confused driver','drove into','crashed into','bad driver','rough driving'] },

    // ALLIANCE ROLE
    { id:'must_pick',      cat:'role',        pol:+3, w:3, phrases:['must pick','top pick','first pick','would pick first','definitely pick','alliance captain','pick them first','high priority pick','absolutely pick','pick immediately','pick asap'] },
    { id:'good_pick',      cat:'role',        pol:+2, w:2, phrases:['good pick','solid pick','worth picking','should pick','would pick','recommend picking','great alliance partner','strong partner','great second','great third'] },
    { id:'avoid',          cat:'role',        pol:-3, w:3, phrases:['do not pick','dont pick','avoid','would not pick','wouldnt pick','not worth picking','risky pick','liability','worried about picking','concerned about picking','skip them','pass on them'] },

    // GENERAL
    { id:'impressive',     cat:'general',     pol:+2, w:2, phrases:['impressive','amazing robot','incredible','dominated','stood out','best robot','top robot','excellent','outstanding','best on field','very impressive','one of the best','wow'] },
    { id:'good_overall',   cat:'general',     pol:+1, w:1, phrases:['good robot','solid robot','well built','well designed','looked good','nice robot','good overall','works well','does well','performs well'] },
    { id:'concerning',     cat:'general',     pol:-2, w:2, phrases:['concerning','worried','risky','gamble','unreliable partner','not confident','not sure about','hesitant','on the fence'] },
    { id:'weak_overall',   cat:'general',     pol:-1, w:1, phrases:['weak','underwhelming','disappointing','not great','mediocre','below average','struggled','had trouble','didnt do much','couldnt contribute','not impressive'] },
  ];

  // Build fast phrase lookup
  const PHRASE_MAP = new Map();
  SIGNALS.forEach(sig => {
    sig.phrases.forEach(p => {
      if (!PHRASE_MAP.has(p)) PHRASE_MAP.set(p, []);
      PHRASE_MAP.get(p).push(sig);
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  COLLECT ALL NOTE TEXT FROM ANY ENTRY FORMAT
  //  Handles both current and old competition data field names
  // ─────────────────────────────────────────────────────────────
  function collectNotes(entry) {
    const fields = [
      // Current format
      entry.pm, entry.dn, entry.en, entry.sp,
      entry.autoNotes, entry.teleopNotes, entry.intake,
      // Old / generic formats
      entry.notes, entry.note, entry.comments, entry.comment,
      entry.observation, entry.observations,
      entry.scouter_notes, entry.match_notes,
      entry.general, entry.miscNotes, entry.misc,
      entry.endgame_notes, entry.auto_notes, entry.teleop_notes,
      entry.pre_match, entry.pre_match_notes,
      entry.defense_notes, entry.defense,
      // Catch-all numbered fields some exports use
      entry.field_11, entry.field_12, entry.field_13,
    ];
    return fields.filter(s => s && typeof s === 'string' && s.trim().length > 2).join(' ');
  }

  // ─────────────────────────────────────────────────────────────
  //  EXTRACT SIGNALS FROM ONE NOTE STRING
  // ─────────────────────────────────────────────────────────────
  function extractSignals(text) {
    if (!text || !text.trim()) return [];
    const toks = tokenize(text);
    const grams = [...toks, ...ngrams(toks, 2), ...ngrams(toks, 3)];
    const hits = [];
    const seenIds = new Set();

    grams.forEach(g => {
      const sigs = PHRASE_MAP.get(g);
      if (!sigs) return;
      sigs.forEach(sig => {
        if (seenIds.has(sig.id)) return;
        seenIds.add(sig.id);
        const negated = hasNegationBefore(toks, g.split(' ')[0]);
        const effectivePol = negated ? -sig.pol : sig.pol;
        hits.push({ ...sig, effectivePol, matchedPhrase: g, negated });
      });
    });

    return hits;
  }

  // ─────────────────────────────────────────────────────────────
  //  AGGREGATE SIGNALS ACROSS ALL MATCHES
  // ─────────────────────────────────────────────────────────────
  function aggregateSignals(team) {
    const sd = team.scoutingData || [];
    const pd = team.pitData || null;
    const cats = {};

    const initCat = c => {
      if (!cats[c]) cats[c] = { score: 0, pos: 0, neg: 0, phrases: new Map(), perMatch: [] };
    };

    let totalNoteLength = 0;

    sd.forEach((entry, i) => {
      const noteText = collectNotes(entry);
      totalNoteLength += noteText.length;
      const sigs = extractSignals(noteText);
      const matchNum = String(entry.matchNumber || entry.mt || entry.M || i + 1);
      const matchEntry = { match: matchNum, sigs };
      sigs.forEach(sig => {
        initCat(sig.cat);
        const c = cats[sig.cat];
        c.score += sig.effectivePol * sig.w;
        if (sig.effectivePol > 0) c.pos++;
        else if (sig.effectivePol < 0) c.neg++;
        const phraseKey = sig.negated ? `NOT ${sig.matchedPhrase}` : sig.matchedPhrase;
        c.phrases.set(phraseKey, (c.phrases.get(phraseKey) || 0) + 1);
        c.perMatch.push(matchNum);
      });
    });

    // Pit notes (weighted slightly less)
    if (pd) {
      const pitText = [pd.pitNotes||'', pd.capabilities||''].filter(Boolean).join(' ');
      extractSignals(pitText).forEach(sig => {
        initCat(sig.cat);
        const c = cats[sig.cat];
        c.score += sig.effectivePol * sig.w * 0.6;
        if (sig.effectivePol > 0) c.pos += 0.5;
        else c.neg += 0.5;
        const phraseKey = sig.negated ? `NOT ${sig.matchedPhrase}` : `[pit] ${sig.matchedPhrase}`;
        c.phrases.set(phraseKey, (c.phrases.get(phraseKey) || 0) + 1);
      });
    }

    const notedMatches = sd.filter(e => collectNotes(e).trim().length > 5).length;
    return { cats, matchCount: sd.length, notedMatches, totalNoteLength };
  }

  // ─────────────────────────────────────────────────────────────
  //  QUANTITATIVE STATS
  // ─────────────────────────────────────────────────────────────
  function extractStats(team) {
    const sd = team.scoutingData || [];
    const pd = team.pitData || null;
    const n = sd.length;
    if (n === 0) return null;

    const ptsArr  = sd.map(e => parseFloat(e.pts)||0).filter(v => v > 0);
    const cyArr   = sd.map(e => parseInt(e.cy)||0).filter(v => v > 0);
    const fcArr   = sd.map(e => parseInt(e.fc)||0);
    const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;

    const climbEntries = sd.filter(e => {
      const cl = (e.cl||'').trim();
      return cl && cl !== '—' && cl.toLowerCase() !== 'none' && cl !== '';
    });
    const climbLevels = [...new Set(climbEntries.map(e => e.cl.trim()))];
    const levelOrder  = { L4:4, L3:3, L2:2, L1:1 };
    const topClimb    = climbLevels.sort((a,b) => (levelOrder[b]||0)-(levelOrder[a]||0))[0] || null;

    const disabledMatches = sd.filter(e => {
      const rs = (e.rs||'').toLowerCase();
      return rs.includes('disabled') || rs.includes('brownout') || rs.includes('e-stop') || rs.includes('estop');
    }).length;

    let autoScoredMatches = 0;
    sd.forEach(e => {
      const ev = e.ev || e.log || '';
      if (!ev) return;
      if (ev.split(';').filter(l => l.includes('[a]')).some(l => l.toUpperCase().includes('SCORE'))) autoScoredMatches++;
    });

    return {
      n, avgPts: avg(ptsArr), avgCycles: avg(cyArr), avgFouls: avg(fcArr),
      climbRate: n > 0 ? climbEntries.length / n : 0,
      climbCount: climbEntries.length, topClimb,
      disabledMatches,
      autoRate: n > 0 ? autoScoredMatches / n : 0,
      autoScoredMatches,
      pitCanClimb:  pd?.canClimb,
      pitClimbType: pd?.climbType && pd.climbType !== 'N/A' ? pd.climbType : null,
      pitDrive:     pd?.driveTrain && pd.driveTrain !== 'N/A' ? pd.driveTrain : null,
      pitWeight:    pd?.weight && pd.weight !== 'N/A' ? pd.weight : null,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  TOP PHRASES HELPER — returns most-cited phrases from a cat
  // ─────────────────────────────────────────────────────────────
  function topPhrases(cat, maxCount = 2, excludeNot = false) {
    if (!cat?.phrases?.size) return [];
    return [...cat.phrases.entries()]
      .filter(([p]) => !excludeNot || !p.startsWith('NOT '))
      .sort((a,b) => b[1]-a[1])
      .slice(0, maxCount)
      .map(([p, c]) => c > 1 ? `"${p.replace('[pit] ','')}" (×${c})` : `"${p.replace('[pit] ','')}"`);
  }

  // ─────────────────────────────────────────────────────────────
  //  BUILD BULLETS — the core synthesis engine
  // ─────────────────────────────────────────────────────────────
  function buildBullets(team) {
    const { cats, matchCount: n, notedMatches, totalNoteLength } = aggregateSignals(team);
    const stats = extractStats(team);
    const bullets = [];
    const add = (type, text) => bullets.push({ type, text });

    if (!stats && totalNoteLength < 10) return [];

    // ── AUTO ─────────────────────────────────────────────────────
    const autoC = cats.auto;
    const autoPos = (autoC?.score || 0) > 0;
    const autoNeg = (autoC?.score || 0) < 0;
    const autoNegPhrases = topPhrases(autoC, 2, true).filter(p => !p.startsWith('"NOT '));

    if (stats) {
      if (stats.autoRate >= 0.85) {
        const qualifier = autoPos ? ' and scouts consistently praised the routine' : '';
        add('strength', `Strong autonomous — scored in ${stats.autoScoredMatches}/${n} matches${qualifier}.`);
      } else if (stats.autoRate >= 0.5) {
        if (autoNeg && autoNegPhrases.length)
          add('neutral', `Auto works roughly half the time (${stats.autoScoredMatches}/${n} matches) — scouts noted specific problems: ${autoNegPhrases.join(', ')}.`);
        else
          add('neutral', `Auto present in ${stats.autoScoredMatches}/${n} matches but not guaranteed every round.`);
      } else if (stats.autoRate > 0) {
        const detail = autoNegPhrases.length ? ` Scouts noted: ${autoNegPhrases.join(', ')}.` : '';
        add('concern', `Unreliable auto — only scored in ${stats.autoScoredMatches}/${n} matches.${detail}`);
      } else if (n >= 2) {
        const detail = autoNeg && autoNegPhrases.length ? ` Scouts specifically called out: ${autoNegPhrases.join(', ')}.` : '';
        add('concern', `No auto scoring recorded in ${n} observed matches.${detail}`);
      }
    } else if (autoC) {
      if (autoPos) add('strength', `Scouts noted positive auto performance.`);
      else if (autoNeg) add('concern', `Scouts flagged auto problems: ${topPhrases(autoC,2,true).join(', ')}.`);
    }

    // ── CLIMB ────────────────────────────────────────────────────
    const climbC  = cats.climb;
    const climbNeg = climbC?.neg || 0;
    const climbPos = climbC?.pos || 0;
    const climbNegPhrases = topPhrases(climbC, 2, true).filter(p => !p.includes('l1') && !p.includes('l2') && !p.includes('l3') && !p.includes('l4'));

    if (stats) {
      if (stats.topClimb && stats.climbRate >= 0.8) {
        const suffix = climbNeg > 0 ? `, though scouts noted ${Math.round((1-stats.climbRate)*n)} failed attempt(s)` : '';
        add('strength', `Reliable endgame — achieves ${stats.topClimb} in ${stats.climbCount}/${n} matches${suffix}.`);
      } else if (stats.topClimb && stats.climbRate >= 0.4) {
        const detail = climbNeg >= 2 ? ` Multiple scouts flagged climb failures.` : '';
        add('neutral', `Capable of ${stats.topClimb} but inconsistent — climbed in ${stats.climbCount}/${n} matches.${detail}`);
      } else if (stats.topClimb && stats.climbRate < 0.4) {
        add('concern', `Climb is a major concern — ${stats.topClimb} only achieved ${stats.climbCount}/${n} times. Scouts noted: ${climbNegPhrases.length ? climbNegPhrases.join(', ') : 'repeated failures'}.`);
      } else if (stats.pitCanClimb && stats.climbRate === 0 && n >= 2) {
        add('discrepancy', `Pit scouting claims climb capability${stats.pitClimbType ? ` (${stats.pitClimbType})` : ''} but zero climbs observed across ${n} matches — verify before selecting.`);
      } else if (!stats.topClimb && n >= 2) {
        const detail = climbNeg > 0 ? ` Scouts noted failed attempts.` : '';
        add('concern', `No endgame climb recorded in ${n} matches.${detail}`);
      }
    } else if (climbC) {
      if (climbPos > climbNeg) add('strength', `Scouts noted successful climbs.`);
      else if (climbNeg > climbPos) add('concern', `Scouts flagged climb issues: ${climbNegPhrases.join(', ')}.`);
    }

    // ── SCORING / CYCLES ─────────────────────────────────────────
    const scoreC = cats.scoring;
    const mechC  = cats.mechanism;
    const scoringProblems = [
      ...topPhrases(scoreC, 2, true),
      ...topPhrases(mechC,  2, true),
    ].slice(0, 3);

    if (stats?.avgPts !== null) {
      if (stats.avgPts >= 35 || (stats.avgCycles && stats.avgCycles >= 5)) {
        const cyStr = stats.avgCycles ? `, ${stats.avgCycles.toFixed(1)} cycles` : '';
        const qualifier = scoreC?.pos > 1 ? ' Scouts praised their output.' : '';
        add('strength', `High-output scorer — avg ${stats.avgPts.toFixed(0)} pts${cyStr}/match.${qualifier}`);
      } else if (stats.avgPts < 12 && n >= 2) {
        const detail = scoringProblems.length ? ` Scouts noted: ${scoringProblems.join(', ')}.` : '';
        add('concern', `Low scoring output — avg ${stats.avgPts.toFixed(0)} pts/match across ${n} matches.${detail}`);
      } else {
        const cyStr = stats.avgCycles ? `, ${stats.avgCycles.toFixed(1)} cycles` : '';
        add('neutral', `Moderate scorer — avg ${stats.avgPts.toFixed(0)} pts${cyStr}/match.`);
      }
    }

    // Specific mechanism failures mentioned by name
    if (scoringProblems.length >= 2 && (scoreC?.neg >= 2 || mechC?.neg >= 1)) {
      add('concern', `Scouts called out specific mechanism issues across multiple matches: ${scoringProblems.join(', ')}.`);
    }

    // ── RELIABILITY ──────────────────────────────────────────────
    const relC = cats.reliability;
    if (stats?.disabledMatches >= 2) {
      add('concern', `High reliability risk — disabled, brownout, or disconnected in ${stats.disabledMatches}/${n} matches.`);
    } else if (stats?.disabledMatches === 1) {
      const relPhrases = topPhrases(relC, 1, true);
      add('concern', `Had a disable/electrical event in 1 match${relPhrases.length ? ` — scouts noted ${relPhrases[0]}` : ''}. Monitor closely.`);
    }

    // Breakdown phrases from notes even without a "disabled" robot status
    if (relC?.neg >= 2 && (!stats || stats.disabledMatches < 2)) {
      add('concern', `Scouts flagged mechanical/electrical issues in multiple matches: ${topPhrases(relC,2,true).join(', ')}.`);
    } else if (mechC?.neg >= 2) {
      add('concern', `Repeated mechanism failures noted: ${topPhrases(mechC,3,true).join(', ')}.`);
    } else if (relC?.score >= 4) {
      add('strength', `Scouts consistently noted strong mechanical reliability.`);
    }

    // ── FOULS / DEFENSE ──────────────────────────────────────────
    const foulC = cats.fouls;
    const defC  = cats.defense;
    if (stats?.avgFouls >= 1.5) {
      add('concern', `Foul-prone — avg ${stats.avgFouls.toFixed(1)} fouls/match. Costs alliance RP and ranking points.`);
    } else if (foulC?.neg >= 2) {
      add('concern', `Scouts flagged repeated foul issues: ${topPhrases(foulC,2,true).join(', ')}.`);
    }
    if (defC?.pos >= 2) {
      add('neutral', `Plays effective defense — noted positively in multiple matches.`);
    }

    // ── DRIVING ──────────────────────────────────────────────────
    const drvC = cats.driving;
    if (drvC?.score >= 4) {
      add('strength', `Exceptional drive team — scouts highlighted: ${topPhrases(drvC,2,true).join(', ')}.`);
    } else if (drvC?.score <= -3) {
      add('concern', `Driving concerns noted across multiple matches: ${topPhrases(drvC,2,true).join(', ')}.`);
    }

    // ── ALLIANCE ROLE SIGNALS ─────────────────────────────────────
    const roleC = cats.role;
    if (roleC?.pos >= 2) {
      add('strength', `Scouts explicitly recommended as a high-priority pick: ${topPhrases(roleC,1,true).join(', ')}.`);
    } else if (roleC?.pos === 1 && (roleC?.score||0) > 0) {
      add('neutral', `At least one scout recommended picking this team.`);
    }
    if (roleC?.neg >= 1) {
      add('concern', `Scout(s) cautioned against picking this team: ${topPhrases(roleC,2,true).join(', ')}.`);
    }

    // ── GENERAL ──────────────────────────────────────────────────
    const genC = cats.general;
    if ((genC?.score||0) >= 4 && bullets.filter(b=>b.type==='strength').length === 0) {
      add('strength', `Scouts were consistently impressed with this robot overall.`);
    } else if ((genC?.score||0) <= -3 && bullets.filter(b=>b.type==='concern').length === 0) {
      add('concern', `Scouts expressed concern about overall performance: ${topPhrases(genC,2,true).join(', ')}.`);
    }

    // ── LOW DATA WARNING ─────────────────────────────────────────
    if (n >= 3 && notedMatches < n * 0.3) {
      add('info', `Only ${notedMatches}/${n} match entries contain written notes — intel above is limited. Stats still reflect full dataset.`);
    }

    // Deduplicate
    const seen = new Set();
    return bullets.filter(b => {
      const key = b.text.substring(0, 55);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  DATA QUALITY
  // ─────────────────────────────────────────────────────────────
  function dataQuality(team) {
    const sd = team.scoutingData || [];
    if (!sd.length) return 'none';
    const noted = sd.filter(e => collectNotes(e).trim().length > 5).length;
    const ratio = noted / sd.length;
    if (ratio >= 0.7) return 'high';
    if (ratio >= 0.35) return 'medium';
    return 'low';
  }

  // ─────────────────────────────────────────────────────────────
  //  PUBLIC: RENDER HTML
  // ─────────────────────────────────────────────────────────────
  function renderSummaryHTML(team) {
    if (!team) return '';
    const sd = team.scoutingData || [];
    const n  = sd.length;
    if (n === 0 && !team.pitData) return '';

    const bullets = buildBullets(team);
    const dq = dataQuality(team);
    const notedN = sd.filter(e => collectNotes(e).trim().length > 5).length;

    if (bullets.length === 0) {
      return `<div style="background:rgba(245,197,24,0.04);border:1px solid rgba(245,197,24,0.15);border-radius:14px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:var(--txt-3);">
        <span style="color:var(--gold);font-weight:700;font-size:10px;letter-spacing:1px;text-transform:uppercase;">⬡ Scout Intel</span>
        &nbsp;&nbsp;${n} match${n!==1?'es':''} scouted — no structured notes to analyze yet.
      </div>`;
    }

    const cfg = {
      strength:    { icon:'✦', color:'var(--yes)',  bg:'rgba(48,209,88,0.08)',  border:'rgba(48,209,88,0.25)'  },
      concern:     { icon:'⚠', color:'#fb923c',     bg:'rgba(251,146,60,0.09)', border:'rgba(251,146,60,0.3)'  },
      discrepancy: { icon:'⚡',color:'#f59e0b',     bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.4)'  },
      neutral:     { icon:'◆', color:'#5ac8fa',     bg:'rgba(90,200,250,0.07)', border:'rgba(90,200,250,0.2)'  },
      info:        { icon:'ℹ', color:'var(--txt-3)',bg:'var(--ink-4)',           border:'var(--ink-5)'          },
    };

    const dqLabel = { high:'● High confidence', medium:'◐ Medium confidence', low:'○ Limited notes', none:'○ No data' }[dq];
    const dqColor = { high:'var(--yes)', medium:'var(--maybe)', low:'var(--txt-3)', none:'var(--no)' }[dq];

    let html = `<div style="background:linear-gradient(135deg,rgba(245,197,24,0.07) 0%,rgba(245,197,24,0.02) 100%);border:1px solid rgba(245,197,24,0.22);border-radius:14px;padding:14px 16px;margin-bottom:16px;">`;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="background:rgba(245,197,24,0.15);border:1px solid rgba(245,197,24,0.3);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">⬡ Scout Intel</div>
        <span style="font-size:10px;color:var(--txt-3);">${n} match${n!==1?'es':''} · ${notedN} with notes</span>
      </div>
      <span style="font-size:10px;color:${dqColor};font-weight:600;">${dqLabel}</span>
    </div><div style="display:flex;flex-direction:column;gap:6px;">`;

    bullets.forEach(b => {
      const c = cfg[b.type] || cfg.info;
      html += `<div style="display:flex;align-items:flex-start;gap:10px;background:${c.bg};border:1px solid ${c.border};border-radius:8px;padding:8px 12px;">
        <span style="font-size:13px;flex-shrink:0;margin-top:1px;color:${c.color};">${c.icon}</span>
        <span style="font-size:13px;line-height:1.55;color:var(--txt);flex:1;">${b.text}</span>
      </div>`;
    });

    html += `</div></div>`;
    return html;
  }

  return { renderSummaryHTML, buildBullets, extractSignals, collectNotes };

})();

if (typeof window !== 'undefined') window.ScoutSummarizer = ScoutSummarizer;
if (typeof module !== 'undefined') module.exports = ScoutSummarizer;