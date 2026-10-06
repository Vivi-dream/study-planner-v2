/* =========================================================
   STUDY PLANNER — REAL SUPABASE VERSION
   Part 1 — configuration + core helpers
   ========================================================= */

const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

/* -----------------------------
   Global configuration
----------------------------- */

const REVISION_DELAYS = [2, 3, 5, 7];

const AVATARS = [
  "🌸",
  "🌷",
  "🌺",
  "🌻",
  "🌼",
  "🪻",
  "🌹",
  "🦋",
  "🐰",
  "🐱",
  "🐻",
  "🩷",
  "💜",
  "✨",
  "🌙",
  "⭐"
];

const SUBJECT_ICONS = [
  "📐",
  "📖",
  "🇬🇧",
  "🌍",
  "🧪",
  "🌱",
  "🇪🇸",
  "🎨",
  "💻",
  "🎵",
  "🏛️",
  "⚗️"
];

const PRESET_COLORS = [
  "#E9A8BD",
  "#B9A7E8",
  "#8FC9BD",
  "#E8BD7D",
  "#A9BFE8",
  "#D89FCA",
  "#D6B4A8",
  "#A8D2DC"
];

/* -----------------------------
   Application state
----------------------------- */

let session = null;
let profile = null;

let activePage = "dashboard";
let activeSubjectId = null;
let activeChapterId = null;
let activeMaterialId = null;

let calendarDate = new Date();
let selectedCalendarDate = new Date()
  .toISOString()
  .slice(0, 10);

let flashDeck = [];
let flashIndex = 0;
let flashFlipped = false;

let quizState = {
  questions: [],
  index: 0,
  score: 0,
  difficulty: "medium"
};

let focusState = {
  seconds: 25 * 60,
  timer: null,
  wakeLock: null
};

/* -----------------------------
   Database data
----------------------------- */

const DATA = {
  subjects: [],
  chapters: [],
  materials: [],
  revisions: [],
  flashcards: [],
  tasks: [],
  events: [],
  quizAttempts: [],
  rewards: []
};

/* -----------------------------
   Small helper functions
----------------------------- */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

const today = () =>
  new Date().toISOString().slice(0, 10);

const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const addDays = (dateString, numberOfDays) => {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + numberOfDays);
  return date.toISOString().slice(0, 10);
};

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
];

const DAYS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi"
];

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character])
  );
}

function shuffle(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const randomIndex =
      Math.floor(Math.random() * (i + 1));

    [copy[i], copy[randomIndex]] =
      [copy[randomIndex], copy[i]];
  }

  return copy;
}

/* -----------------------------
   Notifications inside website
----------------------------- */

function toast(message, type = "success") {
  const container = $("#toast-container");

  if (!container) return;

  const item = document.createElement("div");

  item.className = `toast ${type}`;
  item.textContent = message;

  container.appendChild(item);

  setTimeout(() => {
    item.remove();
  }, 3200);
}

/* -----------------------------
   Modal helpers
----------------------------- */

function openModal(content) {
  const modal = $("#modal");
  const box = $("#modal-box");

  if (!modal || !box) return;

  box.innerHTML = `
    <button id="modal-close" class="modal-x">
      ×
    </button>

    ${content}
  `;

  modal.classList.remove("hidden");

  $("#modal-close").onclick = closeModal;
}

function closeModal() {
  $("#modal")?.classList.add("hidden");
}

/* -----------------------------
   Supabase shortcuts
----------------------------- */

async function insertRow(table, row) {
  const { data, error } =
    await supabaseClient
      .from(table)
      .insert(row)
      .select()
      .single();

  if (error) throw error;

  return data;
}

async function updateRow(table, id, values) {
  const { data, error } =
    await supabaseClient
      .from(table)
      .update(values)
      .eq("id", id)
      .select()
      .single();

  if (error) throw error;

  return data;
}

async function deleteRow(table, id) {
  const { error } =
    await supabaseClient
      .from(table)
      .delete()
      .eq("id", id);

  if (error) throw error;
}

/* -----------------------------
   Database lookup helpers
----------------------------- */

function getSubject(id) {
  return DATA.subjects.find(
    subject => subject.id === id
  );
}

function getChapter(id) {
  return DATA.chapters.find(
    chapter => chapter.id === id
  );
}

function getMaterial(id) {
  return DATA.materials.find(
    material => material.id === id
  );
}

function getMaterialIcon(kind) {
  const icons = {
    notes: "📝",
    pdf: "📄",
    docx: "📘",
    pptx: "📊",
    image: "📸",
    youtube: "▶️"
  };

  return icons[kind] || "📖";
}

/* -----------------------------
   Mastery system
----------------------------- */

function calculateMastery(materialId) {
  const material = getMaterial(materialId);

  if (!material) return 0;

  const completedRevisions =
    DATA.revisions.filter(
      revision =>
        revision.material_id === materialId &&
        revision.completed
    ).length;

  const strongCards =
    DATA.flashcards.filter(
      card =>
        card.material_id === materialId &&
        (card.box || 1) >= 4
    ).length;

  const base = Number(
    material.mastery_score || 0
  );

  return Math.min(
    100,
    Math.round(
      base +
      Math.min(55, completedRevisions * 14) +
      Math.min(30, strongCards * 6)
    )
  );
}

function masteryLabel(score) {
  if (score >= 90) return "Maîtrisé";
  if (score >= 70) return "Bien maîtrisé";
  if (score >= 45) return "À renforcer";
  if (score >= 20) return "En apprentissage";
  return "À découvrir";
}

/* -----------------------------
   XP
----------------------------- */

function totalXP() {
  const revisionXP =
    DATA.revisions.filter(
      revision => revision.completed
    ).length * 15;

  const quizXP =
    DATA.quizAttempts.reduce(
      (total, quiz) =>
        total + Number(quiz.earned_xp || 0),
      0
    );

  const flashcardXP =
    DATA.flashcards.filter(
      card => (card.box || 1) >= 4
    ).length * 2;

  const taskXP =
    DATA.tasks.filter(
      task => task.completed
    ).length * 3;

  const profileXP =
    Number(profile?.xp || 0);

  return (
    revisionXP +
    quizXP +
    flashcardXP +
    taskXP +
    profileXP
  );
}

function currentLevel() {
  return Math.floor(totalXP() / 100) + 1;
}
