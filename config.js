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

const supabase = isConfigured
  ? window.supabase.createClient(YOUR_SUPABASE_URL, YOUR_SUPABASE_ANON_KEY)
  : null;

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
// plant_01 if it's missing, empty, or turns out empty after
// sanitizing (e.g. it was all stripped-out characters).
function getActivePlantId(){
  const raw = new URLSearchParams(window.location.search).get('plant') || '';
  return sanitizePlantId(raw) || 'plant_01';
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

// Groups raw log rows by plant_id and computes stats for each plant:
// last watered timestamp, days since, current streak, total waterings.
function summarizePlants(logs){
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

    // Streak: count consecutive unique days with a log, starting from
    // today or yesterday (so it doesn't zero out just because today's
    // watering hasn't happened yet).
    const uniqueDays = [...new Set(dates.map(dayKey))];
    let streak = 0;
    if(daysSince <= 1){
      let cursor = lastWatered;
      for(let i = 0; i < uniqueDays.length; i++){
        const expectedKey = dayKey(cursor);
        if(uniqueDays[i] === expectedKey){
          streak++;
          cursor = new Date(cursor.getTime() - 86400000);
        } else {
          break;
        }
      }
    }

    plants.push({
      plantId,
      lastWatered,
      daysSince,
      streak,
      total: dates.length,
      overdue: daysSince >= WATER_INTERVAL_DAYS
    });
  }

  // Most overdue first — the actionable order for a dashboard.
  plants.sort((a, b) => b.daysSince - a.daysSince);
  return plants;
}
