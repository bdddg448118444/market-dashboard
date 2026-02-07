// app/api/market/route.js
// Server-side API route — fetches live data from Yahoo Finance + FRED
// No CORS issues because this runs on the server

export const revalidate = 0; // no caching

// ── YAHOO FINANCE FETCHER ──
async function fetchYahoo(symbol, range = "6mo", interval = "1d") {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      next: { revalidate: 0 }
    });
    if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${symbol}`);
    
    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    // Filter out nulls and get last 30 valid values
    const validCloses = closes.filter(v => v !== null && v !== undefined);
    const last30 = validCloses.slice(-30);
    
    return {
      current: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose || meta.previousClose,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      history: last30,
      allHistory: validCloses,
      ok: true
    };
  } catch (e) {
    console.error(`Yahoo fetch failed for ${symbol}:`, e.message);
    return { ok: false, error: e.message };
  }
}

// ── FRED API FETCHER ──
async function fetchFRED(seriesId, limit = 60) {
  try {
    const key = process.env.FRED_API_KEY;
    if (!key || key === "your_fred_api_key_here") {
      return { ok: false, error: "FRED_API_KEY not configured" };
    }
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`);
    const json = await res.json();
    const obs = (json.observations || [])
      .filter(o => o.value !== ".")
      .map(o => ({ date: o.date, value: parseFloat(o.value) }))
      .reverse();
    return { ok: true, observations: obs, latest: obs[obs.length - 1]?.value };
  } catch (e) {
    console.error(`FRED fetch failed for ${seriesId}:`, e.message);
    return { ok: false, error: e.message };
  }
}

// ── COMPUTE 10-DAY MOVING AVERAGE ──
function calc10MA(arr) {
  if (!arr || arr.length < 10) return [];
  return arr.map((_, i) => {
    if (i < 9) return null;
    let sum = 0;
    for (let j = i - 9; j <= i; j++) sum += arr[j];
    return sum / 10;
  });
}

// ── COMPUTE Z-SCORE from raw spread data ──
function computeZScore(values, lookback = 252) {
  if (!values || values.length < 20) return { zscore: 0, history: [] };
  const recent = values.slice(-lookback);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const std = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length) || 1;
  const zScores = recent.map(v => (v - mean) / std);
  return {
    zscore: zScores[zScores.length - 1],
    history: zScores.slice(-30)
  };
}

// ── MAIN HANDLER ──
export async function GET() {
  const startTime = Date.now();
  
  // Fetch all data in parallel
  const [vix, vix3m, vix9d, spx, bpndx, hySpread, igSpread] = await Promise.all([
    fetchYahoo("^VIX"),
    fetchYahoo("^VIX3M"),
    fetchYahoo("^VIX9D"),
    fetchYahoo("^GSPC"),
    fetchYahoo("^BPNDX"),
    fetchFRED("BAMLH0A0HYM2"),  // ICE BofA US High Yield OAS
    fetchFRED("BAMLC0A4CBBB"),  // ICE BofA BBB Corporate OAS
  ]);

  // ── VIX processing ──
  const vixCur = vix.ok ? vix.current : null;
  const vixH30 = vix.ok ? vix.history : [];
  const vixAll = vix.ok ? vix.allHistory : [];
  // 6-month high/low from all history
  const vixMo6Hi = vixAll.length > 0 ? Math.max(...vixAll) : null;
  const vixMo6Lo = vixAll.length > 0 ? Math.min(...vixAll) : null;

  // ── VIX3M processing ──
  const vix3mCur = vix3m.ok ? vix3m.current : null;
  
  // ── VIX9D processing ──
  const vix9dCur = vix9d.ok ? vix9d.current : null;

  // ── VRatio calculations ──
  const vratio = (vix3mCur && vixCur) ? vix3mCur / vixCur : null;
  const vratio9d = (vix9dCur && vixCur) ? vix9dCur / vixCur : null;

  // Build VRatio histories from VIX and VIX3M histories
  const vix3mH = vix3m.ok ? vix3m.history : [];
  const vix9dH = vix9d.ok ? vix9d.history : [];
  const vratioH30 = [];
  const vratio9dH30 = [];
  const minLen = Math.min(vixH30.length, vix3mH.length);
  for (let i = 0; i < minLen; i++) {
    if (vixH30[i] > 0) {
      vratioH30.push(vix3mH[i] / vixH30[i]);
    }
  }
  const minLen9d = Math.min(vixH30.length, vix9dH.length);
  for (let i = 0; i < minLen9d; i++) {
    if (vixH30[i] > 0) {
      vratio9dH30.push(vix9dH[i] / vixH30[i]);
    }
  }

  // ── Credit Spread processing ──
  let creditZ = 0, creditHY = 0, creditIG = 0;
  let creditH30 = [], creditHY_H = [], creditIG_H = [];
  
  if (hySpread.ok && igSpread.ok) {
    const hyValues = hySpread.observations.map(o => o.value);
    const igValues = igSpread.observations.map(o => o.value);
    
    const hyZ = computeZScore(hyValues);
    const igZ = computeZScore(igValues);
    
    creditHY = hyZ.zscore;
    creditIG = igZ.zscore;
    creditZ = (creditHY + creditIG) / 2;
    creditH30 = hyZ.history.map((v, i) => (v + (igZ.history[i] || 0)) / 2);
    creditHY_H = hyZ.history;
    creditIG_H = igZ.history;
  } else if (hySpread.ok) {
    const hyValues = hySpread.observations.map(o => o.value);
    const hyZ = computeZScore(hyValues);
    creditHY = hyZ.zscore;
    creditZ = hyZ.zscore;
    creditH30 = hyZ.history;
    creditHY_H = hyZ.history;
  }

  // ── SPX processing ──
  const spxCur = spx.ok ? spx.current : null;
  const spxPrev = spx.ok ? spx.previousClose : null;
  const spxChg = (spxCur && spxPrev) ? spxCur - spxPrev : 0;
  const spxPct = (spxPrev && spxPrev !== 0) ? (spxChg / spxPrev) * 100 : 0;
  // Monthly-ish history for the S&P chart (use every ~21st data point)
  const spxAll = spx.ok ? spx.allHistory : [];
  const spxMonthly = [];
  const step = Math.max(1, Math.floor(spxAll.length / 20));
  for (let i = 0; i < spxAll.length; i += step) {
    spxMonthly.push(spxAll[i]);
  }
  if (spxMonthly[spxMonthly.length - 1] !== spxAll[spxAll.length - 1]) {
    spxMonthly.push(spxAll[spxAll.length - 1]);
  }

  // ── BPNDX processing ──
  const bpCur = bpndx.ok ? bpndx.current : null;
  const bpPrev = bpndx.ok ? bpndx.previousClose : null;
  const bpH30 = bpndx.ok ? bpndx.history : [];

  // ── Put/Call Ratios ──
  // CBOE doesn't have a clean free API. These need manual input via the Notes panel.
  // We provide placeholder structure; the dashboard's manual override system handles this.
  // If you want automated P/C data, you'd need a paid data provider or scraper.
  
  // Try fetching CBOE equity P/C from Yahoo (sometimes available as ^CPCE)
  const cpceYahoo = await fetchYahoo("^CPCE");
  const pccYahoo = await fetchYahoo("^PCC");
  const pcceYahoo = await fetchYahoo("^PCCE");

  const now = new Date();
  const etTime = now.toLocaleString("en-US", { timeZone: "America/New_York", hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
  const etDate = now.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const response = {
    ts: etTime,
    dt: etDate,
    fetchTime: Date.now() - startTime,
    sources: {
      vix: vix.ok ? "LIVE" : `ERROR: ${vix.error}`,
      vix3m: vix3m.ok ? "LIVE" : `ERROR: ${vix3m.error}`,
      vix9d: vix9d.ok ? "LIVE" : `ERROR: ${vix9d.error}`,
      spx: spx.ok ? "LIVE" : `ERROR: ${spx.error}`,
      bpndx: bpndx.ok ? "LIVE" : `ERROR: ${bpndx.error}`,
      credit: (hySpread.ok || igSpread.ok) ? "LIVE" : `ERROR: ${hySpread.error}`,
      pcc: pccYahoo.ok ? "LIVE" : "MANUAL",
      pcce: pcceYahoo.ok ? "LIVE" : "MANUAL",
      cpce: cpceYahoo.ok ? "LIVE" : "MANUAL",
    },
    vix: {
      cur: vixCur,
      prev: vix.ok ? vix.previousClose : null,
      hi: vix.ok ? vix.dayHigh : null,
      lo: vix.ok ? vix.dayLow : null,
      mo6hi: vixMo6Hi,
      mo6lo: vixMo6Lo,
      norm: [12, 18],
      h30: vixH30,
    },
    vix3m: { cur: vix3mCur },
    vix9d: { cur: vix9dCur },
    term: {
      vratio: vratio,
      vratio9d: vratio9d,
      h30: vratioH30,
      h30_9d: vratio9dH30,
    },
    credit: {
      z: parseFloat(creditZ.toFixed(2)),
      hy: parseFloat(creditHY.toFixed(2)),
      ig: parseFloat(creditIG.toFixed(2)),
      diff: parseFloat((creditHY - creditIG).toFixed(2)),
      h30: creditH30.map(v => parseFloat(v.toFixed(2))),
      hHY: creditHY_H.map(v => parseFloat(v.toFixed(2))),
      hIG: creditIG_H.map(v => parseFloat(v.toFixed(2))),
    },
    // Put/Call: live if available, otherwise null (user enters manually)
    pcc: {
      cur: pccYahoo.ok ? pccYahoo.current : null,
      hi: 1.000, lo: 0.539,
      h30: pccYahoo.ok ? pccYahoo.history : [],
      ma10: pccYahoo.ok ? calc10MA(pccYahoo.history) : [],
    },
    pcce: {
      cur: pcceYahoo.ok ? pcceYahoo.current : null,
      hi: 1.000, lo: 0.698,
      h30: pcceYahoo.ok ? pcceYahoo.history : [],
      ma10: pcceYahoo.ok ? calc10MA(pcceYahoo.history) : [],
    },
    cpce: {
      cur: cpceYahoo.ok ? cpceYahoo.current : null,
      ma10: null,
      roc1: null,
      h30: cpceYahoo.ok ? cpceYahoo.history : [],
      hMA: cpceYahoo.ok ? calc10MA(cpceYahoo.history) : [],
    },
    bp: {
      cur: bpCur,
      prev: bpPrev,
      h30: bpH30,
    },
    spx: {
      cur: spxCur,
      prev: spxPrev,
      chg: parseFloat(spxChg.toFixed(2)),
      pct: parseFloat(spxPct.toFixed(2)),
      hM: spxMonthly,
      warns: [],
    },
  };

  // Compute CPCE 10MA and ROC if we have data
  if (response.cpce.h30.length >= 10) {
    const ma = calc10MA(response.cpce.h30);
    const validMA = ma.filter(v => v !== null);
    response.cpce.ma10 = validMA.length > 0 ? parseFloat(validMA[validMA.length - 1].toFixed(3)) : null;
    response.cpce.hMA = ma;
  }
  if (response.cpce.h30.length >= 2) {
    const prev = response.cpce.h30[response.cpce.h30.length - 2];
    const cur = response.cpce.cur;
    if (prev && cur) {
      response.cpce.roc1 = parseFloat(((cur - prev) / prev * 100).toFixed(2));
    }
  }

  return Response.json(response);
}
