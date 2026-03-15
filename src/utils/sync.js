// ─── Cloud Sync via Supabase ──────────────────────────────────────────────────
// Uses Supabase as backend with localStorage as offline fallback.
// Setup: create free project at supabase.com, add env vars to Vercel.
//
// Required Supabase table (run in SQL editor):
// CREATE TABLE user_data (
//   user_id TEXT PRIMARY KEY,
//   data JSONB NOT NULL,
//   updated_at TIMESTAMPTZ DEFAULT NOW()
// );
// ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
// -- Allow all for now (add auth later)
// CREATE POLICY "allow_all" ON user_data FOR ALL USING (true);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Simple anonymous user ID (persisted in localStorage)
function getUserId() {
  let id = localStorage.getItem('ha_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('ha_user_id', id);
  }
  return id;
}

export function isCloudEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export async function pushToCloud(allData) {
  if (!isCloudEnabled()) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: getUserId(),
        data: allData,
        updated_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Cloud push failed:', e);
    return false;
  }
}

export async function pullFromCloud() {
  if (!isCloudEnabled()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_data?user_id=eq.${getUserId()}&select=data,updated_at`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    return rows[0].data;
  } catch (e) {
    console.warn('Cloud pull failed:', e);
    return null;
  }
}

export async function syncData(localData) {
  if (!isCloudEnabled()) return { synced: false, reason: 'not_configured' };

  // Pull cloud data first
  const cloud = await pullFromCloud();

  if (!cloud) {
    // Nothing in cloud yet — push local
    const ok = await pushToCloud(localData);
    return { synced: ok, direction: 'push' };
  }

  // Compare timestamps — use newer
  const cloudTs = new Date(cloud._syncedAt || 0);
  const localTs  = new Date(localData._syncedAt || 0);

  if (cloudTs > localTs) {
    // Cloud is newer — return cloud data to restore
    return { synced: true, direction: 'pull', data: cloud };
  } else {
    // Local is newer — push to cloud
    const withTs = { ...localData, _syncedAt: new Date().toISOString() };
    const ok = await pushToCloud(withTs);
    return { synced: ok, direction: 'push' };
  }
}

export function getUserId_public() {
  return getUserId();
}
