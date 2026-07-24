// ---- Supabase Config ----
// Replace these with the values from your Supabase project:
// Project Settings -> API -> Project URL / anon public key
const YOUR_SUPABASE_URL = "https://asyfmqhjnouyrwxlldzs.supabase.co";
const YOUR_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzeWZtcWhqbm91eXJ3eGxsZHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODMwMjAsImV4cCI6MjEwMDE1OTAyMH0.3nXb0-fWv8RxhVuKuCT_dQnxTF-JPNWMQhk76-dZKG4";

// How many days without water before a plant is flagged as overdue.
// Single global default for now — a per-plant value can come later
// once there's a `plants` table.
const WATER_INTERVAL_DAYS = 3;

const isConfigured =
  YOUR_SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  YOUR_SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY" &&
  YOUR_SUPABASE_URL.startsWith("http");

const supabaseClient = isConfigured
  ? window.supabase.createClient(YOUR_SUPABASE_URL, YOUR_SUPABASE_ANON_KEY)
  : null;

// A small curated set of plant facts -- hardcoded on purpose rather
// than pulled from an API. No network dependency, no rate limits,
// works even if you're offline, and never adds a delay before the
// button is usable.
const PLANT_FUN_FACTS = [
  "Bananas are technically berries, but strawberries aren't.",
  "Some bamboo species can grow up to 3 feet in a single day.",
  "A single tree can absorb roughly 48 pounds of CO2 per year.",
  "Sunflowers track the sun across the sky, a behavior called heliotropism.",
  "The oldest known living tree is over 5,000 years old.",
  "Peanuts aren't nuts -- they're legumes, related to beans and lentils.",
  "Some plants, like the Venus flytrap, can count -- they only snap shut after two touches within 20 seconds.",
  "Corpse flowers can grow over 10 feet tall and bloom only once every several years.",
  "Carrots were originally purple before orange varieties became common.",
  "Tomato plants release a scent when damaged that can trigger defenses in nearby tomato plants.",
  "A quaking aspen grove can technically be a single organism, connected by one root system.",
  "Rice is the staple food for over half the world's population.",
  "The world's smallest flowering plant, watermeal, is smaller than a grain of rice.",
  "Cacti can survive over two years without a single drop of water.",
  "Some seeds can remain dormant for centuries and still germinate.",
  "Ferns reproduce with spores instead of seeds or flowers.",
  "Ivy doesn't damage healthy brick, but it can worsen cracks that already exist.",
  "Mint plants spread so aggressively through runners that most gardeners grow them in pots.",
  "The Amazon rainforest produces about 20% of the world's oxygen.",
  "Orchids are one of the largest plant families, with over 25,000 species.",
  "A mature oak tree can drop over 10,000 acorns in a single good year.",
  "Basil releases more fragrance the more you pinch its leaves.",
  "Bonsai isn't a species -- it's a technique that can be applied to almost any tree.",
  "Some mosses can survive being completely dried out and rehydrate years later.",
  "Coffee plants can live for over 100 years, though yields drop off much earlier.",
  "Cucumbers are 96% water.",
  "The saguaro cactus doesn't grow its first arm until it's around 75 years old.",
  "Lavender's scent comes from oils that also naturally repel some insects.",
  "Bromeliads, like pineapples, can absorb water and nutrients directly through their leaves.",
  "A single mature maple tree can release around 200,000 seeds in its lifetime."
];

function getRandomFunFact(){
  return PLANT_FUN_FACTS[Math.floor(Math.random() * PLANT_FUN_FACTS.length)];
}

// ---- Shared helpers ----

// Sanitizes a plant name: lowercase, only letters/numbers/underscore/
// hyphen, capped length. This keeps stray characters out of the
// database and out of innerHTML.
function sanitizePlantId(raw){
  return (raw || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

// True if the URL actually had a usable `?plant=` value — i.e. this
// load came from tapping an NFC tag, not from opening the bare link.
function hasPlantParam(){
  const raw = new URLSearchParams(window.location.search).get('plant') || '';
  return sanitizePlantId(raw).length > 0;
}

// Pulls `?plant=` off the URL and sanitizes it. Falls back to
// the_south_lawn if it's missing, empty, or turns out empty after
// sanitizing (e.g. it was all stripped-out characters).
function getActivePlantId(){
  const raw = new URLSearchParams(window.location.search).get('plant') || '';
  return sanitizePlantId(raw) || 'the_south_lawn';
}

// Turns a stored plant_id (lowercase, underscores) into a display
// name ("the_south_lawn" -> "The South Lawn"). Purely cosmetic —
// the underlying id used for the database stays as-is.
function prettifyPlantName(id){
  return (id || '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Escapes text before it's inserted via innerHTML. plant_id ends up
// in the database and then back out into the dashboard's HTML, so it
// needs escaping even though it's already sanitized on the way in —
// defense in depth against old rows written before sanitization existed.
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatRelativeTime(dateInput){
  const date = new Date(dateInput);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if(seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if(minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if(hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if(days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if(weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function dayKey(date){
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function daysBetween(a, b){
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / msPerDay);
}

// Fetches per-plant watering intervals from the `plants` table.
// Returns a map like { the_south_lawn: 2, monstera: 7 }. Plants
// without a row fall back to WATER_INTERVAL_DAYS. Fails soft — an
// empty map just means every plant uses the default.
async function fetchPlantIntervals(){
  const intervals = {};
  if(!isConfigured) return intervals;
  try {
    const { data, error } = await supabaseClient
      .from('plants')
      .select('plant_id, interval_days');
    if(!error && data){
      for(const row of data){
        if(row.interval_days > 0) intervals[row.plant_id] = row.interval_days;
      }
    }
  } catch(err){
    console.error('Could not load plant intervals:', err);
  }
  return intervals;
}

// Groups raw log rows by plant_id and computes stats for each plant:
// last watered timestamp, days since, current streak, best streak,
// total waterings, interval, and whether it's due. `intervals` is an
// optional map of plant_id -> days from the plants table.
function summarizePlants(logs, intervals){
  intervals = intervals || {};
  const byPlant = {};

  for(const log of logs){
    const id = log.plant_id;
    if(!byPlant[id]) byPlant[id] = [];
    byPlant[id].push(new Date(log.created_at));
  }

  const plants = [];

  for(const plantId in byPlant){
    const dates = byPlant[plantId].sort((a, b) => b - a); // newest first
    const lastWatered = dates[0];
    const now = new Date();
    const daysSince = daysBetween(lastWatered, now);
    const interval = intervals[plantId] || WATER_INTERVAL_DAYS;

    // Unique days with a log, oldest first -- easiest direction to
    // walk when checking whether each watering arrived "on time".
    const uniqueDaysAsc = [...new Set(dates.map(dayKey))]
      .map(k => {
        const [y, m, d] = k.split('-').map(Number);
        return new Date(y, m, d);
      })
      .sort((a, b) => a - b);

    // A watering "keeps the streak" if it arrived within `interval`
    // days of the previous one -- not literally the next calendar
    // day. A plant watered every 7 days on schedule should show a
    // real streak, not always 1.
    let bestStreak = uniqueDaysAsc.length ? 1 : 0;
    let run = uniqueDaysAsc.length ? 1 : 0;
    for(let i = 1; i < uniqueDaysAsc.length; i++){
      const gap = daysBetween(uniqueDaysAsc[i - 1], uniqueDaysAsc[i]);
      run = (gap <= interval) ? run + 1 : 1;
      if(run > bestStreak) bestStreak = run;
    }

    // Current streak is that same run, but only if the plant isn't
    // overdue right now -- being late today breaks the streak even
    // if every past gap was on time.
    let streak = (daysSince <= interval) ? run : 0;
    if(streak > bestStreak) bestStreak = streak;

    plants.push({
      plantId,
      lastWatered,
      daysSince,
      streak,
      bestStreak,
      total: dates.length,
      interval,
      overdue: daysSince >= interval
    });
  }

  // Most overdue first — the actionable order for a dashboard.
  plants.sort((a, b) => b.daysSince - a.daysSince);
  return plants;
}

// Buckets logs by calendar day across a window of full weeks (Sunday
// through today), for the heatmap. The window always starts on a
// Sunday -- only the final (current) week can be partial -- so there's
// never an ambiguous partial leading column.
function buildDailyCounts(logs, numWeeks){
  const counts = {};
  for(const log of logs){
    const k = dayKey(new Date(log.created_at));
    counts[k] = (counts[k] || 0) + 1;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentWeekSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const windowStart = new Date(currentWeekSunday.getFullYear(), currentWeekSunday.getMonth(), currentWeekSunday.getDate() - (numWeeks - 1) * 7);

  const out = [];
  const cursor = new Date(windowStart);
  while(cursor <= today){
    out.push({ date: new Date(cursor), count: counts[dayKey(cursor)] || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
