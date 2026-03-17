// ─── Pre-cache alimente comune la startup ────────────────────────────────────
// La prima lansare face toate query-urile în background și le salvează în cache.
// De la a doua lansare totul e instant.

import { getCachedSearch, setCachedSearch } from './searchCache';

const COMMON_QUERIES = [
  // Proteine
  'chicken breast','chicken','beef','pork','salmon','tuna','eggs','egg',
  'turkey','shrimp','cod','tilapia','sardines','mackerel','crab','lobster',
  'cottage cheese','greek yogurt','yogurt','milk','cheese','mozzarella',
  'whey protein','protein powder','tofu','tempeh',
  // Românești proteine
  'piept pui','pulpe pui','vita','porc','pastrav','somon','ton','ou',
  'branza','iaurt','lapte','cascaval','telemea','urda',
  // Carbs
  'rice','brown rice','oats','oatmeal','pasta','bread','potato','sweet potato',
  'quinoa','barley','corn','tortilla','bagel','crackers','cereal',
  'white rice','whole wheat bread','sourdough',
  // Românești carbs
  'orez','orez brun','paste','paine','cartofi','cartofi dulci','mamaliga',
  'malai','faina','covrigi','biscuiti',
  // Legume
  'broccoli','spinach','kale','lettuce','tomato','cucumber','pepper',
  'onion','garlic','carrot','zucchini','mushroom','asparagus','celery',
  'cabbage','cauliflower','green beans','peas','corn','eggplant',
  'brussels sprouts','artichoke','beets','radish','leek',
  // Românești legume
  'broccoli','spanac','rosii','castraveti','ardei','ceapa','morcov',
  'dovlecel','ciuperci','varza','conopida','fasole verde','mazare','vinete',
  'sfecla','praz','telina','gogosari',
  // Fructe
  'apple','banana','orange','strawberry','blueberry','raspberry','grape',
  'watermelon','mango','pineapple','peach','pear','cherry','plum',
  'grapefruit','lemon','lime','kiwi','avocado','coconut','melon',
  // Românești fructe
  'mar','banana','portocala','capsuni','afine','zmeura','struguri',
  'pepene','mango','ananas','piersica','para','cirese','prune','kiwi',
  // Grăsimi
  'olive oil','coconut oil','butter','almonds','walnuts','cashews','peanuts',
  'peanut butter','almond butter','sunflower seeds','pumpkin seeds',
  'chia seeds','flax seeds','tahini','avocado oil',
  // Românești grăsimi
  'ulei masline','unt','migdale','nuci','caju','alune','seminte floarea',
  'seminte dovleac','seminte chia','seminte in',
  // Produse procesate comune
  'pizza','hamburger','sandwich','salad','soup','steak','sushi',
  'chocolate','ice cream','cake','cookies','chips','popcorn',
  'coffee','tea','orange juice','apple juice','coca cola','beer','wine',
  // Românești procesate
  'salam','parizer','sunca','kaizer','cremwursti','carnati',
  'smantana','frisca','unt','margarina',
  // Suplimente / Sport
  'protein shake','creatine','bcaa','pre workout','mass gainer',
  'protein bar','energy bar','granola','trail mix',
  // Prep comune
  'boiled egg','scrambled eggs','fried egg','grilled chicken',
  'baked potato','steamed rice','pasta bolognese','chicken soup',
  'beef stew','vegetable soup','caesar salad','greek salad',
];

// Deduplicare
const UNIQUE_QUERIES = [...new Set(COMMON_QUERIES)];

let prefetchStarted = false;

export async function prefetchCommonFoods() {
  if (prefetchStarted) return;
  prefetchStarted = true;

  // Verifică câte mai lipsesc din cache
  const missing = UNIQUE_QUERIES.filter(q => !getCachedSearch(q));

  if (missing.length === 0) {
    console.log('✓ Pre-cache complet — toate', UNIQUE_QUERIES.length, 'query-uri în cache');
    return;
  }

  console.log(`Pre-cache: ${missing.length} query-uri lipsă din ${UNIQUE_QUERIES.length}`);

  const apiKey = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';

  // Procesăm în batch-uri de 5 pentru a nu spama API-ul
  const BATCH_SIZE = 5;
  const DELAY_MS = 300;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(batch.map(async (query) => {
      try {
        // Verifică din nou în cache (poate a fost adăugat de user între timp)
        if (getCachedSearch(query)) return;

        const res = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=6&dataType=Foundation,SR%20Legacy&api_key=${apiKey}`
        );
        if (!res.ok) return;
        const d = await res.json();

        const results = (d.foods || []).slice(0, 6).map(f => {
          const nuts = f.foodNutrients || [];
          const get = n => Math.round((nuts.find(x => x.nutrientName === n)?.value || 0) * 10) / 10;
          const name = f.description
            .replace(/,\s*(raw|cooked|boiled|roasted|grilled|frozen|canned)/gi, '')
            .replace(/\s+/g, ' ').trim();
          const lc = name.toLowerCase();
          const cat = /chicken|beef|fish|salmon|tuna|pork|turkey|egg|shrimp|piept|vita|porc|pastrav|somon/.test(lc) ? 'proteine'
            : /rice|pasta|bread|oat|potato|corn|wheat|orez|paste|paine|cartof/.test(lc) ? 'carbs'
            : /broccoli|spinach|carrot|tomato|lettuce|pepper|cucumber|rosii|morcov|ardei/.test(lc) ? 'legume'
            : /apple|banana|orange|berry|grape|mango|mar|banana|portocala|capsuni/.test(lc) ? 'fructe'
            : /oil|butter|nuts|almond|avocado|cheese|ulei|unt|nuci|branza/.test(lc) ? 'grasimi' : 'diverse';

          const id = `usda_${name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').slice(0,40)}`;
          return {
            id, name, emoji: '🍽', cat, unit: 'g', unitG: 1, source: 'usda',
            kcal: Math.round(get('Energy')),
            p: get('Protein'),
            c: get('Carbohydrate, by difference'),
            fat: get('Total lipid (fat)'),
            f: get('Total lipid (fat)'),
            fiber: get('Fiber, total dietary'),
          };
        }).filter(f => f.kcal > 0);

        // Deduplicare
        const seen = new Set();
        const deduped = results.filter(f => {
          const k = f.name.toLowerCase().slice(0, 20);
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });

        if (deduped.length > 0) {
          setCachedSearch(query, deduped, 'usda');
        }
      } catch { /* ignore errors în pre-fetch */ }
    }));

    // Pauză între batch-uri
    if (i + BATCH_SIZE < missing.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  const remaining = UNIQUE_QUERIES.filter(q => !getCachedSearch(q)).length;
  console.log(`✓ Pre-cache done. ${UNIQUE_QUERIES.length - remaining}/${UNIQUE_QUERIES.length} în cache`);
}

export { UNIQUE_QUERIES };
