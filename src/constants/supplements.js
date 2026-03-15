const DEFAULT_SUPPLEMENTS = [
  { id:'carnitina',   name:'L-Carnitină 2g',        emoji:'🔥', time:'07:00', note:'Pe stomacul gol — oxidare grăsimi', days:[1,2,3,4,5,6,7] },
  { id:'vitc_dim',    name:'Vitamina C 500mg',       emoji:'🍊', time:'07:00', note:'Pe stomacul gol — antioxidant', days:[1,2,3,4,5,6,7] },
  { id:'niacina',     name:'Niacină B3',             emoji:'⚡', time:'07:30', note:'Înainte de masă — metabolism lipide', days:[1,2,3,4,5,6,7] },
  { id:'cholest_dim', name:'Cholest Bio Forte',      emoji:'💛', time:'08:00', note:'Cu micul dejun — colesterol', days:[1,2,3,4,5,6,7] },
  { id:'d3',          name:'Vitamina D3 + K2',       emoji:'☀️', time:'08:00', note:'Cu masă grasă — liposolubilă', days:[1,2,3,4,5,6,7] },
  { id:'coq10',       name:'CoQ10 200mg',            emoji:'❤️', time:'08:00', note:'Cu masă — energie celulară', days:[1,2,3,4,5,6,7] },
  { id:'omega3',      name:'Omega-3 2g',             emoji:'🐟', time:'08:00', note:'Cu masă — antiinflamator', days:[1,2,3,4,5,6,7] },
  { id:'zinc',        name:'Zinc 25mg',              emoji:'🦪', time:'08:00', note:'Cu masă — testosteron, imunitate', days:[1,2,3,4,5,6,7] },
  { id:'vite',        name:'Vitamina E 400UI',       emoji:'🌿', time:'08:00', note:'Cu masă grasă — antioxidant', days:[1,2,3,4,5,6,7] },
  { id:'centrum',     name:'Centrum Energy',         emoji:'💊', time:'08:00', note:'Cu micul dejun — complex B', days:[1,2,3,4,5,6,7] },
  { id:'ginger',      name:'Ginger Root 500mg',      emoji:'🫚', time:'08:00', note:'Cu masă — antiinflamator, digestie', days:[1,2,3,4,5,6,7] },
  { id:'citrul',      name:'Citrulină Malat 6g',     emoji:'🏋', time:'17:00', note:'30-45 min pre-workout', days:[1,3,5] },
  { id:'creatina',    name:'Creatină 5g',            emoji:'💪', time:'17:00', note:'Pre sau post workout', days:[1,3,5] },
  { id:'mg',          name:'Mg Bisglicinat 400mg',   emoji:'🌙', time:'21:00', note:'1h înainte somn — relaxare', days:[1,2,3,4,5,6,7] },
  { id:'cholest_sea', name:'Cholest Bio Forte (s)',  emoji:'💛', time:'21:00', note:'Cu cina — dozaj optim seara', days:[1,2,3,4,5,6,7] },
  { id:'vitc_sea',    name:'Vitamina C 500mg (s)',   emoji:'🍊', time:'21:00', note:'Seara — recuperare nocturnă', days:[1,2,3,4,5,6,7] },
];

// ─── WORKOUT DATA ─────────────────────────────────────────────────────────────

export { DEFAULT_SUPPLEMENTS };
