/**
 * ═══════════════════════════════════════════════════════════════
 *  SCOUT SUMMARIZER  —  Team 935 & 757 Strategy Portal
 *
 *  Primary:  Ollama local LLM (phi3:mini recommended)
 *            Streams response live into the card
 *            Caches result into team.aiSummary for tablets
 *
 *  Fallback: Local tokenization-based rule engine
 *            Used when Ollama is offline / not installed
 *
 *  Ollama setup:
 *    1. Install: https://ollama.com
 *    2. Pull model: ollama pull phi3:mini
 *    3. Run: ollama serve   (auto-starts on most installs)
 *    4. Verify: http://localhost:11434
 * ═══════════════════════════════════════════════════════════════
 */

const ScoutSummarizer = (() => {

  // ── CONFIG ──────────────────────────────────────────────────
  const OLLAMA_URL   = 'http://localhost:11434/api/generate';
  const OLLAMA_MODEL = 'phi3:mini';
  const TIMEOUT_MS   = 60000;

  // ── CACHE ────────────────────────────────────────────────────
  const _cache = new Map(); // teamNumber → { text, source }

  // ─────────────────────────────────────────────────────────────
  //  DATA FORMATTER
  // ─────────────────────────────────────────────────────────────

  function collectNotes(entry) {
    return [
      entry.pm, entry.dn, entry.en, entry.sp,
      entry.autoNotes, entry.teleopNotes, entry.intake,
      entry.notes, entry.note, entry.comments, entry.comment,
      entry.observation, entry.observations,
      entry.scouter_notes, entry.match_notes,
      entry.general, entry.miscNotes, entry.misc,
      entry.endgame_notes, entry.auto_notes, entry.teleop_notes,
      entry.pre_match, entry.pre_match_notes,
      entry.defense_notes, entry.defense,
      entry.field_11, entry.field_12, entry.field_13,
    ].filter(s => s && typeof s === 'string' && s.trim().length > 2)
     .map(s => s.trim())
     .join(' | ');
  }

  function buildPromptContext(team) {
    const sd  = team.scoutingData || [];
    const pd  = team.pitData || null;
    const n   = sd.length;
    const epa = team.epa?.toFixed ? team.epa.toFixed(1) : (team.epa || '—');

    const ptsArr = sd.map(e => parseFloat(e.pts)||0).filter(v => v > 0);
    const cyArr  = sd.map(e => parseInt(e.cy)||0).filter(v => v > 0);
    const fcArr  = sd.map(e => parseInt(e.fc)||0);
    const avg    = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : null;

    const climbEntries = sd.filter(e => {
      const cl = (e.cl||'').trim();
      return cl && cl !== '—' && cl.toLowerCase() !== 'none';
    });
    const climbLevels = [...new Set(climbEntries.map(e => e.cl.trim()))];
    const levelOrder  = { L4:4, L3:3, L2:2, L1:1 };
    const topClimb    = climbLevels.sort((a,b) => (levelOrder[b]||0)-(levelOrder[a]||0))[0] || 'none';

    const disabledCount = sd.filter(e => {
      const rs = (e.rs||'').toLowerCase();
      return rs.includes('disabled') || rs.includes('brownout') || rs.includes('e-stop');
    }).length;

    let autoScoredCount = 0;
    sd.forEach(e => {
      const ev = e.ev || e.log || '';
      if (ev.split(';').filter(l => l.includes('[a]')).some(l => l.toUpperCase().includes('SCORE')))
        autoScoredCount++;
    });

    const climbRate = n > 0 ? `${climbEntries.length}/${n}` : '0/0';

    let ctx = `TEAM ${team.number} — ${team.name}
Event rank: #${team.rank || '?'} | Record: ${team.record || '?'} | EPA: ${epa}
Matches scouted: ${n}
Avg pts/match: ${avg(ptsArr) || '?'} | Avg cycles: ${avg(cyArr) || '?'} | Avg fouls given: ${avg(fcArr) || '0'}
Auto scoring: ${autoScoredCount}/${n} matches
Climb: ${topClimb} achieved ${climbRate} matches
Disabled/brownout events: ${disabledCount}/${n}`;

    if (pd) {
      const pitLines = [];
      if (pd.driveTrain   && pd.driveTrain   !== 'N/A') pitLines.push(`Drivetrain: ${pd.driveTrain}`);
      if (pd.weight       && pd.weight       !== 'N/A') pitLines.push(`Weight: ${pd.weight}lbs`);
      if (pd.shooter      && pd.shooter      !== 'N/A') pitLines.push(`Shooter: ${pd.shooter}`);
      if (pd.climbType    && pd.climbType    !== 'N/A') pitLines.push(`Climb type: ${pd.climbType}`);
      if (pd.capabilities && pd.capabilities !== 'N/A') pitLines.push(`Capabilities: ${pd.capabilities}`);
      if (pd.crossingPref && pd.crossingPref !== 'N/A') pitLines.push(`Crossing pref: ${pd.crossingPref}`);
      if (pd.pitNotes     && pd.pitNotes     !== 'N/A') pitLines.push(`Pit notes: ${pd.pitNotes}`);
      pitLines.push(`Claims can climb: ${pd.canClimb ? 'yes' : 'no'}`);
      ctx += `\n\nPIT SCOUTING:\n${pitLines.join('\n')}`;
    }

    const matchLines = [];
    sd.forEach((e, i) => {
      const matchNum = e.matchNumber || e.mt || e.M || (i + 1);
      const alliance = (e.al || e.alliance || '').toUpperCase() || '?';
      const notes    = collectNotes(e);
      const pts      = e.pts !== undefined && e.pts !== '' ? `${e.pts}pts` : '';
      const cycles   = e.cy  !== undefined && e.cy  !== '' ? `${e.cy}cy`  : '';
      const climb    = e.cl && e.cl !== '—' && e.cl.toLowerCase() !== 'none' ? `climb:${e.cl}` : 'no-climb';
      const fouls    = e.fc  !== undefined && e.fc  !== '' && parseInt(e.fc) > 0 ? `${e.fc}fouls` : '';
      const status   = e.rs && e.rs.toLowerCase() !== 'operational' ? `[${e.rs}]` : '';
      const statStr  = [pts, cycles, climb, fouls, status].filter(Boolean).join(' ');
      if (notes || statStr) matchLines.push(`M${matchNum}(${alliance}): ${statStr}${notes ? ' — ' + notes : ''}`);
    });
    if (matchLines.length) ctx += `\n\nPER-MATCH DATA:\n${matchLines.join('\n')}`;

    return ctx;
  }

  function buildPrompt(team) {
    const ctx = buildPromptContext(team);
    return `You are a Lead Scout. Write a 3-sentence field report on the robot's playstyle.

RULES:
No "I", "me", "we", or "recommend."
No filler. Brutally honest.
Focus on: movement, scoring ability, and handling.
Use raw scout notes for on-field personality.
Never cut sentences short.
Robots cross the bump/trench; cross the bump to get fuel/score. Top robots play strategically and controlling of area.
avoid specifics and give a general overview of the bot
DISREGARD ANY DATA ABOUT CLIMBING, DO NOT INCLUDE IN YOUR RESPONSE

DATA:
${ctx}

Field Analysis:`;
  }

  // ─────────────────────────────────────────────────────────────
  //  OLLAMA STREAMING CALL
  // ─────────────────────────────────────────────────────────────

  async function callOllama(prompt, onChunk) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(OLLAMA_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        model:  OLLAMA_MODEL,
        prompt,
        stream: true,
        options: {
          temperature: 0.2,
          top_p:       0.9,
          num_predict: 300,   // enough room for 3 full sentences without runaway
          stop:        ['\n\n\n\n'],  // only stop on 4+ blank lines — don't cut mid-thought
        }
      }),
    });

    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   full    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.response) {
            full += obj.response;
            onChunk(obj.response, full);
          }
          if (obj.done) break;
        } catch { /* partial JSON chunk */ }
      }
    }

    return full.trim();
  }

  // ─────────────────────────────────────────────────────────────
  //  TRIM OUTPUT — keep only up to 3 complete sentences
  //  Prevents runaway while never cutting mid-sentence
  // ─────────────────────────────────────────────────────────────

  function trimToSentences(text, maxSentences = 3) {
    // Split on sentence-ending punctuation followed by whitespace or end of string
    const sentenceEnds = /([.!?])\s+/g;
    const sentences = [];
    let last = 0;
    let match;

    while ((match = sentenceEnds.exec(text)) !== null) {
      sentences.push(text.slice(last, match.index + 1).trim());
      last = match.index + match[0].length;
      if (sentences.length >= maxSentences) break;
    }

    // If the remaining text ends with punctuation, grab it too (last sentence)
    if (sentences.length < maxSentences && last < text.length) {
      const remainder = text.slice(last).trim();
      if (remainder && /[.!?]$/.test(remainder)) sentences.push(remainder);
    }

    return sentences.length ? sentences.join(' ') : text.trim();
  }

  // ─────────────────────────────────────────────────────────────
  //  CHECK IF OLLAMA IS REACHABLE
  // ─────────────────────────────────────────────────────────────

  async function ollamaReachable() {
    try {
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(1500)
      });
      return res.ok;
    } catch { return false; }
  }

  // ─────────────────────────────────────────────────────────────
  //  RULE-BASED FALLBACK
  // ─────────────────────────────────────────────────────────────

  function ruleFallback(team) {
    const sd = team.scoutingData || [];
    const pd = team.pitData || null;
    const n  = sd.length;
    if (n === 0 && !pd) return null;

    const parts = [];

    const ptsArr = sd.map(e => parseFloat(e.pts)||0).filter(v => v > 0);
    const avgPts = ptsArr.length ? ptsArr.reduce((a,b)=>a+b,0)/ptsArr.length : null;

    const climbEntries = sd.filter(e => {
      const cl = (e.cl||'').trim();
      return cl && cl !== '—' && cl.toLowerCase() !== 'none';
    });
    const levelOrder = { L4:4, L3:3, L2:2, L1:1 };
    const topClimb   = [...new Set(climbEntries.map(e=>e.cl.trim()))]
      .sort((a,b)=>(levelOrder[b]||0)-(levelOrder[a]||0))[0] || null;
    const climbRate  = n > 0 ? climbEntries.length/n : 0;

    let autoCount = 0;
    sd.forEach(e => {
      const ev = e.ev || e.log || '';
      if (ev.split(';').filter(l=>l.includes('[a]')).some(l=>l.toUpperCase().includes('SCORE'))) autoCount++;
    });

    const disabled = sd.filter(e => {
      const rs = (e.rs||'').toLowerCase();
      return rs.includes('disabled') || rs.includes('brownout');
    }).length;

    if (avgPts !== null) {
      if (avgPts >= 30)      parts.push(`Strong scorer averaging ${avgPts.toFixed(0)} pts/match across ${n} matches.`);
      else if (avgPts < 12)  parts.push(`Low output — averaging only ${avgPts.toFixed(0)} pts/match.`);
      else                   parts.push(`Moderate contributor — ${avgPts.toFixed(0)} avg pts/match over ${n} matches.`);
    }

    if (autoCount > 0) {
      const pct = Math.round(autoCount/n*100);
      parts.push(pct >= 80
        ? `Auto is consistent (${autoCount}/${n} matches).`
        : `Auto scored in ${autoCount}/${n} matches — inconsistent.`);
    } else if (n >= 2) {
      parts.push(`No auto scoring recorded in ${n} matches.`);
    }

    if (topClimb && climbRate >= 0.75)  parts.push(`Reliable ${topClimb} endgame (${climbEntries.length}/${n} matches).`);
    else if (topClimb)                   parts.push(`${topClimb} capable but inconsistent — climbed ${climbEntries.length}/${n} times.`);
    else if (pd?.canClimb && n >= 2)     parts.push(`Pit claims climb but none observed — verify before picking.`);
    else if (n >= 2)                     parts.push(`No endgame climb observed.`);

    if (disabled >= 2) parts.push(`Reliability concern: disabled/brownout in ${disabled}/${n} matches.`);

    const allNotes = sd.map(e => collectNotes(e)).filter(Boolean);
    if (allNotes.length) {
      const sample = allNotes.slice(0,3).join(' ').substring(0,200);
      parts.push(`Scout notes: "${sample}${sample.length >= 200 ? '…' : ''}"`);
    }

    return parts.length ? parts.join(' ') : null;
  }

  // ─────────────────────────────────────────────────────────────
  //  MAIN RENDER
  // ─────────────────────────────────────────────────────────────

  function renderSummaryHTML(team) {
    if (!team) return '';
    const sd = team.scoutingData || [];
    const n  = sd.length;
    if (n === 0 && !team.pitData) return '';

    const containerId = `ai-summary-${team.number}`;

    if (team.aiSummary?.text) {
      const age    = team.aiSummary.generatedAt
        ? Math.round((Date.now() - team.aiSummary.generatedAt) / 60000)
        : null;
      const ageStr = age !== null ? (age < 2 ? 'just now' : `${age}m ago`) : '';
      return buildSummaryCard({ id: containerId, text: team.aiSummary.text, source: team.aiSummary.source || 'ai', ageStr, team, cached: true });
    }

    setTimeout(() => generateAndInject(team, containerId), 50);
    return buildLoadingCard(containerId, team);
  }

  // ─────────────────────────────────────────────────────────────
  //  GENERATE + INJECT
  // ─────────────────────────────────────────────────────────────

  async function generateAndInject(team, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (_cache.has(team.number)) {
      const cached = _cache.get(team.number);
      persistSummary(team, cached.text, cached.source);
      el.outerHTML = buildSummaryCard({ id: containerId, text: cached.text, source: cached.source, ageStr: 'just now', team, cached: true });
      return;
    }

    const reachable = await ollamaReachable();

    if (!reachable) {
      const fallbackText = ruleFallback(team);
      if (!fallbackText) { el.remove(); return; }
      persistSummary(team, fallbackText, 'rules');
      const newEl = document.getElementById(containerId);
      if (newEl) newEl.outerHTML = buildSummaryCard({ id: containerId, text: fallbackText, source: 'rules', ageStr: '', team, cached: false });
      return;
    }

    try {
      const prompt   = buildPrompt(team);
      const streamEl = document.getElementById(containerId);
      if (!streamEl) return;

      streamEl.innerHTML = buildStreamingInner(containerId);

      let fullText = '';
      await callOllama(prompt, (chunk, full) => {
        fullText = full;
        const textEl = document.getElementById(`${containerId}-stream`);
        if (textEl) textEl.textContent = full;
      });

      // Strip filler openers
      fullText = fullText.trim()
        .replace(/^(Certainly!?|Sure!?|Of course!?|Here('s| is) (the|a|your) (brief|summary|intel|analysis|report):?\s*)/i, '')
        .replace(/^(Based on the (data|scouting data|information)[^.]*\.\s*)/i, '')
        .replace(/^Field Analysis:\s*/i, '')
        .trim();

      // Trim to 3 complete sentences — never cuts mid-sentence
      fullText = trimToSentences(fullText, 3);

      if (!fullText) throw new Error('empty response');

      persistSummary(team, fullText, 'ai');
      const finalEl = document.getElementById(containerId);
      if (finalEl) finalEl.outerHTML = buildSummaryCard({ id: containerId, text: fullText, source: 'ai', ageStr: 'just now', team, cached: false });

    } catch (err) {
      console.warn('Ollama error, falling back:', err.message);
      const fallbackText = ruleFallback(team);
      if (!fallbackText) { const e = document.getElementById(containerId); if (e) e.remove(); return; }
      persistSummary(team, fallbackText, 'rules');
      const errEl = document.getElementById(containerId);
      if (errEl) errEl.outerHTML = buildSummaryCard({ id: containerId, text: fallbackText, source: 'rules', ageStr: '', team, cached: false });
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  PERSIST
  // ─────────────────────────────────────────────────────────────

  function persistSummary(team, text, source) {
    team.aiSummary = { text, source, generatedAt: Date.now() };
    _cache.set(team.number, { text, source });
    if (typeof saveSession === 'function') saveSession();
  }

  // ─────────────────────────────────────────────────────────────
  //  HTML BUILDERS
  // ─────────────────────────────────────────────────────────────

  function buildLoadingCard(id, team) {
    const n = (team.scoutingData||[]).length;
    return `<div id="${id}" style="background:linear-gradient(135deg,rgba(245,197,24,0.07) 0%,rgba(245,197,24,0.02) 100%);border:1px solid rgba(245,197,24,0.22);border-radius:14px;padding:14px 16px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="background:rgba(245,197,24,0.15);border:1px solid rgba(245,197,24,0.3);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">⬡ Scout Intel</div>
          <span style="font-size:10px;color:var(--txt-3);">Generating…</span>
        </div>
        <span style="font-size:10px;color:var(--maybe);">● AI</span>
      </div>
      <div style="font-size:13px;color:var(--txt-3);font-style:italic;line-height:1.6;display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gold);animation:pulse-dot 1s ease-in-out infinite;"></span>
        Analyzing ${n} match${n!==1?'es':''} of scouting data…
      </div>
      <style>@keyframes pulse-dot{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}</style>
    </div>`;
  }

  function buildStreamingInner(containerId) {
    return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="background:rgba(245,197,24,0.15);border:1px solid rgba(245,197,24,0.3);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">⬡ Scout Intel</div>
        </div>
        <span style="font-size:10px;color:var(--maybe);">● Thinking…</span>
      </div>
      <div id="${containerId}-stream" style="font-size:13px;color:var(--txt);line-height:1.65;white-space:pre-wrap;"><span style="display:inline-block;width:2px;height:14px;background:var(--gold);margin-left:2px;animation:blink-cursor 0.7s step-end infinite;vertical-align:text-bottom;"></span></div>
      <style>@keyframes blink-cursor{0%,100%{opacity:1}50%{opacity:0}}</style>`;
  }

  function buildSummaryCard({ id, text, source, ageStr, team, cached }) {
    const sourceLabel = source === 'ai' ? '● AI · phi3:mini' : '● Rule-based';
    const sourceColor = source === 'ai' ? 'var(--maybe)' : 'var(--txt-3)';
    const notedN = (team.scoutingData||[]).filter(e => collectNotes(e).trim().length > 5).length;
    const totalN = (team.scoutingData||[]).length;

    return `<div id="${id}" style="background:linear-gradient(135deg,rgba(245,197,24,0.07) 0%,rgba(245,197,24,0.02) 100%);border:1px solid rgba(245,197,24,0.22);border-radius:14px;padding:14px 16px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="background:rgba(245,197,24,0.15);border:1px solid rgba(245,197,24,0.3);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">⬡ Scout Intel</div>
          <span style="font-size:10px;color:var(--txt-3);">${totalN} match${totalN!==1?'es':''} · ${notedN} with notes${ageStr ? ' · ' + ageStr : ''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:10px;color:${sourceColor};font-weight:600;">${sourceLabel}</span>
          <button onclick="ScoutSummarizer.regenerate(${team.number},'${id}')" style="background:var(--ink-4);border:1px solid var(--ink-5);color:var(--txt-3);height:22px;padding:0 8px;border-radius:5px;font-size:10px;font-weight:600;cursor:pointer;transition:background 0.15s,color 0.15s;" onmouseover="this.style.background='rgba(245,197,24,0.12)';this.style.color='var(--gold)'" onmouseout="this.style.background='';this.style.color=''">↻ Refresh</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--txt);line-height:1.65;">${escapeHtml(text)}</div>
    </div>`;
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/\n/g,'<br>');
  }

  // ─────────────────────────────────────────────────────────────
  //  PUBLIC: REGENERATE
  // ─────────────────────────────────────────────────────────────

  function regenerate(teamNumber, containerId) {
    const team = (typeof teams !== 'undefined' ? teams : []).find(t => t.number === teamNumber);
    if (!team) return;
    delete team.aiSummary;
    _cache.delete(teamNumber);
    const el = document.getElementById(containerId);
    if (el) el.outerHTML = buildLoadingCard(containerId, team);
    setTimeout(() => generateAndInject(team, containerId), 50);
  }

  // ─────────────────────────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────────────────────────
  return {
    renderSummaryHTML,
    regenerate,
    buildPromptContext,
    collectNotes,
    ruleFallback,
  };

})();

if (typeof window !== 'undefined') window.ScoutSummarizer = ScoutSummarizer;
if (typeof module !== 'undefined') module.exports = ScoutSummarizer;