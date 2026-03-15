const QUOTES_MALE = [
  { text: "Disciplina este podul dintre obiective și realizări.", author: "Jim Rohn" },
  { text: "Durerea este temporară. Abandonul durează pentru totdeauna.", author: "Lance Armstrong" },
  { text: "Nu contează cât de încet mergi, atât timp cât nu te oprești.", author: "Confucius" },
  { text: "Forța nu vine din capacitatea fizică. Vine dintr-o voință indomptabilă.", author: "Gandhi" },
  { text: "Fiecare campion a fost odată un concurent care a refuzat să renunțe.", author: "Rocky Balboa" },
  { text: "Succesul nu este final. Eșecul nu este fatal. Curajul de a continua contează.", author: "Churchill" },
  { text: "Corpul tău poate face aproape orice. Mintea ta trebuie convinsă.", author: "Anonim" },
  { text: "Motivația te pornește. Obiceiul te ține în mișcare.", author: "Jim Ryun" },
  { text: "Nu te măsura cu alții. Fii mai bun decât erai ieri.", author: "Anonim" },
  { text: "Greutățile pe care le ridici azi construiesc bărbatul de mâine.", author: "Anonim" },
  { text: "Un atlet de campionat nu există fără zile grele de antrenament.", author: "Anonim" },
  { text: "Câștigătorii fac ce e nevoie, chiar și când nu vor.", author: "Anonim" },
  { text: "Dacă nu construiești visul tău, cineva te va angaja să construiești al lui.", author: "Tony Gaskins" },
  { text: "Cel mai greu set e primul. Restul vin singure.", author: "Anonim" },
  { text: "Mâncarea e combustibil. Antrenamentul e construcție. Somnul e recuperare.", author: "Anonim" },
  { text: "Omul puternic nu e cel care nu cade niciodată, ci cel care se ridică mereu.", author: "Anonim" },
  { text: "Fiecare repetare te aduce mai aproape de versiunea cea mai bună a ta.", author: "Anonim" },
  { text: "Nu există scurtături spre un loc care merită să ajungi.", author: "Beverly Sills" },
  { text: "Dificultatea pregătește oameni obișnuiți pentru destinații extraordinare.", author: "C.S. Lewis" },
  { text: "Prima oară e alegere. A doua oară e obicei. A treia oară e caracter.", author: "Anonim" },
  { text: "Corpul atinge ceea ce mintea crede.", author: "Napoleon Hill" },
  { text: "Antrenamentul greu bate talentul când talentul nu se antrenează greu.", author: "Tim Notke" },
  { text: "Dacă îți este ușor, nu crești.", author: "Anonim" },
  { text: "Recuperarea e la fel de importantă ca antrenamentul.", author: "Anonim" },
  { text: "Fii obsedat sau fii mediocru.", author: "Grant Cardone" },
  { text: "Ziua în care plantezi sămânța nu e ziua în care mănânci fructul.", author: "Fabienne Fredrickson" },
  { text: "Înainte să te dai bătut, încearcă.", author: "Anonim" },
  { text: "Progresul, nu perfecțiunea.", author: "Anonim" },
  { text: "Starea fizică nu e un loc la care ajungi. E un mod de viață.", author: "Anonim" },
  { text: "Fiecare mare atlet a început ca începător.", author: "Anonim" },
];

function getDailyQuote() {
  const day = Math.floor(Date.now() / (1000*60*60*24));
  return QUOTES_MALE[day % QUOTES_MALE.length];
}

// ─── FOODS DATABASE ───────────────────────────────────────────────────────────

export { QUOTES_MALE, getDailyQuote };
