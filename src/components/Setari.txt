import { useState, useEffect, useCallback } from 'react';
import { callAI } from '../utils/api';
import { getDayMacros } from '../utils/calculations';
import {
  requestNotificationPermission,
  scheduleSupplementNotifications,
  cancelAllNotifications,
  getNotificationStatus,
  registerServiceWorker,
} from '../utils/notifications';
import { isCloudEnabled, syncData, getUserId_public } from '../utils/sync';
import { K, ls, lsSave, todayKey } from '../utils/storage';

// ─── Ce mănânc acum ───────────────────────────────────────────────────────────
export function SuggestieAI({ th, profile, todayStats, dayMacros, todayMeals, dayType, currentDay }) {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const getTimeContext = () => {
    const h = new Date().getHours();
    if (h < 8)  return { meal: 'mic dejun', emoji: '🌅' };
    if (h < 11) return { meal: 'gustare dimineață', emoji: '🍎' };
    if (h < 14) return { meal: 'prânz', emoji: '☀️' };
    if (h < 17) return { meal: 'gustare după-amiază', emoji: '🌤' };
    if (h < 20) return { meal: 'cină', emoji: '🌙' };
    return { meal: 'gustare seară', emoji: '🌃' };
  };

  const getSuggestion = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    const ctx = getTimeContext();
    const remaining = {
      kcal:    Math.max(0, (dayMacros?.kcal    || 0) - (todayStats?.calories || 0)),
      protein: Math.max(0, (dayMacros?.protein || 0) - (todayStats?.protein  || 0)),
      carbs:   Math.max(0, (dayMacros?.carbs   || 0) - (todayStats?.carbs    || 0)),
      fat:     Math.max(0, (dayMacros?.fat     || 0) - (todayStats?.fat      || 0)),
    };
    const mealsSoFar = todayMeals?.slice(-3).map(m => m.name).join(', ') || 'nimic';
    try {
      const reply = await callAI(
        [{ role: 'user', content:
          `Ora: ${new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} — ${ctx.meal}
Profil: ${profile?.name || 'Utilizator'}, ${profile?.weight}kg, obiectiv: ${profile?.goal}
Zi: ${dayType}
Deja mâncat azi: ${mealsSoFar}
Macro rămase: ${remaining.kcal}kcal · P:${Math.round(remaining.protein)}g · C:${Math.round(remaining.carbs)}g · G:${Math.round(remaining.fat)}g

Sugerează CONCIS ce să mănânce ACUM pentru ${ctx.meal}. Max 3 opțiuni, fiecare pe o linie:
- Emoji + Nume masă: macro estimat
Fii specific și realist pentru România.` }],
        `Nutriționist concis. Răspunde scurt, max 4 rânduri total. Română.`,
        400
      );
      setSuggestion({ text: reply, ctx, remaining, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) });
      setLastFetch(Date.now());
    } catch { setSuggestion(null); }
    finally { setLoading(false); }
  }, [loading, profile, dayMacros, todayStats, todayMeals, dayType]);

  // Auto-refresh every 2 hours
  useEffect(() => {
    if (!lastFetch || Date.now() - lastFetch > 2 * 60 * 60 * 1000) {
      getSuggestion();
    }
  }, []);

  const ctx = getTimeContext();
  const remaining = {
    kcal: Math.max(0, (dayMacros?.kcal || 0) - (todayStats?.calories || 0)),
    protein: Math.max(0, (dayMacros?.protein || 0) - (todayStats?.protein || 0)),
  };

  return (
    <div style={{ background: th.bg2, borderRadius: '16px', padding: '14px', border: `1px solid ${th.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '18px' }}>{ctx.emoji}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: th.text }}>Ce mănânc acum?</div>
            <div style={{ fontSize: '10px', color: th.text3 }}>{ctx.meal} · {remaining.kcal}kcal · P:{Math.round(remaining.protein)}g rămase</div>
          </div>
        </div>
        <button onClick={getSuggestion} disabled={loading}
          style={{ padding: '6px 12px', background: loading ? th.card2 : `${th.accent}15`, border: `1px solid ${th.accent}30`, borderRadius: '9px', color: loading ? th.text3 : th.accent, fontSize: '11px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? '⟳' : '🤖 Sugerează'}
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', gap: '5px', padding: '4px 0' }}>
          {[0,1,2].map(i => <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: th.accent, animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }}/>)}
        </div>
      )}

      {suggestion && !loading && (
        <div style={{ background: `${th.accent}08`, borderRadius: '10px', padding: '10px 12px', border: `1px solid ${th.accent}20` }}>
          <div style={{ fontSize: '10px', color: th.accent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '5px' }}>
            🤖 SUGESTIE · {suggestion.time}
          </div>
          {suggestion.text.split('\n').filter(l => l.trim() && !l.startsWith('{')).map((line, i) => (
            <div key={i} style={{ fontSize: '13px', color: th.text2, lineHeight: 1.5, marginBottom: '2px' }}>{line}</div>
          ))}
        </div>
      )}

      {!suggestion && !loading && (
        <div style={{ fontSize: '12px', color: th.text3, textAlign: 'center', padding: '6px 0' }}>
          Apasă pentru a primi o sugestie personalizată
        </div>
      )}
    </div>
  );
}

// ─── Setări notificări + sync ─────────────────────────────────────────────────
export function SetariTab({ th, supplements, profile, stats, meals, workouts, customFoods }) {
  const [notifStatus, setNotifStatus]   = useState(() => getNotificationStatus());
  const [notifEnabled, setNotifEnabled] = useState(() => ls('ha_notif_enabled', false));
  const [syncStatus, setSyncStatus]     = useState('idle'); // idle|syncing|ok|error
  const [syncMsg, setSyncMsg]           = useState('');
  const [swReady, setSwReady]           = useState(false);
  const cloudEnabled = isCloudEnabled();
  const userId = getUserId_public();

  useEffect(() => {
    registerServiceWorker().then(reg => setSwReady(!!reg));
  }, []);

  const enableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifStatus(perm);
    if (perm === 'granted') {
      setNotifEnabled(true);
      lsSave('ha_notif_enabled', true);
      if (swReady) {
        const todayDow = new Date().getDay() || 7;
        const todaySupl = supplements.filter(s => s.days?.includes(todayDow));
        scheduleSupplementNotifications(supplements);
        // Show confirmation
        new Notification('✓ Health Agent', {
          body: `${todaySupl.length} suplimente programate pentru azi`,
          icon: '/icon.png',
        });
      }
    }
  };

  const disableNotifications = () => {
    cancelAllNotifications();
    setNotifEnabled(false);
    lsSave('ha_notif_enabled', false);
  };

  const doSync = async () => {
    setSyncStatus('syncing');
    setSyncMsg('Sincronizare...');
    const allData = {
      profile: ls(K.profile, {}),
      stats:   ls(K.stats, {}),
      meals:   ls(K.meals, {}),
      workouts: ls(K.workouts, {}),
      customFoods: ls(K.customFoods, []),
      supplements: ls('ha_supl_list_v1', []),
      _syncedAt: new Date().toISOString(),
    };
    const result = await syncData(allData);
    if (result.synced && result.direction === 'pull' && result.data) {
      // Restore cloud data
      const d = result.data;
      if (d.profile)      lsSave(K.profile, d.profile);
      if (d.stats)        lsSave(K.stats, d.stats);
      if (d.meals)        lsSave(K.meals, d.meals);
      if (d.workouts)     lsSave(K.workouts, d.workouts);
      if (d.customFoods)  lsSave(K.customFoods, d.customFoods);
      if (d.supplements)  lsSave('ha_supl_list_v1', d.supplements);
      setSyncStatus('ok');
      setSyncMsg('✓ Date restaurate din cloud. Reîncarcă pagina.');
    } else if (result.synced) {
      setSyncStatus('ok');
      setSyncMsg('✓ Date salvate în cloud');
    } else {
      setSyncStatus('error');
      setSyncMsg(result.reason === 'not_configured' ? 'Cloud nesincronizat — configurează Supabase' : '✗ Eroare sync');
    }
    setTimeout(() => setSyncStatus('idle'), 4000);
  };

  const notifColor = notifStatus === 'granted' ? '#10b981' : notifStatus === 'denied' ? '#ef4444' : '#f59e0b';
  const notifLabel = { granted: 'Permis', denied: 'Blocat', default: 'Nesetat', unsupported: 'Nesuportat' }[notifStatus] || notifStatus;

  // Preview upcoming supplement notifications today
  const todayDow = new Date().getDay() || 7;
  const now = new Date();
  const upcomingSupl = supplements
    .filter(s => s.days?.includes(todayDow))
    .filter(s => {
      const [h, m] = (s.time || '').split(':').map(Number);
      const t = new Date(); t.setHours(h, m, 0, 0);
      return t > now;
    })
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 5);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
      <div style={{ fontSize: '18px', fontWeight: 800, color: th.text, marginBottom: '14px' }}>⚙️ Setări</div>

      {/* ── NOTIFICĂRI SUPLIMENTE ── */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}`, marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: th.text, marginBottom: '2px' }}>🔔 Notificări suplimente</div>
            <div style={{ fontSize: '11px', color: th.text3 }}>Reminder automat la orele programate</div>
          </div>
          <div style={{ display: 'flex', flex: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: notifColor, background: `${notifColor}15`, padding: '2px 7px', borderRadius: '6px' }}>{notifLabel}</span>
          </div>
        </div>

        {notifStatus === 'denied' && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', fontSize: '12px', color: '#ef4444' }}>
            Notificările sunt blocate în browser. Activează-le din Setări → Site settings → Notifications.
          </div>
        )}

        {notifEnabled && notifStatus === 'granted' && upcomingSupl.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: th.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px' }}>URMĂTOARELE AZI</div>
            {upcomingSupl.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
                <span style={{ fontSize: '14px' }}>{s.emoji}</span>
                <span style={{ fontSize: '12px', color: th.text2, flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>{s.time}</span>
              </div>
            ))}
          </div>
        )}

        {!notifEnabled || notifStatus !== 'granted' ? (
          <button onClick={enableNotifications}
            style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(16,185,129,0.3)' }}>
            🔔 Activează notificările
          </button>
        ) : (
          <button onClick={disableNotifications}
            style={{ width: '100%', padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#ef4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            🔕 Dezactivează notificările
          </button>
        )}
      </div>

      {/* ── CLOUD SYNC ── */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}`, marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: th.text, marginBottom: '2px' }}>☁️ Sincronizare cloud</div>
            <div style={{ fontSize: '11px', color: th.text3 }}>Datele tale salvate în cloud, accesibile de pe orice dispozitiv</div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: cloudEnabled ? '#10b981' : '#f59e0b', background: cloudEnabled ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', padding: '2px 7px', borderRadius: '6px' }}>
            {cloudEnabled ? 'Activ' : 'Neconfigurat'}
          </span>
        </div>

        {!cloudEnabled && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: th.text2, lineHeight: 1.7 }}>
            <strong style={{ color: '#f59e0b' }}>Setup Supabase (gratuit):</strong><br/>
            1. Creează cont la <strong>supabase.com</strong><br/>
            2. Nou proiect → SQL Editor → rulează:<br/>
            <code style={{ fontSize: '10px', background: th.card2, padding: '4px 8px', borderRadius: '6px', display: 'block', marginTop: '6px', lineHeight: 1.8 }}>
              CREATE TABLE user_data (<br/>
              &nbsp; user_id TEXT PRIMARY KEY,<br/>
              &nbsp; data JSONB NOT NULL,<br/>
              &nbsp; updated_at TIMESTAMPTZ DEFAULT NOW()<br/>
              );<br/>
              ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;<br/>
              CREATE POLICY "allow_all" ON user_data FOR ALL USING (true);
            </code>
            <br/>
            3. Settings → API → copiază URL + anon key<br/>
            4. Vercel Dashboard → proiect → Environment Variables:<br/>
            <code style={{ fontSize: '10px', background: th.card2, padding: '4px 8px', borderRadius: '6px', display: 'block', marginTop: '4px' }}>
              VITE_SUPABASE_URL = https://xxx.supabase.co<br/>
              VITE_SUPABASE_ANON_KEY = eyJ...
            </code>
            5. Redeploy
          </div>
        )}

        {cloudEnabled && (
          <div style={{ fontSize: '11px', color: th.text3, marginBottom: '10px' }}>
            ID dispozitiv: <code style={{ background: th.card2, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{userId.slice(0, 16)}...</code>
          </div>
        )}

        <button onClick={doSync} disabled={syncStatus === 'syncing'}
          style={{ width: '100%', padding: '13px', background: syncStatus === 'ok' ? 'linear-gradient(135deg,#10b981,#059669)' : syncStatus === 'error' ? 'rgba(239,68,68,0.1)' : `linear-gradient(135deg,#3b82f6,#6366f1)`, border: syncStatus === 'error' ? '1px solid rgba(239,68,68,0.3)' : 'none', borderRadius: '12px', color: syncStatus === 'error' ? '#ef4444' : '#fff', fontSize: '14px', fontWeight: 800, cursor: syncStatus === 'syncing' ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: syncStatus === 'syncing' ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: syncStatus === 'ok' || syncStatus === 'error' ? 'none' : '0 3px 12px rgba(59,130,246,0.3)' }}>
          {syncStatus === 'syncing' && <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>}
          {syncStatus === 'idle'    && '☁️ Sincronizează acum'}
          {syncStatus === 'syncing' && 'Sincronizare...'}
          {syncStatus === 'ok'     && syncMsg}
          {syncStatus === 'error'  && syncMsg}
        </button>
      </div>

      {/* ── INFO ── */}
      <div style={{ background: th.bg2, borderRadius: '16px', padding: '16px', border: `1px solid ${th.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: th.text, marginBottom: '10px' }}>ℹ️ Aplicație</div>
        {[
          { label: 'Versiune', val: '2.0' },
          { label: 'Date locale', val: 'localStorage' },
          { label: 'AI Model', val: 'Claude Sonnet 4' },
          { label: 'Offline', val: '✓ Funcționează' },
        ].map(x => (
          <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${th.border}` }}>
            <span style={{ fontSize: '12px', color: th.text2 }}>{x.label}</span>
            <span style={{ fontSize: '12px', color: th.text3, fontWeight: 600 }}>{x.val}</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ height: '20px' }}/>
    </div>
  );
}
