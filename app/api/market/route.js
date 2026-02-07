// app/api/market/route.js
// Server-side API route — fetches live data from Yahoo Finance + FRED + CBOE
// No CORS issues because this runs on the server

export const revalidate = 0;

// ── YAHOO FINANCE ──
async function fetchYahoo(symbol, range = "6mo", interval = "1d") {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${symbol}`);
    const meta = result.meta;
    const closes = (result.indicators?.quote?.[0]?.close || []).filter(v => v !== null && v !== undefined);
    return {
      current: meta.regularMarketPrice,
      previousClose: closes.length >= 2 ? closes.filter(v => v !== null && v !== undefined).slice(-2)[0] : (meta.previousClose || meta.chartPreviousClose),
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      history: closes.slice(-30),
      allHistory: closes,
      ok: true
    };
  } catch (e) {
    console.error(`Yahoo ${symbol}:`, e.message);
    return { ok: false, error: e.message };
  }
}

// ── FRED API ──
async function fetchFRED(seriesId, limit = 60) {
  try {
    const key = process.env.FRED_API_KEY;
    if (!key || key === "your_fred_api_key_here") return { ok: false, error: "FRED_API_KEY not set" };
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`);
    const json = await res.json();
    const obs = (json.observations || []).filter(o => o.value !== ".").map(o => ({ date: o.date, value: parseFloat(o.value) })).reverse();
    return { ok: true, observations: obs, latest: obs[obs.length - 1]?.value };
  } catch (e) {
    console.error(`FRED ${seriesId}:`, e.message);
    return { ok: false, error: e.message };
  }
}

// ── CBOE PUT/CALL CSV ──
// Fetches the CBOE archive CSV with Total, Index, and Equity put/call ratios
async function fetchCBOE() {
  try {
    const url = "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/pcratioarchive.csv";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CBOE CSV: ${res.status}`);
    const text = await res.text();
    
    // Parse CSV — format: DATE, TOTAL P/C, INDEX P/C, EQUITY P/C
    const lines = text.split("\n").filter(l => l.match(/^\d+\/\d+\/\d+/));
    const last60 = lines.slice(-60);
    
    const data = last60.map(line => {
      const parts = line.split(",");
      return {
        date: parts[0]?.trim(),
        total: parseFloat(parts[1]) || null,   // PCC - Total put/call
        index: parseFloat(parts[2]) || null,    // Index put/call
        equity: parseFloat(parts[3]) || null,   // CPCE - Equity put/call
      };
    }).filter(d => d.total !== null || d.equity !== null);
    
    if (data.length === 0) throw new Error("No valid CBOE data parsed");
    
    const latest = data[data.length - 1];
    const last30 = data.slice(-30);
    
    // Compute 10MA
    const calc10MA = (arr) => arr.map((_, i) => {
      if (i < 9) return null;
      let sum = 0; for (let j = i - 9; j <= i; j++) sum += arr[j];
      return sum / 10;
    });
    
    const totalH30 = last30.map(d => d.total).filter(v => v !== null);
    const equityH30 = last30.map(d => d.equity).filter(v => v !== null);
    const totalMA = calc10MA(totalH30);
    const equityMA = calc10MA(equityH30);
    
    // PCCE approximation: (total + equity) / 2 or just total since it includes equity+index
    // Actually PCC = Total, PCCE would need separate calc. Use total as PCC proxy.
    
    // Compute equity ROC(1)
    let equityROC = null;
    if (equityH30.length >= 2) {
      const prev = equityH30[equityH30.length - 2];
      const cur = equityH30[equityH30.length - 1];
      if (prev > 0) equityROC = parseFloat(((cur - prev) / prev * 100).toFixed(2));
    }
    
    // Compute equity 10MA value
    const validEquityMA = equityMA.filter(v => v !== null);
    const equity10MA = validEquityMA.length > 0 ? parseFloat(validEquityMA[validEquityMA.length - 1].toFixed(3)) : null;
    
    return {
      ok: true,
      date: latest.date,
      pcc: { cur: latest.total, h30: totalH30, ma10: totalMA },
      cpce: { cur: latest.equity, h30: equityH30, hMA: equityMA, ma10: equity10MA, roc1: equityROC },
    };
  } catch (e) {
    console.error("CBOE:", e.message);
    return { ok: false, error: e.message };
  }
}

// ── HELPERS ──
function calc10MA(arr) {
  if (!arr || arr.length < 10) return [];
  return arr.map((_, i) => {
    if (i < 9) return null;
    let sum = 0; for (let j = i - 9; j <= i; j++) sum += arr[j];
    return sum / 10;
  });
}

function computeZScore(values, lookback = 252) {
  if (!values || values.length < 20) return { zscore: 0, history: [] };
  const recent = values.slice(-lookback);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const std = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length) || 1;
  const zScores = recent.map(v => (v - mean) / std);
  return { zscore: zScores[zScores.length - 1], history: zScores.slice(-30) };
}

// ── MAIN ──
export async function GET() {
  const startTime = Date.now();

  const [vix, vix3m, vix9d, spx, hySpread, igSpread, cboe] = await Promise.all([
    fetchYahoo("^VIX"),
    fetchYahoo("^VIX3M"),
    fetchYahoo("^VIX9D"),
    fetchYahoo("^GSPC"),
    fetchFRED("BAMLH0A0HYM2"),
    fetchFRED("BAMLC0A4CBBB"),
    fetchCBOE(),
  ]);

  // VIX
  const vixCur = vix.ok ? vix.current : null;
  const vixH30 = vix.ok ? vix.history : [];
  const vixAll = vix.ok ? vix.allHistory : [];
  const vixMo6Hi = vixAll.length > 0 ? Math.max(...vixAll) : null;
  const vixMo6Lo = vixAll.length > 0 ? Math.min(...vixAll) : null;

  // VIX3M / VIX9D
  const vix3mCur = vix3m.ok ? vix3m.current : null;
  const vix9dCur = vix9d.ok ? vix9d.current : null;

  // VRatio
  const vratio = (vix3mCur && vixCur && vixCur > 0) ? vix3mCur / vixCur : null;
  const vratio9d = (vix9dCur && vixCur && vixCur > 0) ? vix9dCur / vixCur : null;
  const vix3mH = vix3m.ok ? vix3m.history : [];
  const vix9dH = vix9d.ok ? vix9d.history : [];
  const vratioH30 = [], vratio9dH30 = [];
  const minLen = Math.min(vixH30.length, vix3mH.length);
  for (let i = 0; i < minLen; i++) { if (vixH30[i] > 0) vratioH30.push(vix3mH[i] / vixH30[i]); }
  const minLen9d = Math.min(vixH30.length, vix9dH.length);
  for (let i = 0; i < minLen9d; i++) { if (vixH30[i] > 0) vratio9dH30.push(vix9dH[i] / vixH30[i]); }

  // Credit
  let creditZ = 0, creditHY = 0, creditIG = 0, creditH30 = [], creditHY_H = [], creditIG_H = [];
  if (hySpread.ok) {
    const hyValues = hySpread.observations.map(o => o.value);
    const hyZ = computeZScore(hyValues);
    creditHY = hyZ.zscore;
    creditHY_H = hyZ.history;
    if (igSpread.ok) {
      const igValues = igSpread.observations.map(o => o.value);
      const igZ = computeZScore(igValues);
      creditIG = igZ.zscore;
      creditIG_H = igZ.history;
      creditZ = (creditHY + creditIG) / 2;
      creditH30 = hyZ.history.map((v, i) => (v + (igZ.history[i] || 0)) / 2);
    } else {
      creditZ = creditHY;
      creditH30 = hyZ.history;
    }
  }

  // SPX
  const spxCur = spx.ok ? spx.current : null;
  const spxPrev = spx.ok ? spx.previousClose : null;
  const spxChg = (spxCur && spxPrev) ? spxCur - spxPrev : 0;
  const spxPct = (spxPrev && spxPrev !== 0) ? (spxChg / spxPrev) * 100 : 0;
  const spxAll = spx.ok ? spx.allHistory : [];
  const spxMonthly = [];
  const step = Math.max(1, Math.floor(spxAll.length / 20));
  for (let i = 0; i < spxAll.length; i += step) spxMonthly.push(spxAll[i]);
  if (spxAll.length > 0 && spxMonthly[spxMonthly.length - 1] !== spxAll[spxAll.length - 1]) spxMonthly.push(spxAll[spxAll.length - 1]);

  const now = new Date();
  const etTime = now.toLocaleString("en-US", { timeZone: "America/New_York", hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
  const etDate = now.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return Response.json({
    ts: etTime,
    dt: etDate,
    fetchTime: Date.now() - startTime,
    sources: {
      vix: vix.ok ? "LIVE" : `ERROR: ${vix.error}`,
      vix3m: vix3m.ok ? "LIVE" : `ERROR: ${vix3m.error}`,
      vix9d: vix9d.ok ? "LIVE" : `ERROR: ${vix9d.error}`,
      spx: spx.ok ? "LIVE" : `ERROR: ${spx.error}`,
      bpndx: "MANUAL",
      credit: (hySpread.ok || igSpread.ok) ? "LIVE" : `ERROR: ${hySpread.error}`,
      pcc: cboe.ok ? "LIVE (CBOE)" : `ERROR: ${cboe.error}`,
      cpce: cboe.ok ? "LIVE (CBOE)" : `ERROR: ${cboe.error}`,
      cboeDate: cboe.ok ? cboe.date : null,
    },
    vix: {
      cur: vixCur, prev: vix.ok ? vix.previousClose : null,
      hi: vix.ok ? vix.dayHigh : null, lo: vix.ok ? vix.dayLow : null,
      mo6hi: vixMo6Hi, mo6lo: vixMo6Lo, norm: [12, 18], h30: vixH30,
    },
    vix3m: { cur: vix3mCur },
    vix9d: { cur: vix9dCur },
    term: { vratio, vratio9d, h30: vratioH30, h30_9d: vratio9dH30 },
    credit: {
      z: parseFloat(creditZ.toFixed(2)), hy: parseFloat(creditHY.toFixed(2)),
      ig: parseFloat(creditIG.toFixed(2)), diff: parseFloat((creditHY - creditIG).toFixed(2)),
      h30: creditH30.map(v => parseFloat(v.toFixed(2))),
      hHY: creditHY_H.map(v => parseFloat(v.toFixed(2))),
      hIG: creditIG_H.map(v => parseFloat(v.toFixed(2))),
    },
    // PCC from CBOE total put/call
    pcc: {
      cur: cboe.ok ? cboe.pcc.cur : null,
      hi: 1.000, lo: 0.539,
      h30: cboe.ok ? cboe.pcc.h30 : [],
      ma10: cboe.ok ? cboe.pcc.ma10 : [],
    },
    // PCCE — not separately available from CBOE CSV, user enters manually if needed
    pcce: { cur: null, hi: 1.000, lo: 0.698, h30: [], ma10: [] },
    // CPCE from CBOE equity put/call
    cpce: {
      cur: cboe.ok ? cboe.cpce.cur : null,
      ma10: cboe.ok ? cboe.cpce.ma10 : null,
      roc1: cboe.ok ? cboe.cpce.roc1 : null,
      h30: cboe.ok ? cboe.cpce.h30 : [],
      hMA: cboe.ok ? cboe.cpce.hMA : [],
    },
    // BPNDX — no free API exists, manual entry only
    bp: { cur: null, prev: null, h30: [] },
    spx: {
      cur: spxCur, prev: spxPrev,
      chg: parseFloat(spxChg.toFixed(2)), pct: parseFloat(spxPct.toFixed(2)),
      hM: spxMonthly, warns: [],
    },
  });
}
