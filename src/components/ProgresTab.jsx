import { useState, useMemo } from 'react';
import { K, lsSave, todayKey } from '../utils/storage';
import { getDayMacros } from '../utils/calculations';

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function LineChart({ entries, valueKey, color, label, unit = '', target = null, height = 120 }) {
  const W = 320, H = height, PAD = { t: 12, r: 12, b: 28, l: 38 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  const vals = entries.map(([, v]) => typeof v === 'number' ? v : (v[valueKey] || 0));
  if (vals.length < 2) return (
    <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(150,150,150,0.5)', fontSize: '13px' }}>
      Înregistrează zilnic pentru a vedea graficul
    </div>
  );

  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const range = mx - mn || 1;
  const pad = range * 0.12;
  const yMin = mn - pad;
  const yMax = mx + pad;

  const toX = (i) => PAD.l + (i / (vals.length - 1)) * cW;
  const toY = (v) => PAD.t + cH - ((v - yMin) / (yMax - yMin)) * cH;

  const pts = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  // Area fill points
  const areaFirst = `${toX(0)},${PAD.t + cH}`;
  const areaLast  = `${toX(vals.length - 1)},${PAD.t + cH}`;
  const areaPts   = `${areaFirst} ${pts} ${areaLast}`;

  // Y axis labels (3 ticks)
  const yTicks = [yMin + (yMax - yMin) * 0.1, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.9];

  // Trend line (simple linear regression)
  const n = vals.length;
  const sumX = vals.reduce((a, _, i) => a + i, 0);
  const sumY = vals.reduce((a, v) => a + v, 0);
  const sumXY = vals.reduce((a, v, i) => a + i * v, 0);
  const sumX2 = vals.reduce((a, _, i) => a + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const trendStart = `${toX(0)},${toY(intercept)}`;
  const trendEnd   = `${toX(n - 1)},${toY(slope * (n - 1) + intercept)}`;

  const isDown = slope < 0;
  const trendColor = valueKey === 'weight' || (!valueKey && label === 'Greutate')
    ? (isDown ? '#10b981' : '#ef4444')   // greutate: scade = bine
    : (isDown ? '#ef4444' : '#10b981');  // calorii/proteine: creste = bine

  const lastVal = vals[vals.length - 1];
  const firstVal = vals[0];
  const diff = Math.round((lastVal - firstVal) * 10) / 10;

  const formatVal = (v) => {
    if (unit === 'kg') return v.toFixed(1);
    return Math.round(v).toString();
  };

  // X axis labels (show first, middle, last)
  const xLabels = [0, Math.floor((entries.length - 1) / 2), entries.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(150,150,150,0.7)', fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {diff !== 0 && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: trendColor, background: `${trendColor}15`, padding: '2px 7px', borderRadius: '6px' }}>
              {diff > 0 ? '+' : ''}{diff}{unit}
            </span>
          )}
          <span style={{ fontSize: '15px', fontWeight: 800, color }}>{formatVal(lastVal)}{unit}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: `${height}px` }}>
        <defs>
          <linearGradient id={`grad_${valueKey || label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line key={i} x1={PAD.l} y1={toY(v)} x2={W - PAD.r} y2={toY(v)}
            stroke="rgba(128,128,128,0.1)" strokeWidth="1" strokeDasharray="3,4"/>
        ))}

        {/* Target line */}
        {target && target >= yMin && target <= yMax && (
          <line x1={PAD.l} y1={toY(target)} x2={W - PAD.r} y2={toY(target)}
            stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.6"/>
        )}

        {/* Area fill */}
        <polygon points={areaPts} fill={`url(#grad_${valueKey || label})`}/>

        {/* Trend line */}
        {n >= 4 && (
          <line x1={trendStart.split(',')[0]} y1={trendStart.split(',')[1]}
            x2={trendEnd.split(',')[0]} y2={trendEnd.split(',')[1]}
            stroke={trendColor} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5"/>
        )}

        {/* Main line */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"/>

        {/* Dots — only last 7 if many entries */}
        {vals.slice(Math.max(0, vals.length - 7)).map((v, ii) => {
          const i = Math.max(0, vals.length - 7) + ii;
          const isLast = i === vals.length - 1;
          return (
            <circle key={i} cx={toX(i)} cy={toY(v)} r={isLast ? 5 : 3}
              fill={isLast ? color : 'transparent'} stroke={color} strokeWidth={isLast ? 0 : 2}/>
          );
        })}

        {/* Y axis labels */}
        {yTicks.map((v, i) => (
          <text key={i} x={PAD.l - 4} y={toY(v) + 4} textAnchor="end"
            fill="rgba(128,128,128,0.55)" fontSize="10" fontFamily="Inter,sans-serif">
            {formatVal(v)}
          </text>
        ))}

        {/* X axis labels */}
        {xLabels.map(i => (
          <text key={i} x={toX(i)} y={H - 6} textAnchor="middle"
            fill="rgba(128,128,128,0.5)" fontSize="10" fontFamily="Inter,sans-serif">
            {entries[i]?.[0]?.slice(5)}
          </text>
        ))}

        {/* Last value label */}
        <text x={toX(vals.length - 1)} y={toY(lastVal) - 8} textAnchor="middle"
          fill={color} fontSize="11" fontWeight="700" fontFamily="Inter,sans-serif">
          {formatVal(lastVal)}{unit}
        </text>
      </svg>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ entries, valueKey, color, label, unit = '', target = null }) {
  const W = 320, H = 90, PAD = { t: 8, r: 8, b: 22, l: 34 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const n = entries.length;
  if (n === 0) return null;

  const vals = entries.map(([, v]) => v[valueKey] || 0);
  const mx = Math.max(...vals, target || 0) * 1.1 || 1;
  const barW = Math.max(4, (cW / n) - 3);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(150,150,150,0.7)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color }}>
          ⌀ {Math.round(vals.reduce((a, v) => a + v, 0) / n)}{unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: `${H}px` }}>
        {/* Target line */}
        {target && (
          <line x1={PAD.l} y1={PAD.t + cH - (target / mx) * cH} x2={W - PAD.r} y2={PAD.t + cH - (target / mx) * cH}
            stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6"/>
        )}
        {vals.map((v, i) => {
          const x = PAD.l + (i / n) * cW + 2;
          const bH = Math.max(2, (v / mx) * cH);
          const y = PAD.t + cH - bH;
          const isToday = i === n - 1;
          const pct = target ? v / target : 1;
          const barColor = pct >= 1 ? color : pct >= 0.8 ? color + 'cc' : color + '66';
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bH} rx="3"
                fill={isToday ? color : barColor}/>
              {isToday && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle"
                  fill={color} fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif">
                  {Math.round(v)}
                </text>
              )}
            </g>
          );
        })}
        {/* X labels — every 3rd */}
        {entries.map(([date], i) => {
          if (n > 7 && i % 3 !== 0 && i !== n - 1) return null;
          const x = PAD.l + (i / n) * cW + barW / 2 + 2;
          return (
            <text key={i} x={x} y={H - 5} textAnchor="middle"
              fill="rgba(128,128,128,0.5)" fontSize="9" fontFamily="Inter,sans-serif">
              {date.slice(8)}
            </text>
          );
        })}
        {/* Y label */}
        <text x={PAD.l - 4} y={PAD.t + cH / 2} textAnchor="end" dominantBaseline="middle"
          fill="rgba(128,128,128,0.5)" fontSize="10" fontFamily="Inter,sans-serif">
          {Math.round(mx * 0.9)}
        </text>
      </svg>
    </div>
  );
}

// ─── Sport Heatmap (last 30 days) ─────────────────────────────────────────────
function SportHeatmap({ workouts, th }) {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const day = workouts.days?.[key] || {};
    const hasEx = (day.exercises?.length || 0) > 0;
    const hasCardio = (day.cardio?.length || 0) > 0;
    const hasWork = (day.work?.length || 0) > 0;
    const intensity = hasEx ? 3 : hasCardio ? 2 : hasWork ? 1 : 0;
    days.push({ key, date: d.getDate(), intensity, hasEx, hasCardio });
  }

  const colors = ['transparent', 'rgba(249,115,22,0.2)', 'rgba(249,115,22,0.5)', 'rgba(249,115,22,0.9)'];
  const labels = ['', '🔧 Muncă', '🏃 Cardio', '🏋 Sală'];

  return (
    <div>
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {days.map(d => (
          <div key={d.key} title={`${d.key}: ${labels[d.intensity]||'—'}`}
            style={{ width: '28px', height: '28px', borderRadius: '6px', background: d.intensity ? colors[d.intensity] : th.card2, border: `1px solid ${d.intensity ? 'rgba(249,115,22,0.3)' : th.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: d.intensity >= 2 ? '#f97316' : th.text3, fontWeight: 700, transition: 'all 0.15s', cursor: 'default' }}>
            {d.date}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: th.text3 }}>
        {['🔧 Muncă','🏃 Cardio','🏋 Sală'].map((l,i) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors[i+1] }}/>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function ProgresTab({ th, stats, setStats, workouts, profile }) {
  const [activeChart, setActiveChart] = useState('greutate');
  const [newWeight, setNewWeight] = useState('');
  const key = todayKey();

  // Derived data
  const weightEntries = useMemo(() =>
    Object.entries(stats.weight || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-30),
    [stats.weight]
  );
  const calEntries14 = useMemo(() =>
    Object.entries(stats.daily || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-14),
    [stats.daily]
  );
  const calEntries30 = useMemo(() =>
    Object.entries(stats.daily || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-30),
    [stats.daily]
  );

  const currentWeight = stats.weight?.[key] || stats.weight?.[Object.keys(stats.weight||{}).sort().pop()] || null;
  const startWeight   = parseFloat(profile?.weight) || null;
  const targetWeight  = parseFloat(profile?.targetWeight) || null;
  const lostKg = startWeight && currentWeight ? Math.round((startWeight - currentWeight) * 10) / 10 : null;
  const toTarget = targetWeight && currentWeight ? Math.round((currentWeight - targetWeight) * 10) / 10 : null;

  // Sport stats
  const sportStats = useMemo(() => {
    const days = Object.values(workouts.days || {});
    const totalEx = days.reduce((a, d) => a + (d.exercises?.length || 0), 0);
    const totalCardio = days.reduce((a, d) => a + (d.cardio||[]).reduce((b,c) => b+c.duration, 0), 0);
    const totalKcalBurned = days.reduce((a, d) => a + (d.cardio||[]).reduce((b,c) => b+c.kcal, 0) + (d.work||[]).reduce((b,w) => b+w.kcal, 0), 0);
    const activeDays = days.filter(d => (d.exercises?.length||0) + (d.cardio?.length||0) + (d.work?.length||0) > 0).length;
    return { totalEx, totalCardio, totalKcalBurned, activeDays };
  }, [workouts]);

  const saveWeight = () => {
    if (!newWeight || parseFloat(newWeight) <= 0) return;
    const val = parseFloat(newWeight);
    setStats(prev => {
      const ns = { ...prev, weight: { ...(prev.weight||{}), [key]: val } };
      lsSave(K.stats, ns);
      return ns;
    });
    setNewWeight('');
  };

  const chartTabs = [
    { id: 'greutate', label: '⚖️', full: 'Greutate' },
    { id: 'calorii',  label: '🔥', full: 'Calorii'  },
    { id: 'macro',    label: '💪', full: 'Macro'    },
    { id: 'sport',    label: '🏋', full: 'Sport'    },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
      <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '14px' }}>📊 Progres</div>

      {/* ── WEIGHT INPUT ── */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', marginBottom: '12px', border: `1px solid ${th.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '10px' }}>⚖️ Greutate azi</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: currentWeight ? '10px' : '0' }}>
          <input type="number" step="0.1" value={newWeight}
            onChange={e => setNewWeight(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveWeight()}
            placeholder={currentWeight ? `Azi: ${currentWeight} kg` : 'ex: 95.4'}
            style={{ flex: 1, background: th.card2, border: `1.5px solid ${newWeight?'#f97316':th.border}`, borderRadius: '10px', padding: '11px 14px', color: th.text, fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}/>
          <button onClick={saveWeight}
            style={{ padding: '11px 16px', background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 10px rgba(249,115,22,0.3)' }}>
            ✓
          </button>
        </div>

        {/* Progress cards */}
        {(lostKg !== null || toTarget !== null) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {currentWeight && (
              <div style={{ background: th.card, borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: th.text }}>{currentWeight}</div>
                <div style={{ fontSize: '10px', color: th.text3 }}>kg acum</div>
              </div>
            )}
            {lostKg !== null && (
              <div style={{ background: lostKg > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: lostKg > 0 ? '#10b981' : '#ef4444' }}>{lostKg > 0 ? '-' : '+'}{Math.abs(lostKg)}</div>
                <div style={{ fontSize: '10px', color: th.text3 }}>kg față de start</div>
              </div>
            )}
            {toTarget !== null && (
              <div style={{ background: 'rgba(139,92,246,0.1)', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#8b5cf6' }}>{Math.abs(toTarget)}</div>
                <div style={{ fontSize: '10px', color: th.text3 }}>kg până la {targetWeight}kg</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CHART TABS ── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {chartTabs.map(c => (
          <button key={c.id} onClick={() => setActiveChart(c.id)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: '10px', border: `1.5px solid ${activeChart===c.id?'#f97316':th.border}`, background: activeChart===c.id?'rgba(249,115,22,0.1)':'transparent', color: activeChart===c.id?'#f97316':th.text2, fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '16px' }}>{c.label}</span>
            <span>{c.full}</span>
          </button>
        ))}
      </div>

      {/* ── CHARTS ── */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', marginBottom: '12px', border: `1px solid ${th.border}` }}>

        {/* GREUTATE */}
        {activeChart === 'greutate' && (
          <LineChart
            entries={weightEntries.map(([k, v]) => [k, v])}
            valueKey={null}
            color="#f97316"
            label="Greutate (ultimele 30 zile)"
            unit="kg"
            target={targetWeight}
            height={130}
          />
        )}

        {/* CALORII */}
        {activeChart === 'calorii' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <BarChart
              entries={calEntries14}
              valueKey="calories"
              color="#ef4444"
              label="Calorii zilnice (14 zile)"
              unit=" kcal"
              target={getDayMacros(profile,'antrenament')?.kcal || null}
            />
            <LineChart
              entries={calEntries30.map(([k, v]) => [k, v.calories || 0])}
              valueKey={null}
              color="#ef4444"
              label="Trend calorii (30 zile)"
              unit=" kcal"
              height={100}
            />
          </div>
        )}

        {/* MACRO */}
        {activeChart === 'macro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <BarChart entries={calEntries14} valueKey="protein" color="#10b981" label="Proteine (g)" unit="g"/>
            <BarChart entries={calEntries14} valueKey="carbs"   color="#3b82f6" label="Carbohidrați (g)" unit="g"/>
            <BarChart entries={calEntries14} valueKey="fat"     color="#f59e0b" label="Grăsimi (g)" unit="g"/>
          </div>
        )}

        {/* SPORT */}
        {activeChart === 'sport' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Zile active', val: sportStats.activeDays, icon: '📅', color: '#f97316' },
                { label: 'Exerciții total', val: sportStats.totalEx, icon: '🏋', color: '#ef4444' },
                { label: 'Min cardio', val: sportStats.totalCardio, icon: '🏃', color: '#10b981' },
                { label: 'Kcal arse', val: sportStats.totalKcalBurned, icon: '🔥', color: '#f59e0b' },
              ].map(x => (
                <div key={x.label} style={{ background: `${x.color}10`, border: `1px solid ${x.color}25`, borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', marginBottom: '3px' }}>{x.icon}</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: x.color, fontFamily: "'Barlow Condensed',sans-serif" }}>{x.val.toLocaleString('ro-RO')}</div>
                  <div style={{ fontSize: '10px', color: th.text3 }}>{x.label}</div>
                </div>
              ))}
            </div>
            {/* Heatmap */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: th.text2, marginBottom: '8px' }}>Calendar activitate (30 zile)</div>
              <SportHeatmap workouts={workouts} th={th}/>
            </div>
            {/* Recent sessions */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: th.text2, marginBottom: '8px' }}>Sesiuni recente</div>
              {Object.entries(workouts.days || {})
                .sort((a,b) => b[0].localeCompare(a[0])).slice(0,5)
                .map(([date, day]) => {
                  const exCount = day.exercises?.length || 0;
                  const cardioKcal = (day.cardio||[]).reduce((a,c) => a+c.kcal, 0);
                  const cardioMin  = (day.cardio||[]).reduce((a,c) => a+c.duration, 0);
                  const workKcal   = (day.work||[]).reduce((a,w) => a+w.kcal, 0);
                  if (!exCount && !cardioKcal && !workKcal) return null;
                  const volume = day.exercises?.reduce((a,e) => a + (e.volume||0), 0) || 0;
                  return (
                    <div key={date} style={{ padding: '10px 12px', background: th.card, borderRadius: '10px', marginBottom: '6px', border: `1px solid ${th.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: th.text }}>{date.slice(5).replace('-', '/')}</span>
                        {volume > 0 && <span style={{ fontSize: '11px', color: '#f97316', fontWeight: 700 }}>{volume.toLocaleString('ro-RO')}kg vol.</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {exCount > 0 && <span style={{ fontSize: '11px', background: 'rgba(249,115,22,0.1)', color: '#f97316', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>🏋 {exCount} exerciții</span>}
                        {cardioKcal > 0 && <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>🏃 {cardioMin}min · {cardioKcal}kcal</span>}
                        {workKcal > 0 && <span style={{ fontSize: '11px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>🔧 {workKcal}kcal</span>}
                      </div>
                      {day.exercises?.slice(0,3).map((ex, i) => (
                        <div key={i} style={{ fontSize: '11px', color: th.text3, marginTop: '4px' }}>
                          {ex.name} — {ex.sets?.map(s => `${s.kg}kg×${s.reps}`).join(', ')}
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      <div style={{ height: '20px' }}/>
    </div>
  );
}

export default ProgresTab;
