// api/notify.js — notificări push Mihai Performance

const ONESIGNAL_APP_ID = "23f0b65c-0747-467c-878b-69b0d7431dd9";

const MESAJE_MOTIVATIONALE = [
  "Fiecare kg pierdut e o victorie. Continuă! 💪",
  "96kg → 88kg. Ești pe drum, nu te opri! 🔥",
  "Testosteronul se construiește în sală și în bucătărie. 🏋",
  "Somnul bun = testosteron mai mare. Culcă-te devreme! 😴",
  "LDL-ul tău a scăzut de la 209 la 119. Dovedești că poți! 🎯",
  "Proteine ≥150g azi? Corpul tău depinde de tine! 💊",
  "Consistența bate intensitatea. Fii constant! ⚡",
  "Azi e o nouă șansă să fii mai bun decât ieri! 🚀",
  "Mușchii se construiesc din proteine și disciplină. Tu ai ambele! 💪",
  "Fiecare antrenament contează. Chiar și cel mic! 🏆",
  "Hidratare, somn, nutriție. Repeat! 💧",
  "45 ani și mai puternic ca la 30. Asta e! 🔥",
  "Deficit caloric mic, progres constant. Știi cum se face! 📈",
  "Suplimentele sunt luate? Nu uita creatina! 💊",
  "Fiecare set, fiecare rep — construiesc versiunea mai bună a ta! 🏋",
];

const MESAJE_MASA = {
  mic_dejun: [
    "Bună dimineața Mihai! ☀️ Mic dejun bogat în proteine pentru energie maximă!",
    "Rise & grind! 🔥 Nu sări peste mic dejun — proteinele de dimineață sunt esențiale!",
    "Start zi! 💪 Ouă, iaurt, ovăz — corpul tău are nevoie de combustibil!",
  ],
  pranz: [
    "Jumătatea zilei! 🍽 Ai logat prânzul? Proteinele nu se iau singure!",
    "Prânz timp! ⚡ Pui, orez, legume — simplu și eficient!",
    "Macros la zi? 📊 Verifică totalul și ajustează cina dacă e nevoie!",
  ],
  cina: [
    "Seara se apropie! 🌙 Cină ușoară și bogată în proteine pentru recuperare nocturnă!",
    "Ultima masă! 🍽 Nu uita să loghezi tot ce ai mâncat azi!",
    "Recovery mode on! 😴 O cină bună = recuperare mai bună = rezultate mai bune!",
  ],
};

const MESAJE_SUPLIMENTE = [
  "💊 Reminder: ai luat suplimentele de dimineață? Creatina, D3, Omega-3!",
  "💊 Suplimentele de seară: Mg bisglicinat pentru somn + recuperare!",
  "💊 Citrulina malat înainte de antrenament? 6-8g pentru pump maxim!",
];

const MESAJE_NOAPTE_BUNA = [
  "Noapte bună Mihai! 🌙 Somn 7-8h = testosteron optim. Odihna e parte din program!",
  "Rest day sau workout day, somnul e întotdeauna prioritar. Noapte! 💤",
  "Ai muncit azi. Acum lasă corpul să se recupereze. Noapte bună! 🌟",
  "Somn <6h = alertă testosteron. Culcă-te acum! 😴",
];

function getRandom(arr){return arr[Math.floor(Math.random()*arr.length)];}

async function sendNotification(title, message, url="https://nutritie-ai.vercel.app"){
  const res=await fetch("https://onesignal.com/api/v1/notifications",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Basic ${process.env.ONESIGNAL_API_KEY}`},
    body:JSON.stringify({
      app_id:ONESIGNAL_APP_ID,
      included_segments:["All"],
      headings:{en:title,ro:title},
      contents:{en:message,ro:message},
      url,
      chrome_web_icon:"https://nutritie-ai.vercel.app/vite.svg",
    }),
  });
  return res.json();
}

export default async function handler(req,res){
  if(req.method!=="POST"&&req.method!=="GET")return res.status(405).json({error:"Method not allowed"});

  const now=new Date();
  const romaniaHour=(now.getUTCHours()+3)%24;
  const type=req.query.type||"auto";

  let result;

  if(type==="mic_dejun"||romaniaHour===9){
    result=await sendNotification("🌅 Mic dejun",getRandom(MESAJE_MASA.mic_dejun));
  }else if(type==="motivational"||romaniaHour===10){
    result=await sendNotification("⚡ Motivația zilei",getRandom(MESAJE_MOTIVATIONALE));
  }else if(type==="suplimente_dim"||romaniaHour===8){
    result=await sendNotification("💊 Suplimente dimineață",MESAJE_SUPLIMENTE[0]);
  }else if(type==="pranz"||romaniaHour===13){
    result=await sendNotification("🍽 Prânz",getRandom(MESAJE_MASA.pranz));
  }else if(type==="cina"||romaniaHour===19){
    result=await sendNotification("🌙 Cină",getRandom(MESAJE_MASA.cina));
  }else if(type==="suplimente_seara"||romaniaHour===21){
    result=await sendNotification("💊 Suplimente seară",MESAJE_SUPLIMENTE[1]);
  }else if(type==="noapte_buna"||romaniaHour===23){
    result=await sendNotification("🌙 Noapte bună",getRandom(MESAJE_NOAPTE_BUNA));
  }else{
    return res.status(200).json({message:"Nu e ora unei notificări",hour:romaniaHour});
  }

  return res.status(200).json({success:true,result});
}
