const MUSCLE_GROUPS = [
  { id:'piept',    label:'Piept',    icon:'💪', color:'#ef4444' },
  { id:'spate',    label:'Spate',    icon:'🏋', color:'#3b82f6' },
  { id:'umeri',    label:'Umeri',    icon:'🏅', color:'#8b5cf6' },
  { id:'brate',    label:'Brațe',    icon:'💪', color:'#f59e0b' },
  { id:'picioare', label:'Picioare', icon:'🦵', color:'#10b981' },
  { id:'core',     label:'Core',     icon:'🎯', color:'#f97316' },
];

const EXERCISES = {
  piept:    [{id:'bench',name:'Bench Press (halteră)'},{id:'dbpress',name:'Bench Press (gantere)'},{id:'incline',name:'Incline Press'},{id:'flyes',name:'Flyes'},{id:'cable_fly',name:'Cable Crossover'},{id:'dips',name:'Dips (piept)'}],
  spate:    [{id:'deadlift',name:'Deadlift'},{id:'rows',name:'Bent-over Rows'},{id:'pulldown',name:'Lat Pulldown'},{id:'pullup',name:'Pull-up'},{id:'seated_row',name:'Seated Cable Row'},{id:'facepull',name:'Face Pull'}],
  umeri:    [{id:'ohpress',name:'Overhead Press'},{id:'arnold',name:'Arnold Press'},{id:'laterals',name:'Lateral Raises'},{id:'frontrise',name:'Front Raises'},{id:'shrugs',name:'Shrugs'}],
  brate:    [{id:'curl',name:'Bicep Curl (halteră)'},{id:'dbcurl',name:'Bicep Curl (gantere)'},{id:'hammer',name:'Hammer Curl'},{id:'skullcr',name:'Skull Crushers'},{id:'tricepext',name:'Tricep Pushdown'},{id:'dipstric',name:'Dips (triceps)'}],
  picioare: [{id:'squat',name:'Squat'},{id:'legpress',name:'Leg Press'},{id:'rdl',name:'Romanian Deadlift'},{id:'lunge',name:'Lunges'},{id:'legcurl',name:'Leg Curl'},{id:'legext',name:'Leg Extension'},{id:'calf',name:'Calf Raises'}],
  core:     [{id:'plank',name:'Plank'},{id:'crunch',name:'Crunch'},{id:'lgrise',name:'Leg Raises'},{id:'russian',name:'Russian Twist'},{id:'cabcr',name:'Cable Crunch'}],
};

const CARDIO_TYPES = [
  { id:'mers',      name:'Mers',         icon:'🚶', met:3.5,  color:'#10b981' },
  { id:'alergare',  name:'Alergare',     icon:'🏃', met:9.0,  color:'#f97316' },
  { id:'bicicleta', name:'Bicicletă',    icon:'🚴', met:7.5,  color:'#3b82f6' },
  { id:'inot',      name:'Înot',         icon:'🏊', met:8.0,  color:'#6366f1' },
  { id:'sarit',     name:'Sărit coarda', icon:'⚡', met:10.0, color:'#f59e0b' },
];

const WORK_TYPES = [
  { id:'munca_usoara', name:'Muncă ușoară', icon:'🔧', met:2.5, desc:'Birou activ, deplasări' },
  { id:'munca_medie',  name:'Muncă medie',  icon:'⚒️', met:4.0, desc:'Construcții, agricultură' },
  { id:'munca_grea',   name:'Muncă grea',   icon:'🏗️', met:6.0, desc:'Muncă fizică intensă' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, WORK_TYPES };
