/* =========================================================
   STUDY PLANNER — REAL SUPABASE VERSION
   Part 1 — configuration + core helpers
   ========================================================= */

const SUPABASE_URL = "https://mobguanciniqnlyomdaw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_If-fVDIcUQVz1oD0OgoImQ_yWluJaoK";

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
let sessionActuelle = null;
let utilisateurActuel = null;
let avatarSelectionne = null;
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
/* =========================================================
   PART 2 — AUTHENTICATION + PROFILE
   ========================================================= */

/* -----------------------------
   Authentication screens
----------------------------- */

function showAuthScreen() {
  const authScreen = $("#auth-screen");
  const mainApp = $("#main-app");

  if (authScreen) {
    authScreen.classList.remove("hidden");
  }

  if (mainApp) {
    mainApp.classList.add("hidden");
  }
}

function showMainApp() {
  const authScreen = $("#auth-screen");
  const mainApp = $("#main-app");

  if (authScreen) {
    authScreen.classList.add("hidden");
  }

  if (mainApp) {
    mainApp.classList.remove("hidden");
  }
}

function showLoginView() {
  const loginView = $("#login-view");
  const signupView = $("#signup-view");

  if (loginView) {
    loginView.classList.remove("hidden");
  }

  if (signupView) {
    signupView.classList.add("hidden");
  }
}

function showSignupView() {
  const loginView = $("#login-view");
  const signupView = $("#signup-view");

  if (loginView) {
    loginView.classList.add("hidden");
  }

  if (signupView) {
    signupView.classList.remove("hidden");
  }
}

/* -----------------------------
   Authentication errors
----------------------------- */

function handleAuthError(error) {
  console.error("Supabase error:", error);

  let message = "Une erreur est survenue.";

  if (error?.message) {
    message = error.message;
  }

  if (
    message.toLowerCase().includes("invalid login credentials")
  ) {
    message =
      "Email ou mot de passe incorrect.";
  }

  if (
    message.toLowerCase().includes("user already registered")
  ) {
    message =
      "Cette adresse email possède déjà un compte.";
  }

  if (
    message.toLowerCase().includes("password should be at least")
  ) {
    message =
      "Le mot de passe est trop court.";
  }

  toast(message, "error");
}

/* -----------------------------
   Avatar picker
----------------------------- */

function createAvatarButtons(containerId) {
  const container = $(containerId);

  if (!container) {
    return;
  }

  container.innerHTML = AVATARS
    .map(
      avatar => `
        <button
          type="button"
          class="avatar-option"
          data-avatar="${escapeHTML(avatar)}"
        >
          ${avatar}
        </button>
      `
    )
    .join("");

  const savedAvatar =
    profile?.avatar || "🌸";

  const buttons =
    $$(".avatar-option", container);

  buttons.forEach(button => {
    if (
      button.dataset.avatar === savedAvatar
    ) {
      button.classList.add("selected");
    }

    button.addEventListener(
      "click",
      () => {
        buttons.forEach(item =>
          item.classList.remove("selected")
        );

        button.classList.add("selected");
      }
    );
  });
}

function openAvatarPicker(type) {
  const container =
    type === "profile"
      ? document.querySelector("#profile-avatars")
      : document.querySelector("#signup-avatars");

  if (container) {
    container.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}
function initializeAvatarPickers() {
  createAvatarButtons(
    "#signup-avatars"
  );

  createAvatarButtons(
    "#profile-avatars"
  );
}

/* -----------------------------
   Create account
----------------------------- */

async function registerAccount() {

  const firstName =
    $("#signup-first-name")
      ?.value
      .trim();

  const lastName =
    $("#signup-last-name")
      ?.value
      .trim();

  const displayName =
    $("#signup-display-name")
      ?.value
      .trim() ||
    `${firstName} ${lastName}`;

  const classLevel =
    $("#signup-class")
      ?.value
      .trim();

  const ageValue =
    $("#signup-age")
      ?.value;

  const age =
    ageValue
      ? Number(ageValue)
      : null;

  const birthDate =
    $("#signup-birthdate")
      ?.value || null;

  const email =
    $("#signup-email")
      ?.value
      .trim();

  const password =
    $("#signup-password")
      ?.value;

  const avatar =
    $("#signup-avatars .selected")
      ?.dataset
      .avatar || "🌸";

  if (!firstName) {
    toast(
      "Entre ton prénom.",
      "warning"
    );
    return;
  }

  if (!lastName) {
    toast(
      "Entre ton nom.",
      "warning"
    );
    return;
  }

  if (!email) {
    toast(
      "Entre ton email.",
      "warning"
    );
    return;
  }

  if (!password || password.length < 6) {
    toast(
      "Le mot de passe doit contenir au moins 6 caractères.",
      "warning"
    );
    return;
  }

  try {
    const { data, error } =
      await supabaseClient.auth.signUp({
        email,
        password,

        options: {
          data: {
            first_name:
              firstName,

            last_name:
              lastName,

            display_name:
              displayName,

            age:
              age,

            birthdate:
              birthDate,

            class_level:
              classLevel,

            avatar:
              avatar
          },

       emailRedirectTo:
  "https://study-planner-v2-ten.vercel.app"
        }
      });

    if (error) {
      throw error;
    }

    /*
      Supabase may require email confirmation.
      In that case there is no active session yet.
    */

    if (!data.session) {
      toast(
        "Compte créé ! Vérifie ton email pour confirmer ton compte. 💌"
      );

      showLoginView();

      return;
    }

    session =
      data.session;

    await loadProfile();

    showMainApp();

    initializeAvatarPickers();

    await loadAllData();

    renderAll();

    toast(
      "Bienvenue dans STUDY PLANNER 🌸"
    );

  } catch (error) {
    handleAuthError(error);
  }
}

/* -----------------------------
   Login
----------------------------- */

async function loginAccount(event) {

  const email =
    $("#login-email")
      ?.value
      .trim();

  const password =
    $("#login-password")
      ?.value;

  if (!email) {
    toast(
      "Entre ton email.",
      "warning"
    );
    return;
  }

  if (!password) {
    toast(
      "Entre ton mot de passe.",
      "warning"
    );
    return;
  }

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    session =
      data.session;

    await loadProfile();

    showMainApp();

    initializeAvatarPickers();

    await loadAllData();

    renderAll();

    toast(
      "Bon retour 🌷"
    );

  } catch (error) {
    handleAuthError(error);
  }
}

/* -----------------------------
   Password reset
----------------------------- */

async function sendPasswordReset() {
  const email =
    $("#login-email")
      ?.value
      .trim();

  if (!email) {
    toast(
      "Entre ton email avant de demander la réinitialisation.",
      "warning"
    );

    return;
  }

  try {
    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            window.location.origin
        }
      );

    if (error) {
      throw error;
    }

    toast(
      "Un email de réinitialisation a été envoyé. 💌"
    );

  } catch (error) {
    handleAuthError(error);
  }
}

/* -----------------------------
   Logout
----------------------------- */

async function logoutAccount() {
  try {
    const { error } =
      await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    session = null;
    profile = null;

    DATA.subjects = [];
    DATA.chapters = [];
    DATA.materials = [];
    DATA.revisions = [];
    DATA.flashcards = [];
    DATA.tasks = [];
    DATA.events = [];
    DATA.quizAttempts = [];
    DATA.rewards = [];

    showAuthScreen();
    showLoginView();

    toast(
      "Tu es déconnecté(e). 🌸"
    );

  } catch (error) {
    handleAuthError(error);
  }
}

/* -----------------------------
   Load profile
----------------------------- */

async function loadProfile() {
  if (!session?.user) {
    return;
  }

  try {
    const { data, error } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

    if (error) {
      throw error;
    }

    /*
      The database trigger should normally
      have created the profile automatically.
    */

    if (data) {
      profile = data;
      return;
    }

    /*
      Backup creation in case the trigger
      has not created it yet.
    */

    const metadata =
      session.user.user_metadata || {};

    const newProfile = {
      id: session.user.id,

      first_name:
        metadata.first_name || "",

      last_name:
        metadata.last_name || "",

      display_name:
        metadata.display_name || "",

      age:
        metadata.age
          ? Number(metadata.age)
          : null,

      birth_date:
        metadata.birthdate || null,

      class_level:
        metadata.class_level || "",

      avatar:
        metadata.avatar || "🌸"
    };

    const { data: inserted, error: insertError } =
      await supabaseClient
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();

    if (insertError) {
      throw insertError;
    }

    profile = inserted;

  } catch (error) {
    console.error(
      "Profile loading error:",
      error
    );

    throw error;
  }
}

/* -----------------------------
   Update profile
----------------------------- */

async function saveProfile(event) {
  event.preventDefault();

  if (!session?.user) {
    return;
  }

  const firstName =
    $("#profile-first-name")
      ?.value
      .trim();

  const lastName =
    $("#profile-last-name")
      ?.value
      .trim();

  const displayName =
    $("#profile-display-name-input")
      ?.value
      .trim();

  const classLevel =
    $("#profile-class-input")
      ?.value
      .trim();

  const ageValue =
    $("#profile-age")
      ?.value;

  const age =
    ageValue
      ? Number(ageValue)
      : null;

  const birthDate =
    $("#profile-birthdate")
      ?.value || null;

  const avatar =
    $("#profile-avatars .selected")
      ?.dataset
      .avatar ||
    profile?.avatar ||
    "🌸";

  try {

    const { data, error } =
      await supabaseClient
        .from("profiles")
        .update({
          first_name:
            firstName,

          last_name:
            lastName,

          display_name:
            displayName,

          class_level:
            classLevel,

          age:
            age,

          birth_date:
            birthDate,

          avatar:
            avatar,

          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          session.user.id
        )
        .select()
        .single();

    if (error) {
      throw error;
    }

    profile = data;

    renderTopUser();

    toast(
      "Profil enregistré 🌷"
    );

  } catch (error) {
    handleAuthError(error);
  }
}

/* -----------------------------
   Update account email
----------------------------- */

async function changeEmail(newEmail) {
  if (!session?.user) {
    return;
  }

  if (!newEmail) {
    toast(
      "Entre une nouvelle adresse email.",
      "warning"
    );

    return;
  }

  try {
    const { error } =
      await supabaseClient.auth.updateUser({
        email: newEmail
      });

    if (error) {
      throw error;
    }

    toast(
      "Un email de confirmation a été envoyé à la nouvelle adresse. 💌"
    );

  } catch (error) {
    handleAuthError(error);
  }
}

/* -----------------------------
   Change password
----------------------------- */

async function changePassword(newPassword) {
  if (!session?.user) {
    return;
  }

  if (!newPassword || newPassword.length < 6) {
    toast(
      "Le nouveau mot de passe doit contenir au moins 6 caractères.",
      "warning"
    );

    return;
  }

  try {
    const { error } =
      await supabaseClient.auth.updateUser({
        password: newPassword
      });

    if (error) {
      throw error;
    }

    toast(
      "Mot de passe modifié ✅"
    );

  } catch (error) {
    handleAuthError(error);
  }
}

/* -----------------------------
   Top user interface
----------------------------- */

function renderTopUser() {
  if (!profile) {
    return;
  }

  const displayName =
    profile.display_name ||
    profile.first_name ||
    "Élève";

  const avatar =
    profile.avatar ||
    "🌸";

  const sidebarName =
    $("#sidebar-name");

  const sidebarAvatar =
    $("#sidebar-avatar");

  const topAvatar =
    $("#top-avatar");

  const topDisplayName =
    $("#top-display-name");

  if (sidebarName) {
    sidebarName.textContent =
      displayName;
  }

  if (sidebarAvatar) {
    sidebarAvatar.textContent =
      avatar;
  }

  if (topAvatar) {
    topAvatar.textContent =
      avatar;
  }

  if (topDisplayName) {
    topDisplayName.textContent =
      displayName;
  }

  const profileAvatar =
    $("#profile-avatar");

  const profileDisplayName =
    $("#profile-display-name");

  const profileEmail =
    $("#profile-email");

  const profileClass =
    $("#profile-class");

  if (profileAvatar) {
    profileAvatar.textContent =
      avatar;
  }

  if (profileDisplayName) {
    profileDisplayName.textContent =
      displayName;
  }

  if (profileEmail) {
    profileEmail.textContent =
      session?.user?.email ||
      "";
  }

  if (profileClass) {
    profileClass.textContent =
      profile.class_level ||
      "Classe";
  }

  const profileLevel =
    $("#profile-level");

  if (profileLevel) {
    profileLevel.textContent =
      currentLevel();
  }

  /*
    Fill profile editing form.
  */

  if ($("#profile-first-name")) {
    $("#profile-first-name").value =
      profile.first_name || "";
  }

  if ($("#profile-last-name")) {
    $("#profile-last-name").value =
      profile.last_name || "";
  }

  if ($("#profile-display-name-input")) {
    $("#profile-display-name-input").value =
      profile.display_name || "";
  }

  if ($("#profile-class-input")) {
    $("#profile-class-input").value =
      profile.class_level || "";
  }

  if ($("#profile-age")) {
    $("#profile-age").value =
      profile.age || "";
  }

  if ($("#profile-birthdate")) {
    $("#profile-birthdate").value =
      profile.birth_date || "";
  }

  $$("#profile-avatars .avatar-option")
    .forEach(button => {

      button.classList.toggle(
        "selected",
        button.dataset.avatar === avatar
      );

    });
}

/* -----------------------------
   Supabase session boot
----------------------------- */

async function initializeAuthentication() {

  /*
    Safety check: the user must insert
    the project URL and publishable key.
  */

  if (
    SUPABASE_URL.startsWith("YOUR_") ||
    SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")
  ) {

    console.warn(
      "Supabase credentials have not been configured yet."
    );

    showAuthScreen();

    return;
  }

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    session =
      data.session;

    if (session) {

      await loadProfile();

      showMainApp();

      initializeAvatarPickers();

      await loadAllData();

      renderAll();

    } else {

      showAuthScreen();

      showLoginView();

    }

    /*
      Keep the UI synchronized whenever
      Supabase authentication changes.
    */

    supabaseClient.auth.onAuthStateChange(
      async (_event, newSession) => {

        session =
          newSession;

        if (!newSession) {

          profile = null;

          showAuthScreen();

          showLoginView();

          return;
        }

        try {

          await loadProfile();

          showMainApp();

          initializeAvatarPickers();

          await loadAllData();

          renderAll();

        } catch (error) {

          handleAuthError(error);

        }

      }
    );

  } catch (error) {

    handleAuthError(error);

  }
}
/* =========================================================
   PART 3 — LOAD DATABASE + SUBJECTS + CHAPTERS + MATERIALS
   ========================================================= */

/* -----------------------------
   Load all student data
----------------------------- */

async function loadAllData() {

  if (!session?.user) {
    return;
  }

  try {

    /*
      We load the student's private
      data from Supabase.

      RLS makes sure the current user
      only receives their own rows.
    */

    const [
      subjectsResult,
      chaptersResult,
      materialsResult,
      revisionsResult,
      flashcardsResult,
      tasksResult,
      eventsResult,
      quizAttemptsResult,
      rewardsResult
    ] = await Promise.all([

      supabaseClient
        .from("subjects")
        .select("*")
        .order("created_at", {
          ascending: true
        }),

      supabaseClient
        .from("chapters")
        .select("*")
        .order("position", {
          ascending: true
        })
        .order("created_at", {
          ascending: true
        }),

      supabaseClient
        .from("materials")
        .select("*")
        .order("created_at", {
          ascending: false
        }),

      supabaseClient
        .from("revisions")
        .select("*")
        .order("scheduled_date", {
          ascending: true
        }),

      supabaseClient
        .from("flashcards")
        .select("*")
        .order("created_at", {
          ascending: true
        }),

      supabaseClient
        .from("tasks")
        .select("*")
        .order("due_date", {
          ascending: true
        }),

      supabaseClient
        .from("calendar_events")
        .select("*")
        .order("event_date", {
          ascending: true
        }),

      supabaseClient
        .from("quiz_attempts")
        .select("*")
        .order("created_at", {
          ascending: false
        }),

      supabaseClient
        .from("rewards")
        .select("*")
        .order("created_at", {
          ascending: true
        })

    ]);

    /*
      Check every request.
    */

    if (subjectsResult.error) {
      throw subjectsResult.error;
    }

    if (chaptersResult.error) {
      throw chaptersResult.error;
    }

    if (materialsResult.error) {
      throw materialsResult.error;
    }

    if (revisionsResult.error) {
      throw revisionsResult.error;
    }

    if (flashcardsResult.error) {
      throw flashcardsResult.error;
    }

    if (tasksResult.error) {
      throw tasksResult.error;
    }

    if (eventsResult.error) {
      throw eventsResult.error;
    }

    if (quizAttemptsResult.error) {
      throw quizAttemptsResult.error;
    }

    if (rewardsResult.error) {
      throw rewardsResult.error;
    }

    /*
      Put database results into application state.
    */

    DATA.subjects =
      subjectsResult.data || [];

    DATA.chapters =
      chaptersResult.data || [];

    DATA.materials =
      materialsResult.data || [];

    DATA.revisions =
      revisionsResult.data || [];

    DATA.flashcards =
      flashcardsResult.data || [];

    DATA.tasks =
      tasksResult.data || [];

    DATA.events =
      eventsResult.data || [];

    DATA.quizAttempts =
      quizAttemptsResult.data || [];

    DATA.rewards =
      rewardsResult.data || [];

  } catch (error) {

    console.error(
      "Database loading failed:",
      error
    );

    throw error;
  }
}


/* -----------------------------
   Refresh everything
----------------------------- */

async function refreshData() {

  try {

    await loadAllData();

    renderAll();

  } catch (error) {

    handleAuthError(error);

  }
}


/* -----------------------------
   Subject helper functions
----------------------------- */

function getSubjectChapters(subjectId) {

  return DATA.chapters
    .filter(
      chapter =>
        chapter.subject_id === subjectId
    )
    .sort(
      (a, b) =>
        (a.position || 0) -
        (b.position || 0)
    );
}


function getSubjectMaterials(subjectId) {

  return DATA.materials
    .filter(
      material =>
        material.subject_id === subjectId
    );
}


function getChapterMaterials(chapterId) {

  return DATA.materials
    .filter(
      material =>
        material.chapter_id === chapterId
    );
}


/* -----------------------------
   SUBJECTS
----------------------------- */

function renderSubjects() {

  const container =
    $("#subjects-grid");

  if (!container) {
    return;
  }

  if (!DATA.subjects.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:50px">
          📚
        </div>

        <strong>
          Aucune matière
        </strong>

        <span>
          Crée ta première matière
          pour commencer ton espace
          de révision.
        </span>

        <br>

        <button
          class="btn primary"
          onclick="openAddSubject()"
        >
          + Nouvelle matière
        </button>
      </div>
    `;

    return;
  }


  container.innerHTML =
    DATA.subjects
      .map(subject => {

        const chapters =
          getSubjectChapters(
            subject.id
          );

        const materials =
          getSubjectMaterials(
            subject.id
          );

        const score =
          materials.length
            ? Math.round(
                materials.reduce(
                  (
                    total,
                    material
                  ) =>
                    total +
                    calculateMastery(
                      material.id
                    ),
                  0
                ) /
                materials.length
              )
            : 0;

        return `
          <article
            class="subject-card"
            data-subject-id="${subject.id}"
          >

            <div
              class="subject-color"
              style="background:${escapeHTML(
                subject.color
              )}"
            ></div>


            <div class="subject-icon">
              ${escapeHTML(
                subject.icon
              )}
            </div>


            <h3>
              ${escapeHTML(
                subject.name
              )}
            </h3>


            <p>
              ${chapters.length}
              chapitre${chapters.length !== 1 ? "s" : ""}
              ·
              ${materials.length}
              cours
            </p>


            <div class="mastery-row">
              <div>
                <span>
                  Maîtrise
                </span>

                <span>
                  ${score}%
                </span>
              </div>

              <div class="mastery-bar">
                <div
                  style="
                    width:${score}%;
                  "
                ></div>
              </div>
            </div>


            <div class="chapter-list">

              ${
                chapters.length

                ? chapters
                    .map(
                      chapter => `
                        <div
                          class="chapter-row"
                        >

                          <span>
                            📑
                            ${escapeHTML(
                              chapter.name
                            )}
                          </span>


                          <div>

                            <button
                              class="mini-action"
                              onclick="openChapter(
                                '${chapter.id}'
                              )"
                            >
                              Voir
                            </button>


                            <button
                              class="mini-action"
                              onclick="renameChapter(
                                '${chapter.id}'
                              )"
                            >
                              ✎
                            </button>


                            <button
                              class="mini-action"
                              onclick="deleteChapter(
                                '${chapter.id}'
                              )"
                            >
                              ×
                            </button>

                          </div>

                        </div>
                      `
                    )
                    .join("")

                : `
                  <div class="empty-state">
                    Aucun chapitre
                    pour le moment.
                  </div>
                `
              }

            </div>


            <div class="subject-actions">

              <button
                class="small-button"
                onclick="openAddChapter(
                  '${subject.id}'
                )"
              >
                + Chapitre
              </button>


              <button
                class="small-button"
                onclick="openAddMaterial(
                  '${subject.id}',
                  ''
                )"
              >
                + Cours
              </button>


              <button
                class="small-button"
                onclick="openSubjectMaterials(
                  '${subject.id}'
                )"
              >
                Ouvrir
              </button>


              <button
                class="small-button"
                onclick="editSubject(
                  '${subject.id}'
                )"
              >
                ✎
              </button>


              <button
                class="small-button"
                onclick="deleteSubject(
                  '${subject.id}'
                )"
              >
                Supprimer
              </button>

            </div>

          </article>
        `;

      })
      .join("");
}


/* -----------------------------
   Create subject
----------------------------- */

window.openAddSubject =
function () {

  openModal(`

    <span class="eyebrow">
      ORGANISATION
    </span>


    <h2>
      Nouvelle matière 📚
    </h2>


    <p>
      Choisis son nom, son icône
      et sa couleur.
    </p>


    <form
      id="new-subject-form"
      class="form-stack"
    >

      <label>
        Nom de la matière

        <input
          id="new-subject-name"
          type="text"
          placeholder="Ex. Mathématiques"
          required
        >
      </label>


      <label>
        Icône

        <select id="new-subject-icon">

          ${SUBJECT_ICONS
            .map(
              icon =>
                `<option value="${icon}">
                  ${icon}
                </option>`
            )
            .join("")}

        </select>
      </label>


      <div>

        <span class="field-label">
          Couleur personnalisée
        </span>

        <input
          id="new-subject-color"
          type="color"
          value="#E9A8BD"
          style="
            width:70px;
            height:45px;
            padding:3px;
          "
        >

      </div>


      <div>

        <span class="field-label">
          Ou choisis une couleur
        </span>


        <div
          class="avatar-grid"
          id="subject-color-presets"
        >

          ${PRESET_COLORS
            .map(
              color => `
                <button
                  type="button"
                  data-color="${color}"
                  style="
                    width:38px;
                    height:38px;
                    border-radius:50%;
                    background:${color};
                    border:3px solid white;
                    box-shadow:0 0 0 1px #eadfe5;
                  "
                  aria-label="Choisir cette couleur"
                ></button>
              `
            )
            .join("")}

        </div>

      </div>


      <button
        type="submit"
        class="btn primary"
      >
        Créer la matière 🌸
      </button>

    </form>
  `);


  $$(
    "#subject-color-presets button"
  ).forEach(button => {

    button.onclick = () => {

      $(
        "#new-subject-color"
      ).value =
        button.dataset.color;

    };

  });


  $(
    "#new-subject-form"
  ).onsubmit = async event => {

    event.preventDefault();

    const name =
      $(
        "#new-subject-name"
      )
        .value
        .trim();

    const icon =
      $(
        "#new-subject-icon"
      )
        .value;

    const color =
      $(
        "#new-subject-color"
      )
        .value;

    if (!name) {

      toast(
        "Donne un nom à la matière.",
        "warning"
      );

      return;
    }

    try {

      await insertRow(
        "subjects",
        {
          user_id:
            session.user.id,

          name,

          icon,

          color
        }
      );

      closeModal();

      await refreshData();

      toast(
        "Matière créée 🌸"
      );

    } catch (error) {

      handleAuthError(error);

    }

  };

};


/* -----------------------------
   Edit subject
----------------------------- */

window.editSubject =
async function (subjectId) {

  const subject =
    getSubject(subjectId);

  if (!subject) {
    return;
  }

  openModal(`

    <span class="eyebrow">
      MATIÈRE
    </span>


    <h2>
      Modifier ${escapeHTML(
        subject.name
      )}
    </h2>


    <form
      id="edit-subject-form"
      class="form-stack"
    >

      <label>
        Nom

        <input
          id="edit-subject-name"
          value="${escapeHTML(
            subject.name
          )}"
          required
        >
      </label>


      <label>
        Icône

        <select id="edit-subject-icon">

          ${SUBJECT_ICONS
            .map(
              icon => `
                <option
                  value="${icon}"
                  ${
                    icon === subject.icon
                      ? "selected"
                      : ""
                  }
                >
                  ${icon}
                </option>
              `
            )
            .join("")}

        </select>
      </label>


      <label>
        Couleur

        <input
          id="edit-subject-color"
          type="color"
          value="${escapeHTML(
            subject.color
          )}"
        >
      </label>


      <button class="btn primary">
        Enregistrer
      </button>

    </form>
  `);


  $(
    "#edit-subject-form"
  ).onsubmit = async event => {

    event.preventDefault();

    try {

      await updateRow(
        "subjects",
        subjectId,
        {
          name:
            $(
              "#edit-subject-name"
            )
              .value
              .trim(),

          icon:
            $(
              "#edit-subject-icon"
            ).value,

          color:
            $(
              "#edit-subject-color"
            ).value
        }
      );

      closeModal();

      await refreshData();

      toast(
        "Matière modifiée ✨"
      );

    } catch (error) {

      handleAuthError(error);

    }

  };

};


/* -----------------------------
   Delete subject
----------------------------- */

window.deleteSubject =
async function (subjectId) {

  const subject =
    getSubject(subjectId);

  if (!subject) {
    return;
  }

  const confirmed =
    confirm(
      `Supprimer la matière « ${
        subject.name
      } » et tous ses chapitres/cours ?`
    );

  if (!confirmed) {
    return;
  }

  try {

    /*
      Because the database uses
      ON DELETE CASCADE, related
      chapters/materials/revisions/
      flashcards are removed with it.
    */

    await deleteRow(
      "subjects",
      subjectId
    );

    await refreshData();

    toast(
      "Matière supprimée"
    );

  } catch (error) {

    handleAuthError(error);

  }

};


/* -----------------------------
   Open a subject
----------------------------- */

window.openSubjectMaterials =
function (subjectId) {

  activeSubjectId =
    subjectId;

  navigate(
    "materials"
  );

  setTimeout(
    () => {

      const select =
        $(
          "#material-subject-filter"
        );

      if (select) {

        select.value =
          subjectId;

      }

      renderMaterials();

    },
    0
  );

};


/* -----------------------------
   CHAPTERS
----------------------------- */

window.openAddChapter =
function (subjectId) {

  const subject =
    getSubject(subjectId);

  if (!subject) {
    return;
  }

  openModal(`

    <span class="eyebrow">
      ${escapeHTML(
        subject.name
      )}
    </span>


    <h2>
      Nouveau chapitre 📑
    </h2>


    <form
      id="new-chapter-form"
      class="form-stack"
    >

      <label>
        Nom du chapitre

        <input
          id="new-chapter-name"
          placeholder="Ex. Les fonctions"
          required
        >
      </label>


      <button
        type="submit"
        class="btn primary"
      >
        Créer le chapitre
      </button>

    </form>
  `);


  $(
    "#new-chapter-form"
  ).onsubmit = async event => {

    event.preventDefault();

    const name =
      $(
        "#new-chapter-name"
      )
        .value
        .trim();

    if (!name) {
      return;
    }

    try {

      const existing =
        getSubjectChapters(
          subjectId
        );

      await insertRow(
        "chapters",
        {
          user_id:
            session.user.id,

          subject_id:
            subjectId,

          name,

          position:
            existing.length
        }
      );

      closeModal();

      await refreshData();

      toast(
        "Chapitre créé 📑"
      );

    } catch (error) {

      handleAuthError(error);

    }

  };

};


/* -----------------------------
   Rename chapter
----------------------------- */

window.renameChapter =
async function (chapterId) {

  const chapter =
    getChapter(chapterId);

  if (!chapter) {
    return;
  }

  const name =
    prompt(
      "Nouveau nom du chapitre :",
      chapter.name
    );

  if (!name?.trim()) {
    return;
  }

  try {

    await updateRow(
      "chapters",
      chapterId,
      {
        name:
          name.trim()
      }
    );

    await refreshData();

    toast(
      "Chapitre modifié ✨"
    );

  } catch (error) {

    handleAuthError(error);

  }

};


/* -----------------------------
   Delete chapter
----------------------------- */

window.deleteChapter =
async function (chapterId) {

  const chapter =
    getChapter(chapterId);

  if (!chapter) {
    return;
  }

  if (
    !confirm(
      `Supprimer le chapitre « ${
        chapter.name
      } » ?`
    )
  ) {
    return;
  }

  try {

    await deleteRow(
      "chapters",
      chapterId
    );

    await refreshData();

    toast(
      "Chapitre supprimé"
    );

  } catch (error) {

    handleAuthError(error);

  }

};


/* -----------------------------
   Open chapter
----------------------------- */

window.openChapter =
function (chapterId) {

  const chapter =
    getChapter(chapterId);

  if (!chapter) {
    return;
  }

  activeChapterId =
    chapterId;

  const subject =
    getSubject(
      chapter.subject_id
    );

  const materials =
    getChapterMaterials(
      chapterId
    );

  openModal(`

    <span class="eyebrow">
      CHAPITRE
    </span>


    <h2>
      📑
      ${escapeHTML(
        chapter.name
      )}
    </h2>


    <p>
      ${
        subject
          ? `${subject.icon} ${escapeHTML(
              subject.name
            )}`
          : ""
      }
    </p>


    <div
      class="chapter-materials"
    >

      ${
        materials.length

          ? materials
              .map(
                material => `
                  <div
                    class="material-mini"
                  >

                    <span>
                      ${materialIcon(
                        material.kind
                      )}
                    </span>


                    <div>
                      <strong>
                        ${escapeHTML(
                          material.title
                        )}
                      </strong>

                      <small>
                        ${escapeHTML(
                          material.kind
                        )}
                        ·
                        ${masteryLabel(
                          calculateMastery(
                            material.id
                          )
                        )}
                      </small>
                    </div>


                    <button
                      class="small-button"
                      onclick="openMaterial(
                        '${material.id}'
                      )"
                    >
                      Ouvrir
                    </button>

                  </div>
                `
              )
              .join("")

          : `
            <div class="empty-state">
              Aucun cours dans ce chapitre.
            </div>
          `
      }

    </div>


    <button
      class="btn primary"
      onclick="
        closeModal();
        openAddMaterial(
          '${chapter.subject_id}',
          '${chapter.id}'
        );
      "
    >
      + Ajouter un cours
    </button>

  `);

};


/* -----------------------------
   MATERIALS
----------------------------- */

function renderMaterials() {

  const grid =
    $("#materials-grid");

  if (!grid) {
    return;
  }

  const selectedSubject =
    $(
      "#material-subject-filter"
    )?.value ||
    "all";

  const selectedType =
    $(
      "#material-type-filter"
    )?.value ||
    "all";

  const selectedChapter =
    $(
      "#material-chapter-filter"
    )?.value ||
    "all";

  const search =
    (
      $(
        "#material-search"
      )?.value || ""
    )
      .trim()
      .toLowerCase();


  /*
    Populate subject filter.
  */

  const subjectFilter =
    $(
      "#material-subject-filter"
    );

  if (subjectFilter) {

    subjectFilter.innerHTML = `
      <option value="all">
        Toutes les matières
      </option>

      ${DATA.subjects
        .map(
          subject => `
            <option
              value="${subject.id}"
            >
              ${subject.icon}
              ${escapeHTML(
                subject.name
              )}
            </option>
          `
        )
        .join("")}
    `;

    if (
      DATA.subjects.some(
        subject =>
          subject.id ===
          selectedSubject
      )
    ) {

      subjectFilter.value =
        selectedSubject;

    } else {

      subjectFilter.value =
        "all";

    }

  }


  const currentSubject =
    subjectFilter?.value ||
    "all";


  /*
    Populate chapter filter.
  */

  const chapterFilter =
    $(
      "#material-chapter-filter"
    );

  if (chapterFilter) {

    const chapters =
      DATA.chapters.filter(
        chapter =>
          currentSubject === "all" ||
          chapter.subject_id ===
            currentSubject
      );

    chapterFilter.innerHTML = `
      <option value="all">
        Tous les chapitres
      </option>

      ${chapters
        .map(
          chapter => `
            <option
              value="${chapter.id}"
            >
              📑
              ${escapeHTML(
                chapter.name
              )}
            </option>
          `
        )
        .join("")}
    `;

    if (
      chapters.some(
        chapter =>
          chapter.id ===
          selectedChapter
      )
    ) {

      chapterFilter.value =
        selectedChapter;

    } else {

      chapterFilter.value =
        "all";

    }

  }


  const currentChapter =
    chapterFilter?.value ||
    "all";


  /*
    Filter materials.
  */

  const materials =
    DATA.materials.filter(
      material => {

        const matchesSubject =
          currentSubject ===
            "all" ||
          material.subject_id ===
            currentSubject;

        const matchesType =
          selectedType ===
            "all" ||
          material.kind ===
            selectedType;

        const matchesChapter =
          currentChapter ===
            "all" ||
          material.chapter_id ===
            currentChapter;

        const searchableText = (
          `${material.title} ${
            material.raw_text || ""
          } ${
            material.notes || ""
          } ${
            material.file_name || ""
          }`
        ).toLowerCase();

        const matchesSearch =
          !search ||
          searchableText.includes(
            search
          );

        return (
          matchesSubject &&
          matchesType &&
          matchesChapter &&
          matchesSearch
        );

      }
    );


  if (!materials.length) {

    grid.innerHTML = `
      <div class="empty-state">

        <div style="font-size:45px">
          📖
        </div>

        <strong>
          Aucun cours trouvé
        </strong>

        <span>
          Ajoute ton premier cours,
          une photo, un PDF,
          un document ou un lien.
        </span>

      </div>
    `;

    return;
  }


  grid.innerHTML =
    materials
      .map(
        material => {

          const score =
            calculateMastery(
              material.id
            );

          const cards =
            DATA.flashcards.filter(
              card =>
                card.material_id ===
                material.id
            ).length;

          const nextRevision =
            DATA.revisions.find(
              revision =>
                revision.material_id ===
                  material.id &&
                !revision.completed
            );

          return `
            <article
              class="material-card"
            >

              <div
                class="material-icon"
              >
                ${materialIcon(
                  material.kind
                )}
              </div>


              <div
                class="material-card-top"
              >

                <span class="pill">
                  ${escapeHTML(
                    material.kind
                  )}
                </span>

                ${
                  nextRevision

                    ? `
                      <span class="pill">
                        Révision
                        ${nextRevision.revision_number}/4
                      </span>
                    `

                    : `
                      <span class="pill success-pill">
                        À jour
                      </span>
                    `
                }

              </div>


              <h3>
                ${escapeHTML(
                  material.title
                )}
              </h3>


              <p>
                ${
                  getSubject(
                    material.subject_id
                  )?.icon || "📚"
                }

                ${
                  escapeHTML(
                    getSubject(
                      material.subject_id
                    )?.name || ""
                  )
                }

                ·

                ${
                  escapeHTML(
                    getChapter(
                      material.chapter_id
                    )?.name || ""
                  )
                }
              </p>


              <div class="material-meta">

                <span>
                  ${
                    (
                      material.raw_text ||
                      material.notes ||
                      ""
                    ).length
                  }
                  caractères
                </span>

                <span>
                  ${cards} 🃏
                </span>

              </div>


              ${masteryRow(
                masteryLabel(score),
                score
              )}


              <div
                class="material-actions"
              >

                <button
                  class="small-button"
                  onclick="openMaterial(
                    '${material.id}'
                  )"
                >
                  Ouvrir
                </button>


                <button
                  class="small-button"
                  onclick="openStudyAIForMaterial(
                    '${material.id}'
                  )"
                >
                  ✨ AI
                </button>


                <button
                  class="small-button"
                  onclick="startMaterialFlashcards(
                    '${material.id}'
                  )"
                >
                  🃏
                </button>


                <button
                  class="small-button"
                  onclick="startMaterialQuiz(
                    '${material.id}'
                  )"
                >
                  ❓
                </button>


                <button
                  class="small-button"
                  onclick="editMaterial(
                    '${material.id}'
                  )"
                >
                  ✎
                </button>


                <button
                  class="small-button"
                  onclick="deleteMaterial(
                    '${material.id}'
                  )"
                >
                  ×
                </button>

              </div>

            </article>
          `;

        }
      )
      .join("");
}


/* -----------------------------
   Render revision helper
----------------------------- */

function completedRevisionCount(
  materialId
) {

  return DATA.revisions.filter(
    revision =>
      revision.material_id ===
        materialId &&
      revision.completed
  ).length;

}


/* -----------------------------
   Safe material mastery
----------------------------- */

function getMaterialMastery(
  materialId
) {

  const material =
    getMaterial(materialId);

  if (!material) {
    return 0;
  }

  return calculateMastery(
    materialId
  );

}


/* -----------------------------
   Empty generic rendering
----------------------------- */

function renderIfMissing(
  selector,
  html
) {

  const element =
    $(selector);

  if (
    element &&
    !element.innerHTML.trim()
  ) {

    element.innerHTML =
      html;

  }

}
/* =========================================================
   PART 4 — MATERIAL IMPORTS
   PDF / WORD / POWERPOINT / PHOTO / YOUTUBE
   SUPABASE STORAGE
   ========================================================= */


/* ---------------------------------------------------------
   MODAL COMPATIBILITY
   --------------------------------------------------------- */

/*
  Your index.html uses:

    #modal-overlay
    #modal-content

  So we redefine the earlier modal helper
  using those exact IDs.
*/

function openModal(content) {

  const overlay =
    $("#modal-overlay");

  const container =
    $("#modal-content");

  if (
    !overlay ||
    !container
  ) {
    console.error(
      "Modal elements are missing."
    );

    return;
  }

  container.innerHTML = `
    <button
      id="modal-close"
      class="modal-x"
      type="button"
      aria-label="Fermer"
    >
      ×
    </button>

    ${content}
  `;

  overlay.classList.remove(
    "hidden"
  );

  const closeButton =
    $("#modal-close");

  if (closeButton) {
    closeButton.onclick =
      closeModal;
  }

}


/*
  Close modal.
*/

function closeModal() {

  const overlay =
    $("#modal-overlay");

  if (!overlay) {
    return;
  }

  overlay.classList.add(
    "hidden"
  );

}


/*
  Make closeModal globally accessible
  to buttons created dynamically.
*/

window.closeModal =
  closeModal;


/* ---------------------------------------------------------
   MATERIAL TYPE ICON
   --------------------------------------------------------- */

function materialIcon(kind) {

  const icons = {

    notes: "📝",

    pdf: "📄",

    docx: "📘",

    pptx: "📊",

    image: "📸",

    youtube: "▶️"

  };

  return (
    icons[kind] ||
    "📖"
  );

}


/* ---------------------------------------------------------
   ADD MATERIAL MODAL
   --------------------------------------------------------- */

window.openAddMaterial =
async function (
  subjectId = "",
  chapterId = ""
) {

  /*
    A course needs at least one subject.
  */

  if (
    DATA.subjects.length === 0
  ) {

    toast(
      "Crée d'abord une matière.",
      "warning"
    );

    navigate(
      "subjects"
    );

    return;

  }


  /*
    If a subject was not provided,
    use the first one.
  */

  const selectedSubject =
    subjectId ||
    DATA.subjects[0].id;


  /*
    Chapters belonging to the selected subject.
  */

  const chapters =
    DATA.chapters.filter(
      chapter =>
        chapter.subject_id ===
        selectedSubject
    );


  openModal(`

    <span class="eyebrow">
      NOUVELLE RESSOURCE
    </span>


    <h2>
      Ajouter un cours 📚
    </h2>


    <p>
      Tu peux coller tes notes,
      importer un document,
      photographier une feuille
      ou ajouter une vidéo YouTube.
    </p>


    <form
      id="material-form"
      class="form-stack"
    >

      <label>
        Titre du cours

        <input
          id="material-title"
          type="text"
          placeholder="Ex. Chapitre 3 — Fonctions"
          required
        >

      </label>


      <div class="two">

        <label>
          Matière

          <select
            id="material-subject"
          >

            ${DATA.subjects
              .map(
                subject => `
                  <option
                    value="${subject.id}"
                    ${
                      subject.id ===
                      selectedSubject
                        ? "selected"
                        : ""
                    }
                  >

                    ${escapeHTML(
                      subject.icon
                    )}

                    ${escapeHTML(
                      subject.name
                    )}

                  </option>
                `
              )
              .join("")}

          </select>

        </label>


        <label>
          Chapitre

          <select
            id="material-chapter"
          >

            ${
              chapters.length

                ? chapters
                    .map(
                      chapter => `
                        <option
                          value="${chapter.id}"
                          ${
                            chapter.id ===
                            chapterId
                              ? "selected"
                              : ""
                          }
                        >
                          📑
                          ${escapeHTML(
                            chapter.name
                          )}
                        </option>
                      `
                    )
                    .join("")

                : `
                  <option value="">
                    Général
                  </option>
                `
            }

          </select>

        </label>

      </div>


      <div>

        <span class="field-label">
          Type de ressource
        </span>


        <div
          id="material-type-buttons"
          class="source-tabs"
        >

          <button
            type="button"
            class="active"
            data-kind="notes"
          >
            📝 Notes
          </button>


          <button
            type="button"
            data-kind="pdf"
          >
            📄 PDF
          </button>


          <button
            type="button"
            data-kind="docx"
          >
            📘 Word
          </button>


          <button
            type="button"
            data-kind="pptx"
          >
            📊 PowerPoint
          </button>


          <button
            type="button"
            data-kind="image"
          >
            📸 Photo
          </button>


          <button
            type="button"
            data-kind="youtube"
          >
            ▶️ YouTube
          </button>

        </div>

      </div>


      <input
        id="material-kind"
        type="hidden"
        value="notes"
      >


      <div
        id="material-file-section"
      >

        <label>

          Fichier

          <input
            id="material-file"
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md,.csv,image/*"
          >

        </label>


        <div
          id="material-file-status"
          class="helper-text"
        >
          PDF, Word, PowerPoint,
          texte ou photo.
        </div>

      </div>


      <div
        id="material-youtube-section"
        class="hidden"
      >

        <label>

          Lien YouTube

          <input
            id="material-youtube-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
          >

        </label>


        <p class="helper-text">
          Tu peux ensuite ajouter
          ou coller la transcription
          dans les notes.
        </p>

      </div>


      <label>

        Notes / transcription

        <textarea
          id="material-text"
          rows="12"
          placeholder="Colle ton cours ici..."
        ></textarea>

      </label>


      <div
        id="material-preview"
        class="material-preview hidden"
      ></div>


      <label
        class="check-row"
      >

        <input
          id="material-auto-revisions"
          type="checkbox"
          checked
        >

        <span>
          Programmer les révisions
          2 · 3 · 5 · 7 jours
        </span>

      </label>


      <label
        class="check-row"
      >

        <input
          id="material-auto-flashcards"
          type="checkbox"
          checked
        >

        <span>
          Préparer automatiquement
          des premières flashcards
        </span>

      </label>


      <button
        type="submit"
        class="btn primary full"
      >
        Enregistrer le cours ✨
      </button>

    </form>

  `);


  /*
    Change type.
  */

  const typeButtons =
    $$(
      "#material-type-buttons button"
    );

  typeButtons.forEach(
    button => {

      button.onclick =
      () => {

        typeButtons.forEach(
          item =>
            item.classList.remove(
              "active"
            )
        );

        button.classList.add(
          "active"
        );

        const kind =
          button.dataset.kind;

        $(
          "#material-kind"
        ).value =
          kind;


        /*
          YouTube uses a URL,
          other types use a file.
        */

        const fileSection =
          $(
            "#material-file-section"
          );

        const youtubeSection =
          $(
            "#material-youtube-section"
          );

        if (
          kind ===
          "youtube"
        ) {

          fileSection.classList.add(
            "hidden"
          );

          youtubeSection.classList.remove(
            "hidden"
          );

        } else {

          fileSection.classList.remove(
            "hidden"
          );

          youtubeSection.classList.add(
            "hidden"
          );

        }

      };

    }
  );


  /*
    Change chapters when
    the student changes subject.
  */

  $(
    "#material-subject"
  ).onchange =
  () => {

    const newSubjectId =
      $(
        "#material-subject"
      ).value;

    const subjectChapters =
      DATA.chapters.filter(
        chapter =>
          chapter.subject_id ===
          newSubjectId
      );

    $(
      "#material-chapter"
    ).innerHTML =
      subjectChapters.length

        ? subjectChapters
            .map(
              chapter => `
                <option
                  value="${chapter.id}"
                >
                  📑
                  ${escapeHTML(
                    chapter.name
                  )}
                </option>
              `
            )
            .join("")

        : `
          <option value="">
            Général
          </option>
        `;

  };


  /*
    File processing.
  */

  $(
    "#material-file"
  ).onchange =
    handleMaterialFile;


  /*
    Save course.
  */

  $(
    "#material-form"
  ).onsubmit =
    saveMaterial;

};


/* ---------------------------------------------------------
   HANDLE MATERIAL FILE
   --------------------------------------------------------- */

async function handleMaterialFile() {

  const input =
    $("#material-file");

  const file =
    input?.files?.[0];

  if (!file) {
    return;
  }


  const status =
    $("#material-file-status");

  const title =
    $("#material-title");

  const textArea =
    $("#material-text");

  if (status) {

    status.textContent =
      `Lecture de ${file.name}…`;

  }


  /*
    Automatically determine type.
  */

  const fileName =
    file.name.toLowerCase();


  if (
    file.type ===
      "application/pdf" ||
    fileName.endsWith(
      ".pdf"
    )
  ) {

    $(
      "#material-kind"
    ).value =
      "pdf";

  }


  else if (
    fileName.endsWith(
      ".docx"
    )
  ) {

    $(
      "#material-kind"
    ).value =
      "docx";

  }


  else if (
    fileName.endsWith(
      ".pptx"
    )
  ) {

    $(
      "#material-kind"
    ).value =
      "pptx";

  }


  else if (
    file.type.startsWith(
      "image/"
    )
  ) {

    $(
      "#material-kind"
    ).value =
      "image";

  }


  try {

    let extractedText =
      "";


    /*
      PDF
    */

    if (
      file.type ===
        "application/pdf" ||
      fileName.endsWith(
        ".pdf"
      )
    ) {

      extractedText =
        await extractPDFText(
          file
        );

    }


    /*
      Word
    */

    else if (
      fileName.endsWith(
        ".docx"
      )
    ) {

      extractedText =
        await extractDOCXText(
          file
        );

    }


    /*
      PowerPoint
    */

    else if (
      fileName.endsWith(
        ".pptx"
      )
    ) {

      extractedText =
        await extractPPTXText(
          file
        );

    }


    /*
      Image / photo
    */

    else if (
      file.type.startsWith(
        "image/"
      )
    ) {

      extractedText =
        await extractImageText(
          file
        );

    }


    /*
      Plain text files.
    */

    else {

      extractedText =
        await file.text();

    }


    /*
      Put extracted text in textarea.
    */

    if (textArea) {

      textArea.value =
        extractedText.trim();

    }


    /*
      Automatic title.
    */

    if (
      title &&
      !title.value.trim()
    ) {

      title.value =
        file.name
          .replace(
            /\.[^.]+$/,
            ""
          )
          .replace(
            /[_-]+/g,
            " "
          );

    }


    /*
      Show result.
    */

    if (status) {

      status.textContent =
        extractedText.trim()

          ? `✅ Texte récupéré depuis ${file.name}`

          : `⚠️ Aucun texte détecté automatiquement.`;

    }


    /*
      Show a small preview.
    */

    showMaterialExtractionPreview(
      extractedText
    );


  } catch (error) {

    console.error(
      "Material extraction error:",
      error
    );


    if (status) {

      status.textContent =
        "⚠️ Impossible de récupérer automatiquement le texte.";

    }


    toast(
      "Tu peux quand même coller le contenu manuellement.",
      "warning"
    );

  }

}


/* ---------------------------------------------------------
   PDF EXTRACTION
   --------------------------------------------------------- */

async function extractPDFText(
  file
) {

  if (
    typeof pdfjsLib ===
    "undefined"
  ) {

    throw new Error(
      "PDF.js not loaded."
    );

  }


  const buffer =
    await file.arrayBuffer();


  const pdf =
    await pdfjsLib
      .getDocument({
        data: buffer
      })
      .promise;


  let fullText =
    "";


  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {

    const page =
      await pdf.getPage(
        pageNumber
      );


    const content =
      await page.getTextContent();


    const pageText =
      content.items
        .map(
          item =>
            item.str || ""
        )
        .join(" ");


    fullText +=
      `\n\n--- Page ${pageNumber} ---\n\n${pageText}`;

  }


  return fullText.trim();

}


/* ---------------------------------------------------------
   DOCX EXTRACTION
   --------------------------------------------------------- */

async function extractDOCXText(
  file
) {

  if (
    typeof JSZip ===
    "undefined"
  ) {

    throw new Error(
      "JSZip not loaded."
    );

  }


  const zip =
    await JSZip.loadAsync(
      await file.arrayBuffer()
    );


  const xmlFile =
    zip.file(
      "word/document.xml"
    );


  if (!xmlFile) {

    throw new Error(
      "Word document XML not found."
    );

  }


  const xml =
    await xmlFile.async(
      "text"
    );


  const parser =
    new DOMParser();


  const documentXml =
    parser.parseFromString(
      xml,
      "application/xml"
    );


  const textNodes =
    [
      ...documentXml
        .getElementsByTagName(
          "w:t"
        )
    ];


  return textNodes
    .map(
      node =>
        node.textContent || ""
    )
    .join(" ")
    .trim();

}


/* ---------------------------------------------------------
   PPTX EXTRACTION
   --------------------------------------------------------- */

async function extractPPTXText(
  file
) {

  if (
    typeof JSZip ===
    "undefined"
  ) {

    throw new Error(
      "JSZip not loaded."
    );

  }


  const zip =
    await JSZip.loadAsync(
      await file.arrayBuffer()
    );


  const slideFiles =
    Object.keys(
      zip.files
    )
      .filter(
        path =>
          /^ppt\/slides\/slide\d+\.xml$/
            .test(path)
      )
      .sort(
        (a,b) =>
          a.localeCompare(
            b,
            undefined,
            {
              numeric:true
            }
          )
      );


  let result =
    "";


  for (
    const path of slideFiles
  ) {

    const xml =
      await zip
        .file(path)
        .async("text");


    const documentXml =
      new DOMParser()
        .parseFromString(
          xml,
          "application/xml"
        );


    const nodes =
      [
        ...documentXml
          .getElementsByTagName(
            "a:t"
          )
      ];


    const slideText =
      nodes
        .map(
          node =>
            node.textContent || ""
        )
        .join(" ");


    result +=
      `\n\n--- Slide ---\n\n${slideText}`;

  }


  return result.trim();

}


/* ---------------------------------------------------------
   PHOTO OCR
   --------------------------------------------------------- */

async function extractImageText(
  file
) {

  if (
    typeof Tesseract ===
    "undefined"
  ) {

    throw new Error(
      "Tesseract.js not loaded."
    );

  }


  /*
    OCR in French.
    For a real production version,
    we can later add automatic
    language detection.
  */

  const result =
    await Tesseract.recognize(
      file,
      "fra",
      {
        logger:
          progress => {

            if (
              progress.status ===
              "recognizing text"
            ) {

              const percent =
                Math.round(
                  (
                    progress.progress ||
                    0
                  ) *
                  100
                );

              const status =
                $("#material-file-status");

              if (status) {

                status.textContent =
                  `📸 Lecture de l'image… ${percent}%`;

              }

            }

          }
      }
    );


  return (
    result?.data?.text ||
    ""
  ).trim();

}


/* ---------------------------------------------------------
   EXTRACTION PREVIEW
   --------------------------------------------------------- */

function showMaterialExtractionPreview(
  text
) {

  const preview =
    $("#material-preview");

  if (!preview) {
    return;
  }


  const clean =
    String(text || "")
      .trim();


  if (!clean) {

    preview.classList.add(
      "hidden"
    );

    preview.innerHTML =
      "";

    return;

  }


  const shortPreview =
    clean.length > 800

      ? clean.slice(
          0,
          800
        ) +
        "…"

      : clean;


  preview.classList.remove(
    "hidden"
  );


  preview.innerHTML = `

    <strong>
      Aperçu du texte récupéré
    </strong>

    <p>
      ${escapeHTML(
        shortPreview
      ).replace(
        /\n/g,
        "<br>"
      )}
    </p>

  `;

}


/* ---------------------------------------------------------
   SAVE MATERIAL
   --------------------------------------------------------- */

async function saveMaterial(
  event
) {

  event.preventDefault();


  if (
    !session?.user
  ) {

    return;

  }


  const title =
    $(
      "#material-title"
    )
      .value
      .trim();


  const subjectId =
    $(
      "#material-subject"
    )
      .value;


  const chapterId =
    $(
      "#material-chapter"
    )
      .value ||
    null;


  const kind =
    $(
      "#material-kind"
    )
      .value ||
    "notes";


  const text =
    $(
      "#material-text"
    )
      .value
      .trim();


  const youtubeUrl =
    $(
      "#material-youtube-url"
    )?.value
      ?.trim() ||
    null;


  const file =
    $(
      "#material-file"
    )?.files?.[0] ||
    null;


  if (!title) {

    toast(
      "Ajoute un titre.",
      "warning"
    );

    return;

  }


  if (
    !text &&
    kind !==
    "youtube"
  ) {

    toast(
      "Ajoute du contenu ou importe un fichier.",
      "warning"
    );

    return;

  }


  if (
    kind ===
      "youtube" &&
    !youtubeUrl &&
    !text
  ) {

    toast(
      "Ajoute un lien YouTube ou sa transcription.",
      "warning"
    );

    return;

  }


  /*
    Disable button while saving.
  */

  const submitButton =
    $(
      "#material-form button[type='submit']"
    );


  if (submitButton) {

    submitButton.disabled =
      true;

    submitButton.textContent =
      "Enregistrement…";

  }


  try {

    /*
      1. Create database row.
    */

    const material =
      await insertRow(
        "materials",
        {

          user_id:
            session.user.id,

          subject_id:
            subjectId,

          chapter_id:
            chapterId,

          title:
            title,

          kind:
            kind,

          source_url:
            youtubeUrl,

          file_name:
            file?.name ||
            null,

          raw_text:
            text,

          notes:
            text

        }
      );


    /*
      2. Upload original file
         to Supabase Storage.
    */

    if (file) {

      /*
        Use the authenticated
        user's UUID as the first
        folder.
      */

      const safeName =
        file.name
          .replace(
            /[^\w.\- ]/g,
            "_"
          );


      const storagePath =
        `${session.user.id}/${material.id}/${safeName}`;


      const {
        error:
          uploadError
      } =
        await supabaseClient
          .storage
          .from(
            "study-files"
          )
          .upload(
            storagePath,
            file,
            {
              upsert:
                true
            }
          );


      if (
        uploadError
      ) {

        /*
          Delete the database row
          if the file upload failed.
        */

        try {

          await deleteRow(
            "materials",
            material.id
          );

        } catch {}

        throw uploadError;

      }


      /*
        3. Save storage path
           in material.
      */

      await updateRow(
        "materials",
        material.id,
        {
          storage_path:
            storagePath
        }
      );

    }


    /*
      4. Create spaced revisions.
    */

    if (
      $(
        "#material-auto-revisions"
      ).checked
    ) {

      await createRevisionSchedule(
        material.id
      );

    }


    /*
      5. Create some local/basic
         flashcards immediately.

      Lili can later replace/
      improve them with proper AI cards.
    */

    if (
      $(
        "#material-auto-flashcards"
      ).checked &&
      text
    ) {

      await createBasicFlashcards(
        material.id,
        text
      );

    }


    /*
      6. Close and refresh.
    */

    closeModal();

    await refreshData();

    toast(
      "Cours ajouté à ta bibliothèque 📚"
    );


  } catch (error) {

    handleAuthError(
      error
    );


  } finally {

    if (submitButton) {

      submitButton.disabled =
        false;

      submitButton.textContent =
        "Enregistrer le cours ✨";

    }

  }

}


/* ---------------------------------------------------------
   REVISION SCHEDULE
   --------------------------------------------------------- */

async function createRevisionSchedule(
  materialId
) {

  /*
    Create 2, 3, 5 and 7 day revisions.
  */

  for (
    let index = 0;
    index <
    REVISION_DELAYS.length;
    index++
  ) {

    const delay =
      REVISION_DELAYS[
        index
      ];


    await insertRow(
      "revisions",
      {

        user_id:
          session.user.id,

        material_id:
          materialId,

        revision_number:
          index + 1,

        scheduled_date:
          addDays(
            today(),
            delay
          ),

        completed:
          false

      }
    );

  }

}


/* ---------------------------------------------------------
   BASIC FLASHCARDS
   --------------------------------------------------------- */

async function createBasicFlashcards(
  materialId,
  text
) {

  const lines =
    text
      .split(
        /\n+/
      )
      .map(
        line =>
          line
            .replace(
              /^[-•*]\s*/,
              ""
            )
            .trim()
      )
      .filter(
        line =>
          line.length >= 25
      )
      .slice(
        0,
        6
      );


  /*
    Don't create duplicates
    every time.
  */

  const existingCards =
    DATA.flashcards.filter(
      card =>
        card.material_id ===
        materialId
    );


  if (
    existingCards.length
  ) {

    return;

  }


  for (
    const line of lines
  ) {

    const words =
      line
        .split(
          /\s+/
        )
        .filter(
          word =>
            word.length >= 5
        );


    if (
      !words.length
    ) {

      continue;

    }


    const candidate =
      words[
        Math.floor(
          words.length /
          2
        )
      ]
        .replace(
          /[^\p{L}\p{N}-]/gu,
          ""
        );


    if (
      !candidate
    ) {

      continue;

    }


    const escapedCandidate =
      candidate.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );


    const question =
      line.replace(
        new RegExp(
          escapedCandidate,
          "i"
        ),
        "____"
      );


    try {

      await insertRow(
        "flashcards",
        {

          user_id:
            session.user.id,

          material_id:
            materialId,

          front:
            `Complète : ${question}`,

          back:
            candidate,

          box:
            1,

          due_date:
            today()

        }
      );

    } catch (error) {

      /*
        If one card fails,
        don't destroy the whole
        course creation process.
      */

      console.warn(
        "Flashcard creation failed:",
        error
      );

    }

  }

}


/* ---------------------------------------------------------
   OPEN MATERIAL
   --------------------------------------------------------- */

window.openMaterial =
function (materialId) {

  const material =
    getMaterial(
      materialId
    );

  if (!material) {

    return;

  }


  activeMaterialId =
    materialId;


  const subject =
    getSubject(
      material.subject_id
    );


  const chapter =
    getChapter(
      material.chapter_id
    );


  const mastery =
    calculateMastery(
      materialId
    );


  const cards =
    DATA.flashcards.filter(
      card =>
        card.material_id ===
        materialId
    );


  const nextRevision =
    DATA.revisions
      .filter(
        revision =>
          revision.material_id ===
            materialId &&
          !revision.completed
      )
      .sort(
        (a,b) =>
          a.scheduled_date.localeCompare(
            b.scheduled_date
          )
      )[0];


  openModal(`

    <span class="eyebrow">
      ${materialIcon(
        material.kind
      )}
      ${escapeHTML(
        material.kind
      )}
    </span>


    <h2>
      ${escapeHTML(
        material.title
      )}
    </h2>


    <p>

      ${
        subject
          ? `
            ${subject.icon}
            ${escapeHTML(
              subject.name
            )}
          `
          : ""
      }


      ${
        chapter
          ? `
            · 📑
            ${escapeHTML(
              chapter.name
            )}
          `
          : ""
      }

    </p>


    ${masteryRow(
      masteryLabel(
        mastery
      ),
      mastery
    )}


    <div
      class="material-content"
    >

      ${
        escapeHTML(
          material.notes ||
          material.raw_text ||
          ""
        )
          .replace(
            /\n/g,
            "<br>"
          )
      }


      ${
        material.source_url
          ? `
            <hr>

            <p>
              <a
                href="${escapeHTML(
                  material.source_url
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                ▶️ Ouvrir YouTube
              </a>
            </p>
          `
          : ""
      }

    </div>


    <div
      class="modal-actions"
    >

      <button
        class="btn primary"
        onclick="
          openStudyAIForMaterial(
            '${material.id}'
          );
          closeModal();
        "
      >
        ✨ Avec Lili
      </button>


      <button
        class="btn soft"
        onclick="
          startMaterialFlashcards(
            '${material.id}'
          );
          closeModal();
        "
      >
        🃏 Flashcards
        (${cards.length})
      </button>


      <button
        class="btn soft"
        onclick="
          startMaterialQuiz(
            '${material.id}'
          );
          closeModal();
        "
      >
        ❓ Quiz
      </button>


      ${
        nextRevision
          ? `
            <button
              class="btn soft"
              onclick="
                startRevision(
                  '${nextRevision.id}'
                );
                closeModal();
              "
            >
              🔄 Réviser
            </button>
          `
          : ""
      }


      ${
        material.storage_path
          ? `
            <button
              class="btn soft"
              onclick="
                downloadMaterialFile(
                  '${material.id}'
                );
              "
            >
              📥 Fichier original
            </button>
          `
          : ""
      }


      <button
        class="btn soft"
        onclick="
          editMaterial(
            '${material.id}'
          );
        "
      >
        ✎ Modifier
      </button>

    </div>

  `);

};


/* ---------------------------------------------------------
   DOWNLOAD ORIGINAL MATERIAL
   --------------------------------------------------------- */

window.downloadMaterialFile =
async function (
  materialId
) {

  const material =
    getMaterial(
      materialId
    );

  if (
    !material ||
    !material.storage_path
  ) {

    toast(
      "Aucun fichier original.",
      "warning"
    );

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from(
          "study-files"
        )
        .download(
          material.storage_path
        );


    if (error) {
      throw error;
    }


    const url =
      URL.createObjectURL(
        data
      );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    link.download =
      material.file_name ||
      "study-planner-file";


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1000
    );


  } catch (error) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   EDIT MATERIAL
   --------------------------------------------------------- */

window.editMaterial =
function (materialId) {

  const material =
    getMaterial(
      materialId
    );

  if (!material) {
    return;
  }


  openModal(`

    <span class="eyebrow">
      MODIFIER LE COURS
    </span>


    <h2>
      ${escapeHTML(
        material.title
      )}
    </h2>


    <form
      id="edit-material-form"
      class="form-stack"
    >

      <label>

        Titre

        <input
          id="edit-material-title"
          value="${escapeHTML(
            material.title
          )}"
          required
        >

      </label>


      <label>

        Contenu

        <textarea
          id="edit-material-text"
          rows="16"
        >${escapeHTML(
          material.notes ||
          material.raw_text ||
          ""
        )}</textarea>

      </label>


      <button
        class="btn primary"
        type="submit"
      >
        Enregistrer
      </button>

    </form>

  `);


  $(
    "#edit-material-form"
  ).onsubmit =
  async event => {

    event.preventDefault();


    const newTitle =
      $(
        "#edit-material-title"
      )
        .value
        .trim();


    const newText =
      $(
        "#edit-material-text"
      )
        .value;


    if (!newTitle) {

      toast(
        "Le titre ne peut pas être vide.",
        "warning"
      );

      return;

    }


    try {

      await updateRow(
        "materials",
        materialId,
        {

          title:
            newTitle,

          raw_text:
            newText,

          notes:
            newText,

          updated_at:
            new Date()
              .toISOString()

        }
      );


      closeModal();

      await refreshData();

      toast(
        "Cours modifié ✨"
      );


    } catch (error) {

      handleAuthError(
        error
      );

    }

  };

};


/* ---------------------------------------------------------
   DELETE MATERIAL
   --------------------------------------------------------- */

window.deleteMaterial =
async function (
  materialId
) {

  const material =
    getMaterial(
      materialId
    );

  if (!material) {
    return;
  }


  const confirmed =
    confirm(
      `Supprimer « ${
        material.title
      } » ?`
    );


  if (!confirmed) {
    return;
  }


  try {

    /*
      Remove uploaded file first.
    */

    if (
      material.storage_path
    ) {

      const {
        error:
          storageError
      } =
        await supabaseClient
          .storage
          .from(
            "study-files"
          )
          .remove([
            material.storage_path
          ]);


      if (storageError) {

        console.warn(
          "Storage deletion failed:",
          storageError
        );

      }

    }


    /*
      Database cascade removes
      revisions and flashcards.
    */

    await deleteRow(
      "materials",
      materialId
    );


    await refreshData();

    toast(
      "Cours supprimé"
    );


  } catch (error) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   CREATE A CHAPTER AUTOMATICALLY
   IF A MATERIAL HAS NONE
   --------------------------------------------------------- */

async function ensureMaterialChapter(
  subjectId
) {

  let chapter =
    DATA.chapters.find(
      item =>
        item.subject_id ===
          subjectId &&
        item.name ===
          "Général"
    );


  if (chapter) {
    return chapter;
  }


  chapter =
    await insertRow(
      "chapters",
      {

        user_id:
          session.user.id,

        subject_id:
          subjectId,

        name:
          "Général",

        position:
          0

      }
    );


  return chapter;

}
/* =========================================================
   PART 5 — DASHBOARD + REVISIONS + CALENDAR + TO-DO
   ========================================================= */


/* ---------------------------------------------------------
   MATERIAL ICON HELPER
   --------------------------------------------------------- */

function materialIcon(kind) {

  const icons = {
    notes: "📝",
    pdf: "📄",
    docx: "📘",
    pptx: "📊",
    image: "📸",
    youtube: "▶️"
  };

  return (
    icons[kind] ||
    "📖"
  );

}


/* ---------------------------------------------------------
   MASTERY DISPLAY
   --------------------------------------------------------- */

function masteryRow(
  label,
  score
) {

  return `
    <div class="mastery-row">

      <div>

        <span>
          ${escapeHTML(
            label
          )}
        </span>

        <span>
          ${score}%
        </span>

      </div>


      <div class="mastery-bar">

        <div
          style="
            width:${score}%;
          "
        ></div>

      </div>

    </div>
  `;

}


/* ---------------------------------------------------------
   DATE HELPERS
   --------------------------------------------------------- */

function formatDate(
  dateString
) {

  if (!dateString) {
    return "";
  }

  const date =
    new Date(
      `${dateString}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return dateString;

  }

  return `
    ${String(
      date.getDate()
    ).padStart(2, "0")}/
    ${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/
    ${date.getFullYear()}
  `;
}


function formatLongDate(
  dateString
) {

  if (!dateString) {
    return "";
  }

  const date =
    new Date(
      `${dateString}T12:00:00`
    );

  return `
    ${date.getDate()}
    ${MONTHS[
      date.getMonth()
    ]}
    ${date.getFullYear()}
  `;

}


/* ---------------------------------------------------------
   STREAK
   --------------------------------------------------------- */

function calculateStreak() {

  const activeDates =
    new Set();


  /*
    Completed revisions.
  */

  DATA.revisions
    .filter(
      revision =>
        revision.completed &&
        revision.completed_at
    )
    .forEach(
      revision =>
        activeDates.add(
          revision.completed_at
            .slice(0, 10)
        )
    );


  /*
    Completed tasks.
  */

  DATA.tasks
    .filter(
      task =>
        task.completed &&
        task.completed_at
    )
    .forEach(
      task =>
        activeDates.add(
          task.completed_at
            .slice(0, 10)
        )
    );


  /*
    Quiz activity.
  */

  DATA.quizAttempts
    .filter(
      quiz =>
        quiz.created_at
    )
    .forEach(
      quiz =>
        activeDates.add(
          quiz.created_at
            .slice(0, 10)
        )
    );


  let currentDate =
    new Date(
      `${today()}T12:00:00`
    );


  let streak = 0;


  while (
    activeDates.has(
      currentDate
        .toISOString()
        .slice(0, 10)
    )
  ) {

    streak++;

    currentDate.setDate(
      currentDate.getDate() - 1
    );

  }


  return streak;

}


/* ---------------------------------------------------------
   DASHBOARD
   --------------------------------------------------------- */

function renderDashboard() {

  if (!profile) {
    return;
  }


  const displayName =
    profile.display_name ||
    profile.first_name ||
    "Élève";


  /*
    Greeting.
  */

  const greeting =
    $("#dashboard-greeting");

  if (greeting) {

    greeting.textContent =
      `Bonjour ${displayName} 🌸`;

  }


  /*
    Main statistics.
  */

  const subjectCount =
    $("#dashboard-subject-count");

  const revisionCount =
    $("#dashboard-revision-count");

  const xpElement =
    $("#dashboard-xp");

  const streakElement =
    $("#dashboard-streak");


  if (subjectCount) {

    subjectCount.textContent =
      DATA.subjects.length;

  }


  if (revisionCount) {

    revisionCount.textContent =
      DATA.revisions.filter(
        revision =>
          !revision.completed &&
          revision.scheduled_date <=
            today()
      ).length;

  }


  if (xpElement) {

    xpElement.textContent =
      totalXP();

  }


  if (streakElement) {

    streakElement.textContent =
      calculateStreak();

  }


  /*
    Level.
  */

  const level =
    currentLevel();

  const levelElement =
    $("#user-level");

  if (levelElement) {

    levelElement.textContent =
      level;

  }


  const currentXP =
    totalXP() % 100;


  const currentXPElement =
    $("#level-current-xp");

  if (currentXPElement) {

    currentXPElement.textContent =
      `${currentXP} XP`;

  }


  const progress =
    $("#xp-progress-bar");

  if (progress) {

    progress.style.width =
      `${currentXP}%`;

  }


  const levelMessage =
    $("#level-message");

  if (levelMessage) {

    const remaining =
      100 - currentXP;

    levelMessage.textContent =
      `${remaining} XP avant le niveau ${level + 1}. ✨`;

  }


  /*
    Today's revisions.
  */

  const revisionContainer =
    $("#today-revisions");


  if (revisionContainer) {

    const revisions =
      DATA.revisions
        .filter(
          revision =>
            !revision.completed &&
            revision.scheduled_date <=
              today()
        )
        .sort(
          (a, b) => {

            if (
              a.scheduled_date !==
              b.scheduled_date
            ) {

              return (
                a.scheduled_date.localeCompare(
                  b.scheduled_date
                )
              );

            }

            return (
              a.revision_number -
              b.revision_number
            );

          }
        )
        .slice(
          0,
          7
        );


    revisionContainer.innerHTML =
      revisions.length

        ? revisions
            .map(
              revision =>
                dashboardRevisionHTML(
                  revision
                )
            )
            .join("")

        : `
          <div class="empty-state">

            <div
              style="
                font-size:40px;
              "
            >
              🌷
            </div>

            <strong>
              Tout est à jour !
            </strong>

            <span>
              Aucune révision
              urgente aujourd'hui.
            </span>

          </div>
        `;

  }


  /*
    Recent materials.
  */

  const recentContainer =
    $("#recent-materials");


  if (recentContainer) {

    const recent =
      [
        ...DATA.materials
      ]
        .sort(
          (a, b) =>
            String(
              b.created_at
            ).localeCompare(
              String(
                a.created_at
              )
            )
        )
        .slice(
          0,
          6
        );


    recentContainer.innerHTML =
      recent.length

        ? recent
            .map(
              material => `
                <div
                  class="material-mini"
                >

                  <span>
                    ${materialIcon(
                      material.kind
                    )}
                  </span>


                  <div>

                    <strong>
                      ${escapeHTML(
                        material.title
                      )}
                    </strong>

                    <small>
                      ${escapeHTML(
                        getSubject(
                          material.subject_id
                        )?.name ||
                        ""
                      )}
                    </small>

                  </div>

                </div>
              `
            )
            .join("")

        : `
          <div class="empty-state">
            Aucun cours pour le moment.
          </div>
        `;

  }


  /*
    Subject mastery.
  */

  const masteryContainer =
    $("#dashboard-mastery");


  if (masteryContainer) {

    if (
      !DATA.subjects.length
    ) {

      masteryContainer.innerHTML = `
        <div class="empty-state">
          Ajoute une matière pour voir
          ta progression.
        </div>
      `;

    } else {

      masteryContainer.innerHTML =
        DATA.subjects
          .slice(
            0,
            6
          )
          .map(
            subject => {

              const materials =
                DATA.materials.filter(
                  material =>
                    material.subject_id ===
                    subject.id
                );


              const score =
                materials.length

                  ? Math.round(
                      materials.reduce(
                        (
                          total,
                          material
                        ) =>
                          total +
                          calculateMastery(
                            material.id
                          ),
                        0
                      ) /
                      materials.length
                    )

                  : 0;


              return masteryRow(
                `${subject.icon} ${subject.name}`,
                score
              );

            }
          )
          .join("");

    }

  }


  /*
    Lili mini message.
  */

  const liliMessage =
    $("#lili-mini-message");

  if (liliMessage) {

    const due =
      DATA.revisions.filter(
        revision =>
          !revision.completed &&
          revision.scheduled_date <=
            today()
      ).length;


    liliMessage.textContent =
      due

        ? `Tu as ${due} révision${
            due > 1
              ? "s"
              : ""
          } à faire aujourd'hui.`

        : "Tout est à jour. Que veux-tu préparer ?";

  }

}


/* ---------------------------------------------------------
   DASHBOARD REVISION CARD
   --------------------------------------------------------- */

function dashboardRevisionHTML(
  revision
) {

  const material =
    getMaterial(
      revision.material_id
    );


  if (!material) {
    return "";
  }


  const overdue =
    revision.scheduled_date <
      today();


  return `
    <div
      class="
        revision-item
        ${
          overdue
            ? "overdue"
            : ""
        }
      "
    >

      <div
        class="revision-dot"
      ></div>


      <div
        class="revision-copy"
      >

        <strong>
          ${materialIcon(
            material.kind
          )}

          ${escapeHTML(
            material.title
          )}
        </strong>


        <small>

          ${
            overdue
              ? "En retard · "
              : ""
          }

          ${
            revision.scheduled_date ===
            today()

              ? "Aujourd'hui"

              : formatDate(
                  revision.scheduled_date
                )
          }

          ·
          Étape
          ${revision.revision_number}/4

        </small>

      </div>


      <button
        class="small-button"
        onclick="
          startRevision(
            '${revision.id}'
          )
        "
      >
        Réviser
      </button>

    </div>
  `;

}


/* ---------------------------------------------------------
   COMPLETE REVISION
   --------------------------------------------------------- */

window.startRevision =
function (
  revisionId
) {

  const revision =
    DATA.revisions.find(
      item =>
        item.id ===
        revisionId
    );


  if (!revision) {
    return;
  }


  const material =
    getMaterial(
      revision.material_id
    );


  if (!material) {
    return;
  }


  const cards =
    DATA.flashcards.filter(
      card =>
        card.material_id ===
        material.id
    );


  openModal(`

    <span class="eyebrow">
      RÉVISION
      ${revision.revision_number}/4
    </span>


    <h2>
      ${escapeHTML(
        material.title
      )}
    </h2>


    <p>
      Prévue le
      ${formatLongDate(
        revision.scheduled_date
      )}
    </p>


    ${masteryRow(
      masteryLabel(
        calculateMastery(
          material.id
        )
      ),
      calculateMastery(
        material.id
      )
    )}


    <div
      class="material-content"
    >

      ${escapeHTML(
        material.notes ||
        material.raw_text ||
        ""
      ).replace(
        /\n/g,
        "<br>"
      )}

    </div>


    <div
      class="modal-actions"
    >

      <button
        class="btn primary"
        onclick="
          finishRevision(
            '${revision.id}',
            'easy'
          )
        "
      >
        Je maîtrise 👍
      </button>


      <button
        class="btn soft"
        onclick="
          finishRevision(
            '${revision.id}',
            'medium'
          )
        "
      >
        Encore un peu 🌷
      </button>


      <button
        class="btn soft"
        onclick="
          finishRevision(
            '${revision.id}',
            'hard'
          )
        "
      >
        À renforcer 🧠
      </button>


      ${
        cards.length

          ? `
            <button
              class="btn soft"
              onclick="
                startMaterialFlashcards(
                  '${material.id}'
                );
                closeModal();
              "
            >
              🃏
              ${cards.length}
              flashcards
            </button>
          `

          : ""
      }

    </div>

  `);

};


/* ---------------------------------------------------------
   FINISH REVISION
   --------------------------------------------------------- */

window.finishRevision =
async function (
  revisionId,
  result
) {

  const revision =
    DATA.revisions.find(
      item =>
        item.id ===
        revisionId
    );


  if (
    !revision ||
    revision.completed
  ) {

    return;

  }


  const material =
    getMaterial(
      revision.material_id
    );


  if (!material) {
    return;
  }


  try {

    /*
      Complete the current revision.
    */

    await updateRow(
      "revisions",
      revisionId,
      {

        completed:
          true,

        result:
          result,

        completed_at:
          new Date()
            .toISOString()

      }
    );


    /*
      Move to the next stage.

      Important:
      The next revision is calculated
      from the day the student actually
      did the revision.

      This is better than keeping an
      old date when a student was late.
    */

    if (
      revision.revision_number < 4
    ) {

      const nextNumber =
        revision.revision_number + 1;


      const nextDate =
        addDays(
          today(),
          REVISION_DELAYS[
            nextNumber - 1
          ]
        );


      /*
        Make sure we don't create
        duplicates.
      */

      const alreadyExists =
        DATA.revisions.some(
          item =>
            item.material_id ===
              material.id &&
            item.revision_number ===
              nextNumber &&
            !item.completed
        );


      if (
        !alreadyExists
      ) {

        await insertRow(
          "revisions",
          {

            user_id:
              session.user.id,

            material_id:
              material.id,

            revision_number:
              nextNumber,

            scheduled_date:
              nextDate,

            completed:
              false

          }
        );

      }

    }


    closeModal();


    await refreshData();


    toast(
      result === "easy"

        ? "Révision maîtrisée · +15 XP ✨"

        : result === "medium"

        ? "Révision terminée · continue comme ça 🌷"

        : "Révision terminée · cette notion mérite encore un peu d'attention 🧠"
    );


  } catch (error) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   REVISIONS PAGE
   --------------------------------------------------------- */

function renderRevisions() {

  const todayCount =
    DATA.revisions.filter(
      revision =>
        !revision.completed &&
        revision.scheduled_date ===
          today()
    ).length;


  const weekEnd =
    addDays(
      today(),
      7
    );


  const weekCount =
    DATA.revisions.filter(
      revision =>
        !revision.completed &&
        revision.scheduled_date >=
          today() &&
        revision.scheduled_date <=
          weekEnd
    ).length;


  const completedCount =
    DATA.revisions.filter(
      revision =>
        revision.completed
    ).length;


  if (
    $("#revision-today-count")
  ) {

    $("#revision-today-count")
      .textContent =
      todayCount;

  }


  if (
    $("#revision-week-count")
  ) {

    $("#revision-week-count")
      .textContent =
      weekCount;

  }


  if (
    $("#revision-completed-count")
  ) {

    $("#revision-completed-count")
      .textContent =
      completedCount;

  }


  const container =
    $("#revision-full-list");


  if (!container) {
    return;
  }


  const sorted =
    [
      ...DATA.revisions
    ].sort(
      (a, b) => {

        const dateCompare =
          a.scheduled_date.localeCompare(
            b.scheduled_date
          );


        if (
          dateCompare !== 0
        ) {

          return dateCompare;

        }


        return (
          a.revision_number -
          b.revision_number
        );

      }
    );


  if (!sorted.length) {

    container.innerHTML = `
      <div class="empty-state">

        <div
          style="
            font-size:45px;
          "
        >
          🌷
        </div>

        <strong>
          Aucune révision
        </strong>

        <span>
          Tes révisions apparaîtront
          ici dès qu'un cours sera ajouté.
        </span>

      </div>
    `;

    return;

  }


  const groups =
    new Map();


  sorted.forEach(
    revision => {

      if (
        !groups.has(
          revision.scheduled_date
        )
      ) {

        groups.set(
          revision.scheduled_date,
          []
        );

      }

      groups
        .get(
          revision.scheduled_date
        )
        .push(
          revision
        );

    }
  );


  container.innerHTML =
    [
      ...groups.entries()
    ]
      .map(
        (
          [
            date,
            revisions
          ]
        ) => `

          <div
            style="
              margin-bottom:20px;
            "
          >

            <div
              class="eyebrow"
              style="
                margin-bottom:8px;
              "
            >

              ${
                date ===
                today()

                  ? "AUJOURD'HUI"

                  : date < today()

                  ? `
                    EN RETARD ·
                    ${formatDate(
                      date
                    )}
                  `

                  : formatDate(
                      date
                    )
              }

            </div>


            ${revisions
              .map(
                dashboardRevisionHTML
              )
              .join("")}

          </div>

        `
      )
      .join("");

}


/* ---------------------------------------------------------
   CALENDAR
   --------------------------------------------------------- */

function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();


  const title =
    $("#calendar-month");


  const grid =
    $("#calendar-grid");


  if (
    !title ||
    !grid
  ) {

    return;

  }


  title.textContent =
    `${MONTHS[month]} ${year}`;


  const firstDay =
    new Date(
      year,
      month,
      1
    );


  const lastDay =
    new Date(
      year,
      month + 1,
      0
    );


  /*
    Convert Sunday-first JS dates
    to Monday-first calendar.
  */

  const startingOffset =
    (
      firstDay.getDay() +
      6
    ) % 7;


  let html =
    "";


  for (
    let i = 0;
    i <
    startingOffset;
    i++
  ) {

    html += `
      <div
        class="calendar-day empty"
      ></div>
    `;

  }


  for (
    let day = 1;
    day <=
      lastDay.getDate();
    day++
  ) {

    const date =
      `${year}-${
        String(
          month + 1
        ).padStart(
          2,
          "0"
        )
      }-${
        String(
          day
        ).padStart(
          2,
          "0"
        )
      }`;


    const events =
      DATA.events.filter(
        event =>
          event.event_date ===
          date
      );


    const revisions =
      DATA.revisions.filter(
        revision =>
          revision.scheduled_date ===
            date &&
          !revision.completed
      );


    const count =
      events.length +
      revisions.length;


    const classes = [

      date === today()
        ? "today"
        : "",

      date ===
        selectedCalendarDate
        ? "selected"
        : ""

    ]
      .filter(Boolean)
      .join(" ");


    html += `

      <button
        type="button"
        class="
          calendar-day
          ${classes}
        "
        onclick="
          selectCalendarDate(
            '${date}'
          )
        "
      >

        <span>
          ${day}
        </span>


        ${
          count

            ? `
              <b>
                ${count}
              </b>
            `

            : ""
        }

      </button>

    `;

  }


  grid.innerHTML =
    html;


  renderSelectedCalendarDay();

}


/* ---------------------------------------------------------
   SELECT CALENDAR DAY
   --------------------------------------------------------- */

window.selectCalendarDate =
function (
  date
) {

  selectedCalendarDate =
    date;


  renderCalendar();

};


/* ---------------------------------------------------------
   SELECTED CALENDAR DAY
   --------------------------------------------------------- */

function renderSelectedCalendarDay() {

  const title =
    $("#selected-date-title");


  const container =
    $("#selected-day-events");


  if (
    !title ||
    !container
  ) {

    return;

  }


  title.textContent =
    selectedCalendarDate ===
      today()

      ? "Aujourd'hui"

      : formatLongDate(
          selectedCalendarDate
        );


  const events =
    DATA.events.filter(
      event =>
        event.event_date ===
        selectedCalendarDate
    );


  const revisions =
    DATA.revisions.filter(
      revision =>
        revision.scheduled_date ===
        selectedCalendarDate
    );


  let items =
    "";


  events.forEach(
    event => {

      items += `

        <div
          class="event-item"
        >

          <strong>

            ${calendarEventIcon(
              event.event_type
            )}

            ${escapeHTML(
              event.title
            )}

          </strong>


          <small>

            ${escapeHTML(
              event.event_type
            )}


            ${
              event.event_time
                ? ` · ${escapeHTML(
                    event.event_time
                  )}`
                : ""
            }


            ${
              event.notes
                ? ` · ${escapeHTML(
                    event.notes
                  )}`
                : ""
            }

          </small>


          <button
            class="mini-action"
            onclick="
              deleteCalendarEvent(
                '${event.id}'
              )
            "
          >
            Supprimer
          </button>

        </div>

      `;

    }
  );


  revisions.forEach(
    revision => {

      const material =
        getMaterial(
          revision.material_id
        );


      if (!material) {
        return;
      }


      items += `

        <div
          class="event-item"
        >

          <strong>

            🔄
            ${escapeHTML(
              material.title
            )}

          </strong>


          <small>

            Révision
            ${revision.revision_number}/4

          </small>

        </div>

      `;

    }
  );


  container.innerHTML =
    items ||

    `
      <div class="empty-state">

        Rien de prévu ce jour. 🌷

      </div>
    `;

}


/* ---------------------------------------------------------
   CALENDAR EVENT ICON
   --------------------------------------------------------- */

function calendarEventIcon(
  type
) {

  const icons = {

    test:
      "📝",

    exam:
      "🎓",

    deadline:
      "⏰",

    homework:
      "📚",

    other:
      "📌"

  };


  return (
    icons[type] ||
    "📌"
  );

}


/* ---------------------------------------------------------
   ADD CALENDAR EVENT
   --------------------------------------------------------- */

window.openAddEvent =
function () {

  openModal(`

    <span class="eyebrow">
      CALENDRIER
    </span>


    <h2>
      Nouvel événement 📅
    </h2>


    <form
      id="calendar-event-form"
      class="form-stack"
    >

      <label>

        Titre

        <input
          id="event-title"
          placeholder="Ex. Contrôle de maths"
          required
        >

      </label>


      <div class="two">

        <label>

          Date

          <input
            id="event-date"
            type="date"
            value="${selectedCalendarDate}"
            required
          >

        </label>


        <label>

          Heure

          <input
            id="event-time"
            type="time"
          >

        </label>

      </div>


      <label>

        Type

        <select
          id="event-type"
        >

          <option value="test">
            📝 Test
          </option>

          <option value="exam">
            🎓 Examen
          </option>

          <option value="deadline">
            ⏰ Deadline
          </option>

          <option value="homework">
            📚 Devoir
          </option>

          <option value="other">
            📌 Autre
          </option>

        </select>

      </label>


      <label>

        Notes

        <textarea
          id="event-notes"
          rows="4"
          placeholder="Salle, chapitre, consignes..."
        ></textarea>

      </label>


      <button
        class="btn primary"
      >
        Ajouter au calendrier
      </button>

    </form>

  `);


  $(
    "#calendar-event-form"
  ).onsubmit =
    async event => {

      event.preventDefault();


      try {

        await insertRow(
          "calendar_events",
          {

            user_id:
              session.user.id,

            title:
              $(
                "#event-title"
              )
                .value
                .trim(),

            event_date:
              $(
                "#event-date"
              )
                .value,

            event_time:
              $(
                "#event-time"
              )
                .value ||
              null,

            event_type:
              $(
                "#event-type"
              )
                .value,

            notes:
              $(
                "#event-notes"
              )
                .value
                .trim() ||
              null

          }
        );


        closeModal();

        await refreshData();

        renderCalendar();

        toast(
          "Événement ajouté 📅"
        );


      } catch (error) {

        handleAuthError(
          error
        );

      }

    };

};


/* ---------------------------------------------------------
   DELETE CALENDAR EVENT
   --------------------------------------------------------- */

window.deleteCalendarEvent =
async function (
  eventId
) {

  if (
    !confirm(
      "Supprimer cet événement ?"
    )
  ) {

    return;

  }


  try {

    await deleteRow(
      "calendar_events",
      eventId
    );


    await refreshData();

    renderCalendar();


    toast(
      "Événement supprimé"
    );


  } catch (error) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   TO-DO LIST
   --------------------------------------------------------- */

function renderTasks() {

  const todayDate =
    today();


  const weekEnd =
    addDays(
      todayDate,
      7
    );


  const todayTasks =
    DATA.tasks
      .filter(
        task =>
          task.due_date ===
          todayDate
      )
      .sort(
        task =>
          task.completed
            ? 1
            : -1
      );


  const weekTasks =
    DATA.tasks
      .filter(
        task =>
          task.due_date >
            todayDate &&
          task.due_date <=
            weekEnd
      )
      .sort(
        (a,b) =>
          a.due_date.localeCompare(
            b.due_date
          )
      );


  const todayContainer =
    $("#tasks-today");


  if (todayContainer) {

    todayContainer.innerHTML =
      todayTasks.length

        ? todayTasks
            .map(
              taskHTML
            )
            .join("")

        : `
          <div class="empty-state">

            Aucune tâche
            pour aujourd'hui. 🌷

          </div>
        `;

  }


  const weekContainer =
    $("#tasks-week");


  if (weekContainer) {

    weekContainer.innerHTML =
      weekTasks.length

        ? weekTasks
            .map(
              taskHTML
            )
            .join("")

        : `
          <div class="empty-state">

            Aucune tâche
            à venir cette semaine.

          </div>
        `;

  }

}


/* ---------------------------------------------------------
   TASK HTML
   --------------------------------------------------------- */

function taskHTML(
  task
) {

  return `

    <div
      class="
        task-item
        ${
          task.completed
            ? "done"
            : ""
        }
      "
    >

      <input
        class="task-check"
        type="checkbox"
        ${
          task.completed
            ? "checked"
            : ""
        }
        onchange="
          toggleTask(
            '${task.id}',
            this.checked
          )
        "
      >


      <span
        class="task-title"
      >
        ${escapeHTML(
          task.title
        )}
      </span>


      <span
        class="task-date"
      >
        ${escapeHTML(
          task.due_date
        )}
      </span>


      <button
        class="mini-action"
        onclick="
          deleteTask(
            '${task.id}'
          )
        "
      >
        ×
      </button>

    </div>

  `;

}


/* ---------------------------------------------------------
   ADD TASK
   --------------------------------------------------------- */

window.openAddTask =
function () {

  openModal(`

    <span class="eyebrow">
      TO-DO
    </span>


    <h2>
      Nouvelle tâche ✓
    </h2>


    <form
      id="task-form"
      class="form-stack"
    >

      <label>

        Tâche

        <input
          id="task-title"
          placeholder="Ex. Revoir le chapitre 2"
          required
        >

      </label>


      <label>

        Pour le

        <input
          id="task-date"
          type="date"
          value="${today()}"
          required
        >

      </label>


      <button
        class="btn primary"
      >
        Ajouter la tâche
      </button>

    </form>

  `);


  $(
    "#task-form"
  ).onsubmit =
    async event => {

      event.preventDefault();


      const title =
        $(
          "#task-title"
        )
          .value
          .trim();


      const dueDate =
        $(
          "#task-date"
        )
          .value;


      if (!title) {

        return;

      }


      try {

        await insertRow(
          "tasks",
          {

            user_id:
              session.user.id,

            title:
              title,

            due_date:
              dueDate,

            completed:
              false

          }
        );


        closeModal();

        await refreshData();

        toast(
          "Tâche ajoutée ✓"
        );


      } catch (error) {

        handleAuthError(
          error
        );

      }

    };

};


/* ---------------------------------------------------------
   TOGGLE TASK
   --------------------------------------------------------- */

window.toggleTask =
async function (
  taskId,
  completed
) {

  try {

    await updateRow(
      "tasks",
      taskId,
      {

        completed:
          completed,

        completed_at:
          completed

            ? new Date()
                .toISOString()

            : null

      }
    );


    await refreshData();


    toast(
      completed
        ? "Tâche terminée · +3 XP ✨"
        : "Tâche rouverte"
    );


  } catch (error) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   DELETE TASK
   --------------------------------------------------------- */

window.deleteTask =
async function (
  taskId
) {

  try {

    await deleteRow(
      "tasks",
      taskId
    );


    await refreshData();

    toast(
      "Tâche supprimée"
    );


  } catch (error) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   REFRESH DASHBOARD + CURRENT PAGE
   --------------------------------------------------------- */

async function refreshEverything() {

  try {

    await loadAllData();

    renderAll();

  } catch (error) {

    handleAuthError(
      error
    );

  }

}


/* ---------------------------------------------------------
   SAFE NAVIGATION
   --------------------------------------------------------- */

window.navigate =
function (
  page
) {

  activePage =
    page;


  $$(".page")
    .forEach(
      section =>
        section.classList.add(
          "hidden"
        )
    );


  const target =
    $(
      `#page-${page}`
    );


  if (!target) {

    return;

  }


  target.classList.remove(
    "hidden"
  );


  $$(".nav-item")
    .forEach(
      button =>
        button.classList.toggle(
          "active",
          button.dataset.page ===
            page
        )
    );


  if (
    page ===
    "dashboard"
  ) {

    renderDashboard();

  }


  if (
    page ===
    "subjects"
  ) {

    renderSubjects();

  }


  if (
    page ===
    "materials"
  ) {

    renderMaterials();

  }


  if (
    page ===
    "revisions"
  ) {

    renderRevisions();

  }


  if (
    page ===
    "calendar"
  ) {

    renderCalendar();

  }


  if (
    page ===
    "tasks"
  ) {

    renderTasks();

  }


  if (
    page ===
    "flashcards"
  ) {

    renderFlashcards();

  }


  if (
    page ===
    "quiz"
  ) {

    renderQuizOptions();

  }


  if (
    page ===
    "lili"
  ) {

    renderLili();

  }


  if (
    page ===
    "study-ai"
  ) {

    renderStudyAI();

  }


  if (
    page ===
    "focus"
  ) {

    renderFocus();

  }


  if (
    page ===
    "statistics"
  ) {

    renderStats();

  }


  if (
    page ===
    "rewards"
  ) {

    renderRewards();

  }


  if (
    page ===
    "friends"
  ) {

    renderFriends();

  }


  if (
    page ===
    "profile"
  ) {

    renderProfile();

  }


  $(".sidebar")
    ?.classList.remove(
      "open"
    );

};


/* ---------------------------------------------------------
   RENDER EVERYTHING
   --------------------------------------------------------- */

function renderAll() {

  renderDate();

  renderTopUser();

  renderDashboard();

  renderSubjects();

  renderMaterials();

  renderRevisions();

  renderCalendar();

  renderTasks();

  renderFlashcards();

  renderQuizOptions();

  renderLili();

  renderStudyAI();

  renderFocus();

  renderStats();

  renderRewards();

  renderFriends();

  renderProfile();

}


/* ---------------------------------------------------------
   HEADER DATE
   --------------------------------------------------------- */

function renderDate() {

  const date =
    new Date();


  const day =
    $("#current-day");


  const dateText =
    $("#current-date");


  if (day) {

    day.textContent =
      DAYS[
        date.getDay()
      ];

  }


  if (dateText) {

    dateText.textContent =
      `
        ${date.getDate()}
        ${
          MONTHS[
            date.getMonth()
          ]
        }
        ${
          date.getFullYear()
        }
      `;

  }

}
/* =========================================================
   PART 6 — FLASHCARDS + QUIZZES
   ========================================================= */


/* ---------------------------------------------------------
   FLASHCARDS
   --------------------------------------------------------- */

function renderFlashcards() {

  const decksContainer =
    $("#flashcard-decks");


  if (!decksContainer) {
    return;
  }


  /*
    One deck per course.
  */

  const materials =
    [
      ...DATA.materials
    ].sort(
      (a, b) =>
        String(
          b.created_at
        ).localeCompare(
          String(
            a.created_at
          )
        )
    );


  if (!materials.length) {

    decksContainer.innerHTML = `
      <div class="empty-state">

        <div
          style="
            font-size:45px;
          "
        >
          🃏
        </div>

        <strong>
          Aucun paquet de cartes
        </strong>

        <span>
          Ajoute d'abord un cours,
          puis Lili pourra créer
          tes flashcards.
        </span>

      </div>
    `;

    const area =
      $("#flashcard-area");

    if (area) {
      area.innerHTML = "";
    }

    return;
  }


  decksContainer.innerHTML =
    materials
      .map(
        material => {

          const cards =
            DATA.flashcards.filter(
              card =>
                card.material_id ===
                material.id
            );


          const dueCards =
            cards.filter(
              card =>
                !card.due_date ||
                card.due_date <=
                  today()
            );


          return `

            <div
              class="deck-card"
            >

              <div>

                <span>
                  ${materialIcon(
                    material.kind
                  )}
                </span>


                <div>

                  <strong>
                    ${escapeHTML(
                      material.title
                    )}
                  </strong>


                  <small>

                    ${
                      cards.length
                    }
                    carte${
                      cards.length !==
                      1
                        ? "s"
                        : ""
                    }


                    ${
                      dueCards.length
                        ? `
                          ·
                          ${dueCards.length}
                          à revoir
                        `
                        : ""
                    }

                  </small>

                </div>

              </div>


              <div>

                ${
                  cards.length

                    ? `
                      <button
                        class="small-button"
                        onclick="
                          startMaterialFlashcards(
                            '${material.id}'
                          )
                        "
                      >
                        Réviser
                      </button>
                    `

                    : `
                      <button
                        class="small-button"
                        onclick="
                          createAICards(
                            '${material.id}'
                          )
                        "
                      >
                        ✨ Créer
                      </button>
                    `
                }


                <button
                  class="small-button"
                  onclick="
                    createAICards(
                      '${material.id}'
                    )
                  "
                >
                  + AI
                </button>

              </div>

            </div>

          `;

        }
      )
      .join("");


  renderCurrentFlashcard();

}


/* ---------------------------------------------------------
   START FLASHCARD DECK
   --------------------------------------------------------- */

window.startMaterialFlashcards =
function (
  materialId
) {

  const cards =
    DATA.flashcards.filter(
      card =>
        card.material_id ===
        materialId
    );


  if (!cards.length) {

    toast(
      "Ce cours n'a pas encore de flashcards. Demande à Lili d'en créer.",
      "warning"
    );

    activeMaterialId =
      materialId;


    navigate(
      "study-ai"
    );


    setTimeout(
      () => {

        const selector =
          $(
            "#study-ai-material"
          );


        if (selector) {

          selector.value =
            materialId;

        }

      },
      0
    );


    return;

  }


  /*
    Prefer due cards first.
  */

  const due =
    cards.filter(
      card =>
        !card.due_date ||
        card.due_date <=
          today()
    );


  flashDeck =
    due.length
      ? due
      : cards;


  flashIndex =
    0;

  flashFlipped =
    false;


  activeMaterialId =
    materialId;


  navigate(
    "flashcards"
  );


  renderCurrentFlashcard();

};


/* ---------------------------------------------------------
   CURRENT FLASHCARD
   --------------------------------------------------------- */

function renderCurrentFlashcard() {

  const area =
    $("#flashcard-area");


  if (!area) {
    return;
  }


  if (!flashDeck.length) {

    area.innerHTML =
      `
        <div class="empty-state">
          Aucune carte disponible.
        </div>
      `;

    return;

  }


  /*
    Safety in case the deck
    changed while we were studying.
  */

  if (
    flashIndex >=
    flashDeck.length
  ) {

    flashIndex =
      0;

  }


  const card =
    flashDeck[
      flashIndex
    ];


  area.innerHTML = `

    <div
      class="flashcard-player"
    >

      <div
        class="
          flashcard
          ${
            flashFlipped
              ? "flipped"
              : ""
          }
        "
        onclick="
          flipFlashcard()
        "
      >

        <div
          class="flash-front"
        >

          <small>

            CARTE

            ${
              flashIndex + 1
            }

            /

            ${
              flashDeck.length
            }

          </small>


          <h2>
            ${escapeHTML(
              card.front
            )}
          </h2>


          <span>
            Clique pour retourner
          </span>

        </div>


        <div
          class="flash-back"
        >

          <small>
            RÉPONSE
          </small>


          <h2>
            ${escapeHTML(
              card.back
            )}
          </h2>


          <span>
            Boîte
            ${
              card.box || 1
            }
            / 5
          </span>

        </div>

      </div>


      <div
        class="flash-controls"
      >

        <button
          class="btn soft"
          onclick="
            flashResult(
              'hard'
            )
          "
        >
          À revoir
        </button>


        <button
          class="btn primary"
          onclick="
            flipFlashcard()
          "
        >
          ${
            flashFlipped
              ? "Retourner"
              : "Voir la réponse"
          }
        </button>


        <button
          class="btn soft"
          onclick="
            flashResult(
              'easy'
            )
          "
        >
          Je sais ✨
        </button>

      </div>


      <div
        class="flash-progress"
      >

        <div
          style="
            width:
            ${
              (
                (
                  flashIndex + 1
                ) /
                flashDeck.length
              ) *
              100
            }%;
          "
        ></div>

      </div>

    </div>

  `;

}


/* ---------------------------------------------------------
   FLIP
   --------------------------------------------------------- */

window.flipFlashcard =
function () {

  flashFlipped =
    !flashFlipped;

  renderCurrentFlashcard();

};


/* ---------------------------------------------------------
   FLASHCARD RESULT
   --------------------------------------------------------- */

window.flashResult =
async function (
  result
) {

  const card =
    flashDeck[
      flashIndex
    ];


  if (!card) {
    return;
  }


  try {

    let newBox =
      Number(
        card.box || 1
      );


    /*
      Easy:
      move one box forward.

      Hard:
      return to box 1.
    */

    if (
      result ===
      "easy"
    ) {

      newBox =
        Math.min(
          5,
          newBox + 1
        );

    } else {

      newBox =
        1;

    }


    /*
      Simple adaptive spacing.
    */

    const spacing =
      {
        1: 1,
        2: 2,
        3: 4,
        4: 7,
        5: 14
      }[
        newBox
      ] || 1;


    const nextDate =
      new Date();


    nextDate.setDate(
      nextDate.getDate() +
      spacing
    );


    const formatted =
      nextDate
        .toISOString()
        .slice(
          0,
          10
        );


    await updateRow(
      "flashcards",
      card.id,
      {

        box:
          newBox,

        due_date:
          formatted

      }
    );


    /*
      Move to next card.
    */

    flashIndex =
      (
        flashIndex + 1
      ) %
      flashDeck.length;


    flashFlipped =
      false;


    await refreshData();


    renderCurrentFlashcard();


    toast(
      result === "easy"

        ? "Carte maîtrisée ✨"

        : "Carte remise à revoir 🌷"
    );


  } catch (error) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   MANUAL FLASHCARD
   --------------------------------------------------------- */

window.openAddFlashcards =
function () {

  if (
    !DATA.materials.length
  ) {

    toast(
      "Ajoute d'abord un cours.",
      "warning"
    );

    navigate(
      "materials"
    );

    return;

  }


  openModal(`

    <span class="eyebrow">
      FLASHCARDS
    </span>


    <h2>
      Nouvelle flashcard 🃏
    </h2>


    <form
      id="manual-card-form"
      class="form-stack"
    >

      <label>

        Cours

        <select
          id="manual-card-material"
        >

          ${
            DATA.materials
              .map(
                material => `
                  <option
                    value="${material.id}"
                  >
                    ${escapeHTML(
                      material.title
                    )}
                  </option>
                `
              )
              .join("")
          }

        </select>

      </label>


      <label>

        Question

        <input
          id="manual-card-front"
          placeholder="Ex. Quelle est la formule du discriminant ?"
          required
        >

      </label>


      <label>

        Réponse

        <textarea
          id="manual-card-back"
          rows="6"
          placeholder="Écris la réponse..."
          required
        ></textarea>

      </label>


      <button
        class="btn primary"
        type="submit"
      >
        Ajouter la flashcard 🃏
      </button>

    </form>

  `);


  $(
    "#manual-card-form"
  ).onsubmit =
    async event => {

      event.preventDefault();


      try {

        await insertRow(
          "flashcards",
          {

            user_id:
              session.user.id,

            material_id:
              $(
                "#manual-card-material"
              ).value,

            front:
              $(
                "#manual-card-front"
              )
                .value
                .trim(),

            back:
              $(
                "#manual-card-back"
              )
                .value
                .trim(),

            box:
              1,

            due_date:
              today()

          }
        );


        closeModal();

        await refreshData();


        toast(
          "Flashcard ajoutée 🃏"
        );


      } catch (error) {

        handleAuthError(
          error
        );

      }

    };

};


/* ---------------------------------------------------------
   QUIZ SETUP
   --------------------------------------------------------- */

function renderQuizOptions() {

  const selector =
    $("#quiz-subject");


  if (!selector) {
    return;
  }


  const previous =
    selector.value ||
    "all";


  selector.innerHTML = `

    <option
      value="all"
    >
      Toutes les matières
    </option>


    ${
      DATA.subjects
        .map(
          subject => `
            <option
              value="${subject.id}"
            >
              ${subject.icon}
              ${escapeHTML(
                subject.name
              )}
            </option>
          `
        )
        .join("")
    }

  `;


  if (
    DATA.subjects.some(
      subject =>
        subject.id ===
        previous
    )
  ) {

    selector.value =
      previous;

  } else {

    selector.value =
      "all";

  }

}


/* ---------------------------------------------------------
   START QUIZ
   --------------------------------------------------------- */

window.startQuiz =
function (
  materialId = null
) {

  let materials =
    [
      ...DATA.materials
    ];


  /*
    Specific course.
  */

  if (
    materialId
  ) {

    materials =
      materials.filter(
        material =>
          material.id ===
          materialId
      );

  }


  /*
    Subject selection.
  */

  else {

    const subjectId =
      $(
        "#quiz-subject"
      )?.value ||
      "all";


    if (
      subjectId !==
      "all"
    ) {

      materials =
        materials.filter(
          material =>
            material.subject_id ===
            subjectId
        );

    }

  }


  const length =
    Number(
      $(
        "#quiz-length"
      )?.value ||
      10
    );


  const difficulty =
    $(
      "#quiz-difficulty"
    )?.value ||
    "medium";


  /*
    Generate question pool.
  */

  const questions =
    createQuizQuestions(
      materials,
      difficulty
    );


  if (
    questions.length ===
    0
  ) {

    toast(
      "Il faut d'abord créer quelques flashcards. Tu peux demander à Lili de les générer.",
      "warning"
    );


    if (
      materialId
    ) {

      activeMaterialId =
        materialId;

      navigate(
        "study-ai"
      );

    }


    return;

  }


  quizState = {

    questions:
      shuffle(
        questions
      ).slice(
        0,
        Math.min(
          length,
          questions.length
        )
      ),

    index:
      0,

    score:
      0,

    difficulty:
      difficulty

  };


  navigate(
    "quiz"
  );


  renderQuizQuestion();

};


/* ---------------------------------------------------------
   QUIZ FROM SPECIFIC MATERIAL
   --------------------------------------------------------- */

window.startMaterialQuiz =
function (
  materialId
) {

  startQuiz(
    materialId
  );

};


/* ---------------------------------------------------------
   CREATE QUESTIONS
   --------------------------------------------------------- */

function createQuizQuestions(
  materials,
  difficulty
) {

  const cards =
    materials.flatMap(
      material =>
        DATA.flashcards.filter(
          card =>
            card.material_id ===
            material.id
        )
    );


  if (
    !cards.length
  ) {

    return [];

  }


  const allAnswers =
    [
      ...new Set(
        cards
          .map(
            card =>
              card.back
          )
          .filter(Boolean)
      )
    ];


  const questions =
    [];


  cards.forEach(
    card => {

      const possibleDistractors =
        shuffle(
          allAnswers.filter(
            answer =>
              answer !==
              card.back
          )
        );


      /*
        Difficulty controls
        distractor quantity
        and question complexity.
      */

      let distractorCount =
        3;


      if (
        difficulty ===
        "easy"
      ) {

        distractorCount =
          2;

      }


      if (
        difficulty ===
        "hard"
      ) {

        distractorCount =
          3;

      }


      const choices =
        shuffle([
          card.back,
          ...possibleDistractors
            .slice(
              0,
              distractorCount
            )
        ]);


      if (
        choices.length <
        2
      ) {

        return;

      }


      let questionText =
        card.front;


      if (
        difficulty ===
        "hard"
      ) {

        questionText =
          `Défi : ${card.front}`;

      }


      questions.push({

        question:
          questionText,

        answer:
          card.back,

        choices:
          choices,

        materialId:
          card.material_id

      });

    }
  );


  return questions;

}


/* ---------------------------------------------------------
   RENDER QUIZ QUESTION
   --------------------------------------------------------- */

function renderQuizQuestion() {

  const selection =
    $("#quiz-selection");


  const area =
    $("#quiz-area");


  if (
    !selection ||
    !area
  ) {

    return;

  }


  /*
    Finished?
  */

  if (
    quizState.index >=
    quizState.questions.length
  ) {

    finishQuiz();

    return;

  }


  selection.classList.add(
    "hidden"
  );


  area.classList.remove(
    "hidden"
  );


  const question =
    quizState.questions[
      quizState.index
    ];


  const percentage =
    (
      quizState.index /
      quizState.questions.length
    ) *
    100;


  area.innerHTML = `

    <div
      class="quiz-question-card"
    >

      <div
        class="quiz-progress"
      >

        <span>

          Question
          ${
            quizState.index + 1
          }
          /
          ${
            quizState.questions.length
          }

        </span>


        <div>

          <div
            style="
              width:${percentage}%;
            "
          ></div>

        </div>

      </div>


      <div
        class="eyebrow"
        style="
          margin-top:20px;
        "
      >
        ${
          quizState.difficulty ===
          "hard"

            ? "CHALLENGE"

            : quizState.difficulty ===
              "easy"

            ? "ÉCHAUFFEMENT"

            : "QUIZ"
        }
      </div>


      <h2>
        ${escapeHTML(
          question.question
        )}
      </h2>


      <div
        class="quiz-choices"
      >

        ${
          question.choices
            .map(
              (
                choice,
                index
              ) => `

                <button
                  type="button"
                  data-choice="${escapeHTML(
                    choice
                  )}"
                  onclick="
                    answerQuiz(
                      this
                    )
                  "
                >

                  ${
                    String.fromCharCode(
                      65 + index
                    )
                  }.

                  ${escapeHTML(
                    choice
                  )}

                </button>

              `
            )
            .join("")
        }

      </div>

    </div>

  `;

}


/* ---------------------------------------------------------
   ANSWER QUIZ
   --------------------------------------------------------- */

window.answerQuiz =
function (
  button
) {

  const choicesContainer =
    button.parentElement;


  if (
    choicesContainer.dataset
      .answered ===
    "true"
  ) {

    return;

  }


  choicesContainer.dataset
    .answered =
    "true";


  const question =
    quizState.questions[
      quizState.index
    ];


  const selected =
    button.dataset.choice;


  const correct =
    selected ===
    question.answer;


  if (
    correct
  ) {

    button.classList.add(
      "correct"
    );


    quizState.score++;


    toast(
      "+10 XP · Bonne réponse ⭐"
    );

  } else {

    button.classList.add(
      "wrong"
    );


    const correctButton =
      [
        ...choicesContainer
          .querySelectorAll(
            "button"
          )
      ].find(
        item =>
          item.dataset.choice ===
          question.answer
      );


    if (
      correctButton
    ) {

      correctButton.classList.add(
        "correct"
      );

    }


    toast(
      "Pas grave, regarde la bonne réponse 🌷",
      "warning"
    );

  }


  setTimeout(
    () => {

      quizState.index++;

      renderQuizQuestion();

    },
    850
  );

};


/* ---------------------------------------------------------
   FINISH QUIZ
   --------------------------------------------------------- */

async function finishQuiz() {

  const total =
    quizState.questions.length;


  if (
    total ===
    0
  ) {

    return;

  }


  const percentage =
    Math.round(
      (
        quizState.score /
        total
      ) *
      100
    );


  const earnedXP =
    15 +
    quizState.score *
    10;


  try {

    /*
      Save attempt in Supabase.
    */

    await insertRow(
      "quiz_attempts",
      {

        user_id:
          session.user.id,

        score:
          quizState.score,

        total:
          total,

        percentage:
          percentage,

        earned_xp:
          earnedXP,

        difficulty:
          quizState.difficulty

      }
    );


    /*
      Every 5 completed quizzes
      unlocks a reward.

      We check the count after
      saving the latest attempt.
    */

    const quizCount =
      DATA.quizAttempts.length +
      1;


    if (
      quizCount % 5 ===
      0
    ) {

      await unlockNextReward();

    }


    await refreshData();


  } catch (error) {

    console.error(
      "Quiz save error:",
      error
    );

  }


  const area =
    $("#quiz-area");


  if (!area) {
    return;
  }


  const emoji =
    percentage >= 80
      ? "🎉"
      : percentage >= 50
      ? "🌷"
      : "💪";


  area.innerHTML = `

    <div
      class="quiz-result"
    >

      <div
        style="
          font-size:58px;
        "
      >
        ${emoji}
      </div>


      <h2>
        Quiz terminé !
      </h2>


      <strong>
        ${
          quizState.score
        }
        /
        ${
          total
        }
      </strong>


      <p>
        ${
          percentage
        }%
        ·
        +${
          earnedXP
        }
        XP
      </p>


      <p>

        ${
          percentage >= 80

            ? "Excellent travail ! ✨"

            : percentage >= 50

            ? "Tu progresses bien. Continue ! 🌸"

            : "Tu sais maintenant quelles notions renforcer. 💪"

        }

      </p>


      <div
        class="button-row"
        style="
          justify-content:center;
        "
      >

        <button
          class="btn primary"
          onclick="
            resetQuiz()
          "
        >
          Nouveau quiz
        </button>


        ${
          activeMaterialId

            ? `
              <button
                class="btn soft"
                onclick="
                  startMaterialFlashcards(
                    '${activeMaterialId}'
                  )
                "
              >
                Revoir les flashcards
              </button>
            `

            : ""
        }

      </div>

    </div>

  `;

}


/* ---------------------------------------------------------
   RESET QUIZ
   --------------------------------------------------------- */

window.resetQuiz =
function () {

  quizState = {

    questions:
      [],

    index:
      0,

    score:
      0,

    difficulty:
      "medium"

  };


  $("#quiz-area")
    ?.classList.add(
      "hidden"
    );


  $("#quiz-selection")
    ?.classList.remove(
      "hidden"
    );


  renderQuizOptions();

};


/* ---------------------------------------------------------
   UNLOCK REWARD
   --------------------------------------------------------- */

async function unlockNextReward() {

  const rewards = [

    "🌸 Petit jardin",

    "✨ Étoile brillante",

    "🦋 Papillon",

    "🌙 Lune douce",

    "💗 Cœur rose",

    "🪐 Petite planète",

    "🌷 Tulipe",

    "☁️ Nuage",

    "🌈 Arc-en-ciel",

    "🧸 Petit compagnon"

  ];


  const existingNames =
    new Set(
      DATA.rewards.map(
        reward =>
          reward.name
      )
    );


  const nextReward =
    rewards.find(
      reward =>
        !existingNames.has(
          reward
        )
    ) ||
    rewards[
      DATA.rewards.length %
      rewards.length
    ];


  try {

    await insertRow(
      "rewards",
      {

        user_id:
          session.user.id,

        name:
          nextReward

      }
    );


    toast(
      `Nouvelle récompense : ${nextReward} 🎁`
    );


  } catch (error) {

    /*
      Don't interrupt the quiz
      if reward insertion fails.
    */

    console.warn(
      "Reward insertion failed:",
      error
    );

  }

}
/* =========================================================
   PART 7 — LILI AI + STUDY AI
   ========================================================= */


/* ---------------------------------------------------------
   AI FUNCTION HELPER
   --------------------------------------------------------- */

async function callLiliAI({
  action = "chat",
  prompt = "",
  materialId = null,
  context = null
} = {}) {

  if (!session?.user) {

    toast(
      "Connecte-toi pour utiliser Lili.",
      "warning"
    );

    return null;

  }


  /*
    Get the selected lesson.
  */

  const material =
    materialId
      ? getMaterial(
          materialId
        )
      : null;


  /*
    Prepare only the study content
    needed by the AI.

    We do NOT send passwords,
    private authentication data,
    etc.
  */

  const materialContext =
    material

      ? {

          id:
            material.id,

          title:
            material.title,

          kind:
            material.kind,

          content:
            material.notes ||
            material.raw_text ||
            ""

        }

      : null;


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .functions
        .invoke(
          "lili",
          {

            body: {

              action:
                action,

              prompt:
                prompt,

              material:
                materialContext,

              context:
                context

            }

          }
        );


    if (error) {

      throw error;

    }


    return (
      data?.result ||
      data?.text ||
      ""
    );


  } catch (error) {

    console.error(
      "Lili AI error:",
      error
    );


    toast(
      "Lili ne peut pas répondre pour le moment. Vérifie que la fonction AI est bien configurée.",
      "error"
    );


    return null;

  }

}


/* ---------------------------------------------------------
   LILI CHAT
   --------------------------------------------------------- */

function renderLili() {

  const messages =
    $("#lili-messages");


  if (!messages) {

    return;

  }


  /*
    Don't reset the conversation
    every time the page renders.
  */

  if (
    messages.dataset.initialized ===
    "true"
  ) {

    return;

  }


  messages.dataset.initialized =
    "true";


  messages.innerHTML = `

    <div
      class="lili-message assistant"
    >

      <div
        class="message-avatar"
      >
        🌸
      </div>


      <div
        class="message-bubble"
      >

        Coucou
        ${
          escapeHTML(
            profile?.display_name ||
            profile?.first_name ||
            ""
          )
        }
        ! 💕

        <br><br>

        Je suis Lili.

        Je peux t'aider à :

        <br>
        📝 comprendre un cours
        <br>
        🃏 créer des flashcards
        <br>
        ❓ préparer un quiz
        <br>
        🧠 faire une carte mentale
        <br>
        🎙️ préparer un podcast
        <br>
        📚 préparer un test

        <br><br>

        Tu peux simplement me poser
        une question. ✨

      </div>

    </div>

  `;

}


/* ---------------------------------------------------------
   SEND MESSAGE TO LILI
   --------------------------------------------------------- */

async function sendLiliMessage(
  message
) {

  const cleanMessage =
    String(
      message || ""
    ).trim();


  if (
    !cleanMessage
  ) {

    return;

  }


  const container =
    $("#lili-messages");


  if (!container) {

    return;

  }


  /*
    User message.
  */

  container.innerHTML += `

    <div
      class="lili-message user"
    >

      <div
        class="message-bubble"
      >

        ${escapeHTML(
          cleanMessage
        )}

      </div>

    </div>

  `;


  /*
    Temporary typing indicator.
  */

  const typing =
    document.createElement(
      "div"
    );


  typing.className =
    "lili-message assistant";


  typing.innerHTML = `

    <div
      class="message-avatar"
    >
      🌸
    </div>


    <div
      class="message-bubble"
    >
      Je réfléchis… ✨
    </div>

  `;


  container.appendChild(
    typing
  );


  container.scrollTop =
    container.scrollHeight;


  /*
    Useful study context.
  */

  const due =
    DATA.revisions
      .filter(
        revision =>
          !revision.completed &&
          revision.scheduled_date <=
            today()
      )
      .slice(
        0,
        12
      )
      .map(
        revision =>
          getMaterial(
            revision.material_id
          )?.title
      )
      .filter(Boolean);


  const materialList =
    DATA.materials
      .slice(
        0,
        30
      )
      .map(
        material => ({

          title:
            material.title,

          subject:
            getSubject(
              material.subject_id
            )?.name ||
            "",

          chapter:
            getChapter(
              material.chapter_id
            )?.name ||
            ""

        })
      );


  try {

    const result =
      await callLiliAI({

        action:
          "chat",

        prompt:
          cleanMessage,

        context: {

          studentName:
            profile?.display_name ||
            profile?.first_name ||
            "élève",

          classLevel:
            profile?.class_level ||
            "",

          dueRevisions:
            due,

          materials:
            materialList

        }

      });


    typing
      .querySelector(
        ".message-bubble"
      )
      .textContent =
      result ||
      "Je n'ai pas réussi à trouver une réponse pour le moment.";


  } catch (error) {

    typing
      .querySelector(
        ".message-bubble"
      )
      .textContent =
      "Je n'arrive pas à joindre mon service AI pour le moment. 🌷";

  }


  container.scrollTop =
    container.scrollHeight;

}


/* ---------------------------------------------------------
   STUDY AI PAGE
   --------------------------------------------------------- */

function renderStudyAI() {

  const selector =
    $("#study-ai-material");


  if (!selector) {

    return;

  }


  const previous =
    selector.value ||
    activeMaterialId ||
    "";


  selector.innerHTML = `

    <option
      value=""
    >
      Choisir un cours
    </option>


    ${
      DATA.materials
        .map(
          material => `

            <option
              value="${material.id}"
            >

              ${materialIcon(
                material.kind
              )}

              ${escapeHTML(
                material.title
              )}

            </option>

          `
        )
        .join("")
    }

  `;


  if (
    DATA.materials.some(
      material =>
        material.id ===
        previous
    )
  ) {

    selector.value =
      previous;

  }


}


/* ---------------------------------------------------------
   OPEN STUDY AI FOR MATERIAL
   --------------------------------------------------------- */

window.openStudyAIForMaterial =
function (
  materialId
) {

  activeMaterialId =
    materialId;


  navigate(
    "study-ai"
  );


  setTimeout(
    () => {

      const selector =
        $("#study-ai-material");


      if (selector) {

        selector.value =
          materialId;

      }


      const output =
        $("#study-ai-output");


      if (output) {

        output.innerHTML = `

          <div
            class="empty-state"
          >

            Choisis une action
            pour demander à Lili
            de travailler sur ce cours. 🌸

          </div>

        `;

      }

    },
    0
  );

};


/* ---------------------------------------------------------
   RUN STUDY AI ACTION
   --------------------------------------------------------- */

async function runStudyAIAction(
  action
) {

  const materialId =
    $("#study-ai-material")
      ?.value;


  if (!materialId) {

    toast(
      "Choisis d'abord un cours.",
      "warning"
    );

    return;

  }


  activeMaterialId =
    materialId;


  const output =
    $("#study-ai-output");


  if (!output) {

    return;

  }


  /*
    Loading state.
  */

  output.innerHTML = `

    <div
      class="empty-state"
    >

      <div
        style="
          font-size:40px;
        "
      >
        🌸
      </div>

      <strong>
        Lili travaille sur ton cours…
      </strong>

      <span>
        Cela peut prendre quelques secondes.
      </span>

    </div>

  `;


  /*
    Ask the Edge Function.
  */

  const result =
    await callLiliAI({

      action:
        action,

      materialId:
        materialId

    });


  if (!result) {

    output.innerHTML = `

      <div
        class="empty-state"
      >

        Lili n'a pas pu
        produire le résultat.

      </div>

    `;

    return;

  }


  /*
    Display AI result.
  */

  output.innerHTML =
    formatAIResult(
      action,
      result
    );


  /*
    When Lili created flashcards,
    try to save them automatically.
  */

  if (
    action ===
    "flashcards"
  ) {

    await importAIGeneratedFlashcards(
      materialId,
      result
    );

  }

}


/* ---------------------------------------------------------
   FORMAT AI OUTPUT
   --------------------------------------------------------- */

function formatAIResult(
  action,
  result
) {

  const titles = {

    summary:
      "📝 Résumé",

    flashcards:
      "🃏 Flashcards",

    quiz:
      "❓ Quiz",

    podcast:
      "🎙️ Podcast de révision",

    mindmap:
      "🧠 Carte mentale",

    plan:
      "📚 Préparation au test"

  };


  const title =
    titles[action] ||
    "✨ Résultat de Lili";


  return `

    <div
      class="output-card"
    >

      <div
        class="eyebrow"
      >
        LILI AI
      </div>


      <h2>
        ${title}
      </h2>


      <div
        class="ai-result-text"
      >
        ${escapeHTML(
          result
        ).replace(
          /\n/g,
          "<br>"
        )}
      </div>

    </div>


    ${
      action === "podcast"

        ? `

          <button
            type="button"
            class="btn soft"
            onclick="
              speakStudyAIResult()
            "
          >
            ▶️ Lire à voix haute
          </button>

        `

        : ""
    }

  `;

}


/* ---------------------------------------------------------
   IMPORT AI FLASHCARDS
   --------------------------------------------------------- */

async function importAIGeneratedFlashcards(
  materialId,
  result
) {

  if (
    !result
  ) {

    return;

  }


  /*
    Expected AI format:

    Q: question | A: answer

    One card per line.
  */

  const lines =
    String(
      result
    )
      .split(
        /\n+/
      )
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean);


  let added =
    0;


  for (
    const line of lines
  ) {

    const match =
      line.match(
        /^Q\s*:\s*(.*?)\s*\|\s*A\s*:\s*(.+)$/i
      );


    if (!match) {

      continue;

    }


    const question =
      match[1].trim();


    const answer =
      match[2].trim();


    if (
      !question ||
      !answer
    ) {

      continue;

    }


    /*
      Avoid exact duplicates.
    */

    const duplicate =
      DATA.flashcards.some(
        card =>
          card.material_id ===
            materialId &&
          card.front.toLowerCase() ===
            question.toLowerCase()
      );


    if (
      duplicate
    ) {

      continue;

    }


    try {

      await insertRow(
        "flashcards",
        {

          user_id:
            session.user.id,

          material_id:
            materialId,

          front:
            question,

          back:
            answer,

          box:
            1,

          due_date:
            today()

        }
      );


      added++;


    } catch (
      error
    ) {

      console.warn(
        "AI flashcard save failed:",
        error
      );

    }

  }


  if (
    added >
    0
  ) {

    await refreshData();


    toast(
      `${added} flashcard${
        added > 1
          ? "s"
          : ""
      } ajoutée${
        added > 1
          ? "s"
          : ""
      } 🃏`
    );

  }

}


/* ---------------------------------------------------------
   AI CARD BUTTON
   --------------------------------------------------------- */

window.createAICards =
async function (
  materialId
) {

  activeMaterialId =
    materialId;


  navigate(
    "study-ai"
  );


  setTimeout(
    async () => {

      const selector =
        $("#study-ai-material");


      if (selector) {

        selector.value =
          materialId;

      }


      await runStudyAIAction(
        "flashcards"
      );

    },
    0
  );

};


/* ---------------------------------------------------------
   AI QUIZ FROM MATERIAL
   --------------------------------------------------------- */

window.createAIQuiz =
async function (
  materialId
) {

  activeMaterialId =
    materialId;


  navigate(
    "study-ai"
  );


  setTimeout(
    async () => {

      const selector =
        $("#study-ai-material");


      if (selector) {

        selector.value =
          materialId;

      }


      await runStudyAIAction(
        "quiz"
      );

    },
    0
  );

};


/* ---------------------------------------------------------
   AI SUMMARY
   --------------------------------------------------------- */

window.createAISummary =
async function (
  materialId
) {

  activeMaterialId =
    materialId;


  navigate(
    "study-ai"
  );


  setTimeout(
    async () => {

      const selector =
        $("#study-ai-material");


      if (selector) {

        selector.value =
          materialId;

      }


      await runStudyAIAction(
        "summary"
      );

    },
    0
  );

};


/* ---------------------------------------------------------
   PODCAST SPEECH
   --------------------------------------------------------- */

window.speakStudyAIResult =
function () {

  if (
    !(
      "speechSynthesis"
      in window
    )
  ) {

    toast(
      "La lecture vocale n'est pas disponible dans ce navigateur.",
      "warning"
    );

    return;

  }


  const output =
    $("#study-ai-output");


  if (!output) {
    return;
  }


  const text =
    output
      .innerText
      .trim();


  if (!text) {

    return;

  }


  /*
    Stop previous speech.
  */

  window.speechSynthesis
    .cancel();


  const utterance =
    new SpeechSynthesisUtterance(
      text
    );


  utterance.lang =
    "fr-FR";


  utterance.rate =
    0.95;


  utterance.pitch =
    1.02;


  /*
    Try to find a French voice.
  */

  const voices =
    window.speechSynthesis
      .getVoices();


  const frenchVoice =
    voices.find(
      voice =>
        voice.lang
          ?.toLowerCase()
          .startsWith(
            "fr"
          )
    );


  if (
    frenchVoice
  ) {

    utterance.voice =
      frenchVoice;

  }


  window.speechSynthesis
    .speak(
      utterance
    );

};


/* ---------------------------------------------------------
   STOP PODCAST
   --------------------------------------------------------- */

window.stopStudyAISpeech =
function () {

  if (
    "speechSynthesis"
    in window
  ) {

    window.speechSynthesis
      .cancel();

  }

};


/* ---------------------------------------------------------
   AI CHAT ABOUT SELECTED COURSE
   --------------------------------------------------------- */

window.askLiliAboutMaterial =
async function (
  materialId,
  question
) {

  const result =
    await callLiliAI({

      action:
        "chat",

      materialId:
        materialId,

      prompt:
        question

    });


  return result;

};


/* ---------------------------------------------------------
   GENERIC STUDY AI PROMPT
   --------------------------------------------------------- */

window.askStudyAI =
async function () {

  const selector =
    $("#study-ai-material");


  const input =
    $("#study-ai-prompt");


  if (
    !selector ||
    !input
  ) {

    return;

  }


  const materialId =
    selector.value;


  const question =
    input.value.trim();


  if (!materialId) {

    toast(
      "Choisis un cours.",
      "warning"
    );

    return;

  }


  if (!question) {

    toast(
      "Écris ta question.",
      "warning"
    );

    return;

  }


  input.value =
    "";


  const output =
    $("#study-ai-output");


  if (output) {

    output.innerHTML = `

      <div
        class="empty-state"
      >
        Lili réfléchit… 🌸
      </div>

    `;

  }


  const result =
    await callLiliAI({

      action:
        "chat",

      materialId:
        materialId,

      prompt:
        question

    });


  if (
    output &&
    result
  ) {

    output.innerHTML =
      formatAIResult(
        "chat",
        result
      );

  }

};


/* ---------------------------------------------------------
   AI RECOMMENDATION
   --------------------------------------------------------- */

window.askLiliWhatToStudy =
async function () {

  const due =
    DATA.revisions
      .filter(
        revision =>
          !revision.completed &&
          revision.scheduled_date <=
            today()
      )
      .map(
        revision =>
          getMaterial(
            revision.material_id
          )?.title
      )
      .filter(Boolean);


  const weakCourses =
    DATA.materials
      .map(
        material => ({

          title:
            material.title,

          mastery:
            calculateMastery(
              material.id
            )

        })
      )
      .sort(
        (a,b) =>
          a.mastery -
          b.mastery
      )
      .slice(
        0,
        7
      );


  const result =
    await callLiliAI({

      action:
        "chat",

      prompt:
        `
        Aide-moi à décider
        quoi travailler aujourd'hui.
        Donne-moi un ordre de priorité
        réaliste et pas surchargé.
        `,

      context: {

        today:
          today(),

        dueRevisions:
          due,

        weakestCourses:
          weakCourses

      }

    });


  return result;

};


/* ---------------------------------------------------------
   PREPARE TEST WITH AI
   --------------------------------------------------------- */

window.prepareTestWithLili =
async function (
  materialId
) {

  activeMaterialId =
    materialId;


  navigate(
    "study-ai"
  );


  setTimeout(
    async () => {

      const selector =
        $("#study-ai-material");


      if (selector) {

        selector.value =
          materialId;

      }


      await runStudyAIAction(
        "plan"
      );

    },
    0
  );

};


/* ---------------------------------------------------------
   MIND MAP WITH AI
   --------------------------------------------------------- */

window.createAIMindMap =
async function (
  materialId
) {

  activeMaterialId =
    materialId;


  navigate(
    "study-ai"
  );


  setTimeout(
    async () => {

      const selector =
        $("#study-ai-material");


      if (selector) {

        selector.value =
          materialId;

      }


      await runStudyAIAction(
        "mindmap"
      );

    },
    0
  );

};


/* ---------------------------------------------------------
   PODCAST WITH AI
   --------------------------------------------------------- */

window.createAIPodcast =
async function (
  materialId
) {

  activeMaterialId =
    materialId;


  navigate(
    "study-ai"
  );


  setTimeout(
    async () => {

      const selector =
        $("#study-ai-material");


      if (selector) {

        selector.value =
          materialId;

      }


      await runStudyAIAction(
        "podcast"
      );

    },
    0
  );

};


/* ---------------------------------------------------------
   AI ACTION BUTTONS
   --------------------------------------------------------- */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-ai-action]"
      );


    if (
      !button
    ) {

      return;

    }


    const action =
      button.dataset.aiAction;


    runStudyAIAction(
      action
    );

  }
);


/* ---------------------------------------------------------
   AI ENTER KEY
   --------------------------------------------------------- */

document.addEventListener(
  "keydown",
  event => {

    /*
      Ctrl/Cmd + Enter in
      the Study AI prompt.
    */

    if (
      event.key ===
        "Enter" &&
      (event.ctrlKey ||
        event.metaKey)
    ) {

      const input =
        event.target.closest(
          "#study-ai-prompt"
        );


      if (
        input
      ) {

        event.preventDefault();

        askStudyAI();

      }

    }

  }
);


/* ---------------------------------------------------------
   LILI QUICK SUGGESTIONS
   --------------------------------------------------------- */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-lili-message]"
      );


    if (
      !button
    ) {

      return;

    }


    const message =
      button.dataset
        .liliMessage;


    if (
      message
    ) {

      sendLiliMessage(
        message
      );

    }

  }
);
/* =========================================================
   PART 8 — FOCUS MODE + BROWSER PERMISSIONS
   ========================================================= */


/* ---------------------------------------------------------
   FOCUS DISPLAY
   --------------------------------------------------------- */

function updateFocusDisplay() {

  const timer =
    $("#focus-timer");


  if (!timer) {
    return;
  }


  const minutes =
    Math.floor(
      focusState.seconds / 60
    );


  const seconds =
    focusState.seconds % 60;


  timer.textContent =
    `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      seconds
    ).padStart(
      2,
      "0"
    )}`;

}


/* ---------------------------------------------------------
   FOCUS PAGE
   --------------------------------------------------------- */

function renderFocus() {

  updateFocusDisplay();


  /*
    Synchronize preset buttons.
  */

  const minutes =
    Math.round(
      focusState.seconds / 60
    );


  $$(".focus-presets button")
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          Number(
            button.dataset.minutes
          ) === minutes
        );

      }
    );


  /*
    Update the number of completed sessions
    when a statistic exists on the page.
  */

  const completedSessions =
    $("#focus-completed-count");


  if (
    completedSessions &&
    profile
  ) {

    /*
      We don't need another query here.
      The value is refreshed when data loads.
    */

    completedSessions.textContent =
      profile.focus_sessions ||
      0;

  }

}


/* ---------------------------------------------------------
   SET FOCUS PRESET
   --------------------------------------------------------- */

window.setFocusDuration =
function (
  minutes
) {

  /*
    Don't allow changing the timer
    in the middle of a running session.
  */

  if (
    focusState.timer
  ) {

    toast(
      "Mets la session en pause avant de changer la durée.",
      "warning"
    );

    return;

  }


  const duration =
    Number(minutes);


  if (
    !Number.isFinite(
      duration
    ) ||
    duration <= 0
  ) {

    return;

  }


  focusState.seconds =
    duration * 60;


  updateFocusDisplay();


  $$(".focus-presets button")
    .forEach(
      button =>
        button.classList.toggle(
          "active",
          Number(
            button.dataset.minutes
          ) === duration
        )
    );

};


/* ---------------------------------------------------------
   START / PAUSE FOCUS
   --------------------------------------------------------- */

window.toggleFocus =
async function () {

  const startButton =
    $("#focus-start");


  const status =
    $("#focus-status");


  /*
    PAUSE
  */

  if (
    focusState.timer
  ) {

    clearInterval(
      focusState.timer
    );


    focusState.timer =
      null;


    if (startButton) {

      startButton.textContent =
        "Reprendre";

    }


    if (status) {

      status.textContent =
        "Pause 🌷";

    }


    return;

  }


  /*
    START
  */

  if (
    focusState.seconds <=
    0
  ) {

    focusState.seconds =
      25 * 60;

  }


  if (startButton) {

    startButton.textContent =
      "Pause";

  }


  if (status) {

    status.textContent =
      "Concentre-toi 🌸";

  }


  /*
    Keep the screen awake if
    the user already granted
    that permission.
  */

  await silentlyRequestWakeLock();


  focusState.timer =
    setInterval(
      async () => {

        focusState.seconds--;

        updateFocusDisplay();


        /*
          Finished.
        */

        if (
          focusState.seconds <=
          0
        ) {

          await completeFocusSession();

        }

      },
      1000
    );

};


/* ---------------------------------------------------------
   COMPLETE FOCUS SESSION
   --------------------------------------------------------- */

async function completeFocusSession() {

  if (
    focusState.timer
  ) {

    clearInterval(
      focusState.timer
    );


    focusState.timer =
      null;

  }


  const selectedButton =
    $(".focus-presets button.active");


  const duration =
    Number(
      selectedButton?.dataset.minutes ||
      25
    );


  /*
    Save Focus session.
  */

  try {

    await insertRow(
      "focus_sessions",
      {

        user_id:
          session.user.id,

        duration_minutes:
          duration,

        completed:
          true

      }
    );


  } catch (
    error
  ) {

    /*
      The timer should still finish
      even if statistics saving fails.
    */

    console.warn(
      "Focus session save failed:",
      error
    );

  }


  /*
    Reset timer.
  */

  focusState.seconds =
    duration * 60;


  updateFocusDisplay();


  /*
    Update UI.
  */

  const startButton =
    $("#focus-start");


  const status =
    $("#focus-status");


  if (startButton) {

    startButton.textContent =
      "Commencer";

  }


  if (status) {

    status.textContent =
      "Session terminée ! 🎉";

  }


  /*
    Browser notification.
  */

  sendFocusNotification();


  /*
    Release wake lock.
  */

  releaseWakeLock();


  toast(
    `Session Focus terminée · +25 XP 🎯`
  );


  await refreshData();

}


/* ---------------------------------------------------------
   RESET FOCUS
   --------------------------------------------------------- */

window.resetFocus =
function () {

  if (
    focusState.timer
  ) {

    clearInterval(
      focusState.timer
    );


    focusState.timer =
      null;

  }


  const activePreset =
    $(".focus-presets button.active");


  const duration =
    Number(
      activePreset?.dataset.minutes ||
      25
    );


  focusState.seconds =
    duration * 60;


  updateFocusDisplay();


  $("#focus-start").textContent =
    "Commencer";


  $("#focus-status").textContent =
    "Prêt(e) à commencer ?";


  releaseWakeLock();

};


/* ---------------------------------------------------------
   REQUEST NOTIFICATION PERMISSION
   --------------------------------------------------------- */

window.requestFocusNotifications =
async function () {

  /*
    Notification API doesn't exist
    in every browser/context.
  */

  if (
    !(
      "Notification"
      in window
    )
  ) {

    toast(
      "Les notifications du navigateur ne sont pas disponibles ici.",
      "warning"
    );

    return;

  }


  try {

    const permission =
      await Notification.requestPermission();


    if (
      permission ===
      "granted"
    ) {

      toast(
        "Notifications autorisées ✨"
      );

    } else if (
      permission ===
      "denied"
    ) {

      toast(
        "Les notifications ont été refusées.",
        "warning"
      );

    } else {

      toast(
        "Autorisation non accordée pour le moment.",
        "warning"
      );

    }

  } catch (
    error
  ) {

    console.error(
      error
    );


    toast(
      "Impossible de demander l'autorisation.",
      "error"
    );

  }

};


/* ---------------------------------------------------------
   SEND FOCUS NOTIFICATION
   --------------------------------------------------------- */

function sendFocusNotification() {

  if (
    !(
      "Notification"
      in window
    )
  ) {

    return;

  }


  if (
    Notification.permission !==
    "granted"
  ) {

    return;

  }


  try {

    new Notification(
      "STUDY PLANNER 🌸",
      {

        body:
          "Ta session Focus est terminée. Bravo pour ton travail ! ✨",

        icon:
          "favicon.ico"

      }
    );

  } catch (
    error
  ) {

    console.warn(
      "Notification failed:",
      error
    );

  }

}


/* ---------------------------------------------------------
   FULLSCREEN
   --------------------------------------------------------- */

window.requestFocusFullscreen =
async function () {

  try {

    /*
      If we're already in fullscreen,
      leave it.
    */

    if (
      document.fullscreenElement
    ) {

      await document.exitFullscreen();

      return;

    }


    /*
      Ask the browser.
    */

    await document.documentElement
      .requestFullscreen();


  } catch (
    error
  ) {

    console.warn(
      "Fullscreen failed:",
      error
    );


    toast(
      "Le plein écran n'est pas disponible dans ce navigateur.",
      "warning"
    );

  }

};


/* ---------------------------------------------------------
   WAKE LOCK
   --------------------------------------------------------- */

async function silentlyRequestWakeLock() {

  /*
    Screen Wake Lock isn't available
    everywhere.

    We don't repeatedly ask for permission.
    We simply use it when supported.
  */

  if (
    !navigator.wakeLock?.request
  ) {

    return;

  }


  if (
    focusState.wakeLock
  ) {

    return;

  }


  try {

    focusState.wakeLock =
      await navigator.wakeLock.request(
        "screen"
      );


    focusState.wakeLock
      .addEventListener(
        "release",
        () => {

          focusState.wakeLock =
            null;

        }
      );


  } catch (
    error
  ) {

    /*
      Wake Lock is optional.
      Never stop Focus because it isn't available.
    */

    console.warn(
      "Wake Lock failed:",
      error
    );

  }

}


/* ---------------------------------------------------------
   MANUAL WAKE LOCK BUTTON
   --------------------------------------------------------- */

window.requestFocusWakeLock =
async function () {

  if (
    !navigator.wakeLock?.request
  ) {

    toast(
      "Le maintien de l'écran n'est pas disponible ici.",
      "warning"
    );

    return;

  }


  try {

    await silentlyRequestWakeLock();


    if (
      focusState.wakeLock
    ) {

      toast(
        "L'écran restera allumé pendant le Focus ✨"
      );

    } else {

      toast(
        "Impossible de garder l'écran allumé.",
        "warning"
      );

    }

  } catch (
    error
  ) {

    console.warn(
      error
    );

    toast(
      "Le maintien de l'écran n'est pas disponible.",
      "warning"
    );

  }

};


/* ---------------------------------------------------------
   RELEASE WAKE LOCK
   --------------------------------------------------------- */

async function releaseWakeLock() {

  if (
    !focusState.wakeLock
  ) {

    return;

  }


  try {

    await focusState.wakeLock.release();

  } catch (
    error
  ) {

    console.warn(
      "Wake Lock release failed:",
      error
    );

  }


  focusState.wakeLock =
    null;

}


/* ---------------------------------------------------------
   HANDLE TAB VISIBILITY
   --------------------------------------------------------- */

document.addEventListener(
  "visibilitychange",
  async () => {

    /*
      If the browser tab becomes
      visible again, request Wake Lock
      again when a session is running.
    */

    if (
      document.visibilityState ===
        "visible" &&
      focusState.timer
    ) {

      await silentlyRequestWakeLock();

    }

  }
);


/* ---------------------------------------------------------
   CLEANUP BEFORE PAGE CLOSE
   --------------------------------------------------------- */

window.addEventListener(
  "beforeunload",
  () => {

    if (
      focusState.timer
    ) {

      clearInterval(
        focusState.timer
      );

    }

  }
);


/* ---------------------------------------------------------
   FOCUS SHORTCUT
   --------------------------------------------------------- */

document.addEventListener(
  "keydown",
  event => {

    /*
      Space starts/pauses Focus
      only when the Focus page
      is active and the user isn't
      typing in an input.
    */

    if (
      activePage !==
      "focus"
    ) {

      return;

    }


    const tag =
      document.activeElement
        ?.tagName
        ?.toLowerCase();


    if (
      tag ===
        "input" ||
      tag ===
        "textarea" ||
      tag ===
        "select"
    ) {

      return;

    }


    if (
      event.code ===
      "Space"
    ) {

      event.preventDefault();

      toggleFocus();

    }

  }
);


/* ---------------------------------------------------------
   AUTOMATIC FOCUS STATUS
   --------------------------------------------------------- */

function updateFocusStatus() {

  const status =
    $("#focus-status");


  if (
    !status
  ) {

    return;

  }


  if (
    focusState.timer
  ) {

    status.textContent =
      "Concentre-toi 🌸";

    return;

  }


  status.textContent =
    "Prêt(e) à commencer ?";

}


/* ---------------------------------------------------------
   PUBLIC CLEANUP FUNCTION
   --------------------------------------------------------- */

window.stopFocus =
async function () {

  if (
    focusState.timer
  ) {

    clearInterval(
      focusState.timer
    );


    focusState.timer =
      null;

  }


  await releaseWakeLock();


  $("#focus-start").textContent =
    "Commencer";


  $("#focus-status").textContent =
    "Session arrêtée.";

};
/* =========================================================
   PART 9 — STATISTICS + REWARDS + FRIENDS + PROFILE
   ========================================================= */


/* ---------------------------------------------------------
   STATISTICS
   --------------------------------------------------------- */

function renderStats() {

  const xp =
    totalXP();

  const streak =
    calculateStreak();

  const quizzes =
    DATA.quizAttempts.length;

  const completedRevisions =
    DATA.revisions.filter(
      revision =>
        revision.completed
    ).length;


  /*
    Main counters.
  */

  const xpElement =
    $("#stats-xp");


  if (xpElement) {

    xpElement.textContent =
      xp;

  }


  const bestStreakElement =
    $("#stats-best-streak");


  if (bestStreakElement) {

    const storedBest =
      Number(
        profile?.best_streak ||
        0
      );


    bestStreakElement.textContent =
      Math.max(
        streak,
        storedBest
      );

  }


  const quizElement =
    $("#stats-quizzes");


  if (quizElement) {

    quizElement.textContent =
      quizzes;

  }


  const revisionElement =
    $("#stats-revisions");


  if (revisionElement) {

    revisionElement.textContent =
      completedRevisions;

  }


  /*
    Subject mastery.
  */

  const subjectContainer =
    $("#subject-statistics");


  if (subjectContainer) {

    if (
      !DATA.subjects.length
    ) {

      subjectContainer.innerHTML = `

        <div
          class="empty-state"
        >
          Aucune matière.
        </div>

      `;

    } else {

      subjectContainer.innerHTML =
        DATA.subjects
          .map(
            subject => {

              const materials =
                DATA.materials.filter(
                  material =>
                    material.subject_id ===
                    subject.id
                );


              const score =
                materials.length

                  ? Math.round(
                      materials.reduce(
                        (
                          total,
                          material
                        ) =>
                          total +
                          calculateMastery(
                            material.id
                          ),
                        0
                      ) /
                      materials.length
                    )

                  : 0;


              return `

                <div
                  style="
                    margin-bottom:15px;
                  "
                >

                  ${masteryRow(
                    `${subject.icon} ${subject.name}`,
                    score
                  )}

                  <small
                    style="
                      color:#958b94;
                    "
                  >

                    ${
                      materials.length
                    }
                    cours

                    ·

                    ${
                      materials.filter(
                        material =>
                          calculateMastery(
                            material.id
                          ) >= 70
                      ).length
                    }
                    bien maîtrisé(s)

                  </small>

                </div>

              `;

            }
          )
          .join("");

    }

  }


  /*
    Mastery distribution.
  */

  const masteryContainer =
    $("#mastery-statistics");


  if (
    masteryContainer
  ) {

    const labels = [

      {
        name:
          "À découvrir",

        icon:
          "🌱"

      },

      {
        name:
          "En apprentissage",

        icon:
          "🌷"

      },

      {
        name:
          "À renforcer",

        icon:
          "🧠"

      },

      {
        name:
          "Bien maîtrisé",

        icon:
          "✨"

      },

      {
        name:
          "Maîtrisé",

        icon:
          "🏆"

      }

    ];


    masteryContainer.innerHTML =
      labels
        .map(
          item => {

            const count =
              DATA.materials.filter(
                material =>
                  masteryLabel(
                    calculateMastery(
                      material.id
                    )
                  ) ===
                  item.name
              ).length;


            return `

              <div
                class="revision-item"
              >

                <div
                  class="revision-dot"
                ></div>


                <div
                  class="revision-copy"
                >

                  <strong>

                    ${item.icon}
                    ${item.name}

                  </strong>


                  <small>
                    ${count}
                    cours
                  </small>

                </div>

              </div>

            `;

          }
        )
        .join("");

  }


  /*
    Activity chart.
  */

  renderActivityChart();

}


/* ---------------------------------------------------------
   ACTIVITY CHART
   --------------------------------------------------------- */

function renderActivityChart() {

  const container =
    $("#activity-chart");


  if (!container) {
    return;
  }


  /*
    Show the last 14 days.
  */

  let html =
    "";


  for (
    let index = 13;
    index >= 0;
    index--
  ) {

    const date =
      addDays(
        today(),
        -index
      );


    const revisionActivity =
      DATA.revisions.some(
        revision =>
          revision.completed &&
          revision.completed_at &&
          revision.completed_at
            .slice(
              0,
              10
            ) ===
            date
      );


    const taskActivity =
      DATA.tasks.some(
        task =>
          task.completed &&
          task.completed_at &&
          task.completed_at
            .slice(
              0,
              10
            ) ===
            date
      );


    const quizActivity =
      DATA.quizAttempts.some(
        quiz =>
          quiz.created_at &&
          quiz.created_at
            .slice(
              0,
              10
            ) ===
            date
      );


    const focusActivity =
      DATA.tasks.some(
        task =>
          task.completed_at &&
          task.completed_at
            .slice(
              0,
              10
            ) ===
            date
      );


    const active =
      revisionActivity ||
      taskActivity ||
      quizActivity ||
      focusActivity;


    html += `

      <div
        class="
          activity-day
          ${
            active
              ? "active"
              : ""
          }
        "
        title="${date}"
      ></div>

    `;

  }


  container.innerHTML =
    html;

}


/* ---------------------------------------------------------
   REWARDS
   --------------------------------------------------------- */

function renderRewards() {

  const progress =
    $("#reward-progress");


  const grid =
    $("#rewards-grid");


  if (
    !progress ||
    !grid
  ) {

    return;

  }


  const rewardNames = [

    "🌸 Petit jardin",

    "✨ Étoile brillante",

    "🦋 Papillon",

    "🌙 Lune douce",

    "💗 Cœur rose",

    "🪐 Petite planète",

    "🌷 Tulipe",

    "☁️ Nuage",

    "🌈 Arc-en-ciel",

    "🧸 Petit compagnon"

  ];


  const completedQuizzes =
    DATA.quizAttempts.length;


  const nextMilestone =
    (
      Math.floor(
        completedQuizzes / 5
      ) + 1
    ) *
    5;


  const remaining =
    Math.max(
      0,
      nextMilestone -
      completedQuizzes
    );


  progress.innerHTML = `

    <div>

      <strong>
        ${completedQuizzes}
        quiz terminés
      </strong>

      <span>
        ${
          remaining
        }
        quiz avant la prochaine récompense.
      </span>

    </div>

  `;


  grid.innerHTML =
    rewardNames
      .map(
        (
          reward,
          index
        ) => {

          const unlocked =
            DATA.rewards.some(
              item =>
                item.name ===
                reward
            );


          return `

            <div
              class="
                reward-card
                ${
                  unlocked
                    ? ""
                    : "locked"
                }
              "
            >

              <div>

                ${
                  unlocked
                    ? reward
                    : "🔒"
                }

              </div>


              <strong>

                ${
                  unlocked
                    ? reward
                    : `Récompense ${index + 1}`
                }

              </strong>


              <small>

                ${
                  unlocked

                    ? "Débloquée ✨"

                    : `À ${
                        (
                          index +
                          1
                        ) *
                        5
                      } quiz`
                }

              </small>

            </div>

          `;

        }
      )
      .join("");

}


/* ---------------------------------------------------------
   FRIENDS PAGE
   --------------------------------------------------------- */

async function renderFriends() {

  await loadFriendsData();


  const friendsList =
    $("#friends-list");


  const requestList =
    $("#friend-requests");


  if (
    friendsList
  ) {

    if (
      !DATA.friends.length
    ) {

      friendsList.innerHTML = `

        <div
          class="empty-state"
        >

          Aucun ami pour le moment. 🫶

        </div>

      `;

    } else {

      friendsList.innerHTML =
        DATA.friends
          .map(
            friendship =>
              renderFriendCard(
                friendship.other
              )
          )
          .join("");

    }

  }


  if (
    requestList
  ) {

    if (
      !DATA.requests.length
    ) {

      requestList.innerHTML = `

        <div
          class="empty-state"
        >

          Aucune demande reçue.

        </div>

      `;

    } else {

      requestList.innerHTML =
        DATA.requests
          .map(
            request => `

              <div
                class="friend-card"
              >

                <span
                  class="friend-avatar"
                >

                  ${escapeHTML(
                    request.other?.avatar ||
                    "🌸"
                  )}

                </span>


                <div>

                  <strong>

                    ${escapeHTML(
                      request.other
                        ?.display_name ||
                      "Utilisateur"
                    )}

                  </strong>


                  <small>
                    Demande d'ami
                  </small>

                </div>


                <button
                  class="small-button"
                  onclick="
                    acceptFriendRequest(
                      '${request.id}'
                    )
                  "
                >
                  Accepter
                </button>

              </div>

            `
          )
          .join("");

    }

  }

}


/* ---------------------------------------------------------
   LOAD FRIEND DATA
   --------------------------------------------------------- */

async function loadFriendsData() {

  if (
    !session?.user
  ) {

    DATA.friends =
      [];

    DATA.requests =
      [];

    return;

  }


  try {

    /*
      Get friendships where
      the current user participates.
    */

    const {
      data:
        friendships,
      error:
        friendshipError
    } =
      await supabaseClient
        .from(
          "friendships"
        )
        .select("*")
        .or(
          `user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );


    if (
      friendshipError
    ) {

      throw friendshipError;

    }


    const rows =
      friendships ||
      [];


    /*
      Extract IDs of other users.
    */

    const otherIds =
      [
        ...new Set(
          rows
            .flatMap(
              row => [
                row.user_id,
                row.friend_id
              ]
            )
            .filter(
              id =>
                id !==
                session.user.id
            )
        )
      ];


    let profiles =
      [];


    if (
      otherIds.length
    ) {

      /*
        Only fetch public profile fields.

        We deliberately do NOT request:
        age
        birth_date
        email
      */

      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            "profiles"
          )
          .select(
            `
              id,
              display_name,
              avatar,
              class_level
            `
          )
          .in(
            "id",
            otherIds
          );


      if (
        error
      ) {

        throw error;

      }


      profiles =
        data ||
        [];

    }


    DATA.friends =
      rows
        .filter(
          row =>
            row.status ===
            "accepted"
        )
        .map(
          row => {

            const otherId =
              row.user_id ===
              session.user.id

                ? row.friend_id

                : row.user_id;


            return {

              ...row,

              other:
                profiles.find(
                  p =>
                    p.id ===
                    otherId
                )

            };

          }
        );


    DATA.requests =
      rows
        .filter(
          row =>
            row.status ===
              "pending" &&
            row.friend_id ===
              session.user.id
        )
        .map(
          row => {

            return {

              ...row,

              other:
                profiles.find(
                  p =>
                    p.id ===
                    row.user_id
                )

            };

          }
        );


  } catch (
    error
  ) {

    console.error(
      "Friends loading error:",
      error
    );

  }

}


/* ---------------------------------------------------------
   FRIEND CARD
   --------------------------------------------------------- */

function renderFriendCard(
  profileData
) {

  if (
    !profileData
  ) {

    return "";

  }


  return `

    <div
      class="friend-card"
    >

      <span
        class="friend-avatar"
      >
        ${escapeHTML(
          profileData.avatar ||
          "🌸"
        )}
      </span>


      <div>

        <strong>
          ${escapeHTML(
            profileData.display_name ||
            "Utilisateur"
          )}
        </strong>


        <small>

          ${escapeHTML(
            profileData.class_level ||
            ""
          )}

        </small>

      </div>

    </div>

  `;

}


/* ---------------------------------------------------------
   SEARCH FRIEND
   --------------------------------------------------------- */

async function searchFriendProfile(
  displayName
) {

  const name =
    String(
      displayName ||
      ""
    ).trim();


  const result =
    $("#friend-search-result");


  if (
    !result
  ) {

    return;

  }


  if (
    name.length <
    2
  ) {

    result.innerHTML = `

      <div class="empty-state">

        Entre au moins
        2 caractères.

      </div>

    `;

    return;

  }


  result.innerHTML = `

    <div
      class="empty-state"
    >
      Recherche…
    </div>

  `;


  try {

    /*
      IMPORTANT:

      We only fetch public profile
      fields.

      No email.
      No age.
      No birth date.
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "profiles"
        )
        .select(
          `
            id,
            display_name,
            avatar,
            class_level
          `
        )
        .ilike(
          "display_name",
          `%${name}%`
        )
        .neq(
          "id",
          session.user.id
        )
        .limit(
          10
        );


    if (
      error
    ) {

      throw error;

    }


    if (
      !data?.length
    ) {

      result.innerHTML = `

        <div
          class="empty-state"
        >
          Aucun utilisateur trouvé.
        </div>

      `;

      return;

    }


    result.innerHTML =
      data
        .map(
          person => `

            <div
              class="friend-card"
            >

              <span
                class="friend-avatar"
              >

                ${escapeHTML(
                  person.avatar ||
                  "🌸"
                )}

              </span>


              <div>

                <strong>
                  ${escapeHTML(
                    person.display_name
                  )}
                </strong>


                <small>
                  ${escapeHTML(
                    person.class_level ||
                    ""
                  )}
                </small>

              </div>


              <button
                class="small-button"
                onclick="
                  sendFriendRequest(
                    '${person.id}'
                  )
                "
              >
                Ajouter
              </button>

            </div>

          `
        )
        .join("");


  } catch (
    error
  ) {

    handleAuthError(
      error
    );

  }

}


/* ---------------------------------------------------------
   SEND FRIEND REQUEST
   --------------------------------------------------------- */

window.sendFriendRequest =
async function (
  friendId
) {

  if (
    !friendId ||
    !session?.user
  ) {

    return;

  }


  try {

    /*
      Check if relationship already exists.
    */

    const {
      data:
        existing,
      error:
        existingError
    } =
      await supabaseClient
        .from(
          "friendships"
        )
        .select(
          "id,status,user_id,friend_id"
        )
        .or(
          `
            and(
              user_id.eq.${session.user.id},
              friend_id.eq.${friendId}
            ),
            and(
              user_id.eq.${friendId},
              friend_id.eq.${session.user.id}
            )
          `
        )
        .maybeSingle();


    if (
      existingError &&
      existingError.code !==
        "PGRST116"
    ) {

      throw existingError;

    }


    if (
      existing
    ) {

      if (
        existing.status ===
        "accepted"
      ) {

        toast(
          "Vous êtes déjà amis.",
          "warning"
        );

      } else {

        toast(
          "Une demande existe déjà.",
          "warning"
        );

      }

      return;

    }


    await insertRow(
      "friendships",
      {

        user_id:
          session.user.id,

        friend_id:
          friendId,

        status:
          "pending"

      }
    );


    toast(
      "Demande d'ami envoyée 🫶"
    );


  } catch (
    error
  ) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   ACCEPT FRIEND REQUEST
   --------------------------------------------------------- */

window.acceptFriendRequest =
async function (
  friendshipId
) {

  try {

    await updateRow(
      "friendships",
      friendshipId,
      {

        status:
          "accepted",

        accepted_at:
          new Date()
            .toISOString()

      }
    );


    await refreshData();


    toast(
      "Nouvel ami ajouté 🫶"
    );


  } catch (
    error
  ) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   PROFILE
   --------------------------------------------------------- */

function renderProfile() {

  if (
    !profile
  ) {

    return;

  }


  renderTopUser();


  /*
    Build profile avatar selector.
  */

  const avatarContainer =
    $("#profile-avatars");


  if (
    avatarContainer
  ) {

    avatarContainer.innerHTML =
      AVATARS
        .map(
          avatar => `

            <button
              type="button"
              class="
                avatar-option
                ${
                  profile.avatar ===
                  avatar
                    ? "selected"
                    : ""
                }
              "
              data-avatar="${escapeHTML(
                avatar
              )}"
            >
              ${avatar}
            </button>

          `
        )
        .join("");


    $(
      "#profile-avatars .avatar-option"
    ).forEach(
      button => {

        button.onclick =
          () => {

            $(
              "#profile-avatars .avatar-option"
            ).forEach(
              item =>
                item.classList.remove(
                  "selected"
                )
            );


            button.classList.add(
              "selected"
            );

          };

      }
    );

  }


}


/* ---------------------------------------------------------
   EXPORT DATA
   --------------------------------------------------------- */

window.exportStudyPlannerData =
function () {

  const payload = {

    exportVersion:
      1,

    exportedAt:
      new Date()
        .toISOString(),

    profile: {

      first_name:
        profile?.first_name ||
        "",

      last_name:
        profile?.last_name ||
        "",

      display_name:
        profile?.display_name ||
        "",

      class_level:
        profile?.class_level ||
        "",

      avatar:
        profile?.avatar ||
        "🌸"

      /*
        We deliberately don't export
        the authentication password.
      */

    },

    subjects:
      DATA.subjects,

    chapters:
      DATA.chapters,

    materials:
      DATA.materials,

    revisions:
      DATA.revisions,

    flashcards:
      DATA.flashcards,

    tasks:
      DATA.tasks,

    events:
      DATA.events,

    quizAttempts:
      DATA.quizAttempts,

    rewards:
      DATA.rewards

  };


  const blob =
    new Blob(
      [
        JSON.stringify(
          payload,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    `study-planner-sauvegarde-${today()}.json`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );


  toast(
    "Sauvegarde téléchargée 💾"
  );

};


/* ---------------------------------------------------------
   IMPORT DATA
   --------------------------------------------------------- */

window.importStudyPlannerData =
async function (
  file
) {

  if (
    !file
  ) {

    return;

  }


  try {

    const text =
      await file.text();


    const imported =
      JSON.parse(
        text
      );


    if (
      !imported ||
      typeof imported !==
      "object"
    ) {

      throw new Error(
        "Invalid backup."
      );

    }


    if (
      !confirm(
        "Importer cette sauvegarde ? Les données seront ajoutées à ton espace actuel."
      )
    ) {

      return;

    }


    /*
      We deliberately import
      one entity type at a time.

      Authentication itself is never
      imported.
    */

    const subjects =
      Array.isArray(
        imported.subjects
      )
        ? imported.subjects
        : [];


    let importedSubjects =
      0;


    for (
      const subject of subjects
    ) {

      try {

        await insertRow(
          "subjects",
          {

            user_id:
              session.user.id,

            name:
              subject.name ||
              "Matière importée",

            icon:
              subject.icon ||
              "📚",

            color:
              subject.color ||
              "#E9A8BD"

          }
        );


        importedSubjects++;

      } catch (
        error
      ) {

        console.warn(
          error
        );

      }

    }


    await refreshData();


    toast(
      `${importedSubjects} matière(s) importée(s). Pour éviter des associations incorrectes, les autres éléments devront être reconstruits avec leurs nouvelles relations.`,
      "warning"
    );


  } catch (
    error
  ) {

    console.error(
      error
    );


    toast(
      "Ce fichier de sauvegarde n'est pas valide.",
      "error"
    );

  }

};


/* ---------------------------------------------------------
   RESET STUDY DATA
   --------------------------------------------------------- */

window.resetStudyData =
async function () {

  if (
    !session?.user
  ) {

    return;

  }


  const confirmed =
    confirm(
      "Supprimer toutes tes données d'étude ? Ton compte email ne sera PAS supprimé."
    );


  if (!confirmed) {
    return;
  }


  /*
    Delete child data first.

    This makes the procedure safer
    if the database relationships
    are later changed.
  */

  const tables = [

    "quiz_attempts",

    "revisions",

    "flashcards",

    "calendar_events",

    "tasks",

    "materials",

    "chapters",

    "subjects",

    "rewards",

    "focus_sessions",

    "friendships"

  ];


  try {

    for (
      const table of tables
    ) {

      /*
        RLS guarantees that
        only the user's rows are
        affected.
      */

      const {
        error
      } =
        await supabaseClient
          .from(
            table
          )
          .delete()
          .eq(
            "user_id",
            session.user.id
          );


      if (
        error
      ) {

        console.warn(
          `Could not clear ${table}:`,
          error
        );

      }

    }


    await refreshData();


    toast(
      "Tes données d'étude ont été supprimées."
    );


  } catch (
    error
  ) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   PROFILE DATA HELPERS
   --------------------------------------------------------- */

function fillProfileForm() {

  if (
    !profile
  ) {

    return;

  }


  const fields = {

    "#profile-first-name":
      profile.first_name ||
      "",

    "#profile-last-name":
      profile.last_name ||
      "",

    "#profile-display-name-input":
      profile.display_name ||
      "",

    "#profile-class-input":
      profile.class_level ||
      "",

    "#profile-age":
      profile.age ||
      "",

    "#profile-birthdate":
      profile.birth_date ||
      ""

  };


  Object.entries(
    fields
  ).forEach(
    (
      [
        selector,
        value
      ]
    ) => {

      const element =
        $(selector);


      if (
        element
      ) {

        element.value =
          value;

      }

    }
  );


  const email =
    $("#profile-email");


  if (
    email
  ) {

    email.textContent =
      session?.user?.email ||
      "";

  }


  const avatar =
    profile.avatar ||
    "🌸";


  const bigAvatar =
    $("#profile-avatar");


  if (
    bigAvatar
  ) {

    bigAvatar.textContent =
      avatar;

  }

}


/* ---------------------------------------------------------
   SAVE PROFILE FORM
   --------------------------------------------------------- */

async function handleProfileSave(
  event
) {

  event.preventDefault();


  if (
    !session?.user
  ) {

    return;

  }


  const firstName =
    $(
      "#profile-first-name"
    )
      ?.value
      .trim();


  const lastName =
    $(
      "#profile-last-name"
    )
      ?.value
      .trim();


  const displayName =
    $(
      "#profile-display-name-input"
    )
      ?.value
      .trim();


  const classLevel =
    $(
      "#profile-class-input"
    )
      ?.value
      .trim();


  const ageValue =
    $(
      "#profile-age"
    )
      ?.value;


  const birthDate =
    $(
      "#profile-birthdate"
    )
      ?.value ||
    null;


  const avatar =
    $(
      "#profile-avatars .selected"
    )
      ?.dataset
      .avatar ||
    profile?.avatar ||
    "🌸";


  const age =
    ageValue
      ? Number(ageValue)
      : null;


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "profiles"
        )
        .update({

          first_name:
            firstName,

          last_name:
            lastName,

          display_name:
            displayName ||
            `${firstName} ${lastName}`,

          class_level:
            classLevel,

          age:
            age,

          birth_date:
            birthDate,

          avatar:
            avatar,

          updated_at:
            new Date()
              .toISOString()

        })
        .eq(
          "id",
          session.user.id
        )
        .select()
        .single();


    if (
      error
    ) {

      throw error;

    }


    profile =
      data;


    renderTopUser();

    renderProfile();


    toast(
      "Profil enregistré 🌷"
    );


  } catch (
    error
  ) {

    handleAuthError(
      error
    );

  }

}


/* ---------------------------------------------------------
   PROFILE QUICK ACTIONS
   --------------------------------------------------------- */

window.openProfileEmailChange =
async function () {

  const currentEmail =
    session?.user?.email ||
    "";


  const newEmail =
    prompt(
      "Nouvelle adresse email :",
      currentEmail
    );


  if (
    !newEmail ||
    newEmail ===
      currentEmail
  ) {

    return;

  }


  try {

    const {
      error
    } =
      await supabaseClient
        .auth
        .updateUser({
          email:
            newEmail
        });


    if (
      error
    ) {

      throw error;

    }


    toast(
      "Vérifie le nouvel email pour confirmer le changement. 💌"
    );


  } catch (
    error
  ) {

    handleAuthError(
      error
    );

  }

};


window.openPasswordChange =
async function () {

  const password =
    prompt(
      "Nouveau mot de passe (6 caractères minimum) :"
    );


  if (
    !password
  ) {

    return;

  }


  if (
    password.length <
    6
  ) {

    toast(
      "Le mot de passe doit avoir au moins 6 caractères.",
      "warning"
    );

    return;

  }


  try {

    const {
      error
    } =
      await supabaseClient
        .auth
        .updateUser({
          password
        });


    if (
      error
    ) {

      throw error;

    }


    toast(
      "Mot de passe modifié ✅"
    );


  } catch (
    error
  ) {

    handleAuthError(
      error
    );

  }

};


/* ---------------------------------------------------------
   BEST STREAK
   --------------------------------------------------------- */

async function updateBestStreak() {

  if (
    !profile ||
    !session?.user
  ) {

    return;

  }


  const current =
    calculateStreak();


  const stored =
    Number(
      profile.best_streak ||
      0
    );


  if (
    current <=
    stored
  ) {

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "profiles"
        )
        .update({

          best_streak:
            current

        })
        .eq(
          "id",
          session.user.id
        )
        .select()
        .single();


    if (
      error
    ) {

      throw error;

    }


    profile =
      data;


  } catch (
    error
  ) {

    console.warn(
      "Could not update best streak:",
      error
    );

  }

}
/* =========================================================
   PARTIE 10/10 — INITIALISATION + BRANCHEMENT DE L'INTERFACE
   ========================================================= */

/* ---------- Helpers de branchement ---------- */

function onClick(selector, callback) {
  document.querySelectorAll(selector).forEach((element) => {
    element.addEventListener("click", callback);
  });
}

function onChange(selector, callback) {
  document.querySelectorAll(selector).forEach((element) => {
    element.addEventListener("change", callback);
  });
}

function onSubmit(selector, callback) {
  document.querySelectorAll(selector).forEach((element) => {
    element.addEventListener("submit", callback);
  });
}

function valeurInput(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function valeurCheckbox(id) {
  const element = document.getElementById(id);
  return element ? element.checked : false;
}

/* ---------- Navigation ---------- */

function brancherNavigation() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      const page = button.dataset.page;

      if (!page) return;

      // Masquer toutes les pages
      document.querySelectorAll(".app-page").forEach((pageElement) => {
        pageElement.classList.remove("active");
      });

      // Afficher la page demandée
      const targetPage = document.getElementById(`page-${page}`);

      if (!targetPage) {
        console.error(`Page introuvable : page-${page}`);
        return;
      }

      targetPage.classList.add("active");

      // Mettre à jour le bouton actif
      document.querySelectorAll(".nav-button").forEach((navButton) => {
        navButton.classList.remove("active");
      });

      document
        .querySelectorAll(`[data-page="${page}"]`)
        .forEach((navButton) => {
          navButton.classList.add("active");
        });

      // Mémoriser la page actuelle
      pageActuelle = page;

      // Fermer le menu mobile
      const mobileMenu = document.getElementById("mobile-menu");

      if (mobileMenu) {
        mobileMenu.classList.remove("open");
      }

      // Mettre à jour le breadcrumb si la fonction existe
      if (typeof mettreAJourBreadcrumb === "function") {
        mettreAJourBreadcrumb(page);
      }
    });
  });

  const mobileToggle =
    document.getElementById("mobile-menu-button");

  if (mobileToggle) {
    mobileToggle.addEventListener("click", () => {
      const mobileMenu =
        document.getElementById("mobile-menu");

      if (!mobileMenu) return;

      mobileMenu.classList.toggle("open");
    });
  }
}
function montrerPage(page) {
  document.querySelectorAll(".app-page").forEach((pageElement) => {
    pageElement.classList.remove("active");
  });

  const targetPage = document.getElementById(`page-${page}`);

  if (!targetPage) {
    console.error(`Page introuvable : page-${page}`);
    return;
  }

  targetPage.classList.add("active");

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.remove("active");
  });

  document
    .querySelectorAll(`[data-page="${page}"]`)
    .forEach((button) => {
      button.classList.add("active");
    });
}

/* ---------- Authentification ---------- */

function brancherAuthentification() {
  onClick("#show-login-button", () => {
    showLoginView();
  });

  onClick("#show-signup-button", () => {
    showSignupView();
  });

  onClick("#forgot-password-button", async () => {
    await sendPasswordReset();
  });

  onClick("#logout-button", async () => {
    await logoutAccount();
  });

  onSubmit("#login-form", async (event) => {
    event.preventDefault();

    const email = valeurInput("login-email");
    const password = document.getElementById("login-password")?.value || "";

    if (!email || !password) {
      toast("Remplis tous les champs.", "error");
      return;
    }

    await loginAccount(email, password);
  });

  onSubmit("#signup-form", async (event) => {
    event.preventDefault();

    const data = {
      firstName: valeurInput("signup-first-name"),
      lastName: valeurInput("signup-last-name"),
      displayName: valeurInput("signup-display-name"),
      email: valeurInput("signup-email"),
      password:
        document.getElementById("signup-password")?.value || "",
      age: valeurInput("signup-age"),
      birthDate: valeurInput("signup-birth-date"),
      classLevel: valeurInput("signup-class-level"),
      avatar: avatarSelectionne
    };

  await registerAccount();
  });

  onClick("#change-email-button", async () => {
    const email = valeurInput("profile-email");

    if (!email) {
      toast("Entre une adresse e-mail.", "error");
      return;
    }

    await changeEmail(email);
  });

  onClick("#change-password-button", async () => {
    const password =
      document.getElementById("profile-new-password")?.value || "";

    if (!password) {
      toast("Entre un nouveau mot de passe.", "error");
      return;
    }

    await changePassword(password);
  });
}

/* ---------- Profil ---------- */

function brancherProfil() {
  onSubmit("#profile-form", async (event) => {
    event.preventDefault();

    if (!profilActuel) {
      toast("Profil introuvable.", "error");
      return;
    }

    const modifications = {
      first_name: valeurInput("profile-first-name"),
      last_name: valeurInput("profile-last-name"),
      display_name: valeurInput("profile-display-name"),
      age: valeurInput("profile-age")
        ? Number(valeurInput("profile-age"))
        : null,
      birth_date: valeurInput("profile-birth-date") || null,
      class_level: valeurInput("profile-class-level"),
      avatar: avatarSelectionne || profilActuel.avatar
    };

    await saveProfile(modifications);
  });

  onClick("#profile-avatar-button", () => {
    openAvatarPicker("profile");
  });

  onClick("#signup-avatar-button", () => {
    openAvatarPicker("signup");
  });

  onClick("#export-data-button", async () => {
    await exportStudyData();
  });

  onClick("#reset-study-data-button", async () => {
    await resetStudyData();
  });

  onChange("#import-data-file", async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    await importStudyData(file);

    event.target.value = "";
  });
}

/* ---------- Matières ---------- */

function brancherMatieres() {
  onClick("#add-subject-button", () => {
    openSubjectModal();
  });

  onSubmit("#subject-form", async (event) => {
    event.preventDefault();

    await saveSubjectFromForm();
  });
}

/* ---------- Chapitres ---------- */

function brancherChapitres() {
  onClick("#add-chapter-button", () => {
    if (!idMatiereActive) {
      toast("Choisis d'abord une matière.", "error");
      return;
    }

    openChapterModal();
  });

  onSubmit("#chapter-form", async (event) => {
    event.preventDefault();

    await saveChapterFromForm();
  });
}

/* ---------- Matériels ---------- */

function brancherMateriels() {
  onClick("#add-material-button", () => {
    openAddMaterial();
  });

  onClick("#add-material-dashboard-button", () => {
    openAddMaterial();
  });

  onSubmit("#material-form", async (event) => {
    event.preventDefault();

    await saveMaterialFromForm();
  });

  onChange("#material-file", async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      await inspectUploadedFile(file);
    } catch (error) {
      console.error(error);
      toast("Impossible de lire ce fichier.", "error");
    }
  });
}

/* ---------- Révisions ---------- */

function brancherRevisions() {
  onClick("#add-revision-button", () => {
    openRevisionModal();
  });

  onSubmit("#revision-form", async (event) => {
    event.preventDefault();

    await saveRevisionFromForm();
  });
}

/* ---------- Calendrier ---------- */

function brancherCalendrier() {
  onClick("#calendar-prev-button", async () => {
    if (typeof calendrierMoisActuel !== "undefined") {
      calendrierMoisActuel--;
    }

    if (typeof renderCalendar === "function") {
      await renderCalendar();
    }
  });

  onClick("#calendar-next-button", async () => {
    if (typeof calendrierMoisActuel !== "undefined") {
      calendrierMoisActuel++;
    }

    if (typeof renderCalendar === "function") {
      await renderCalendar();
    }
  });

  onClick("#add-calendar-event-button", () => {
    openCalendarEventModal();
  });

  onSubmit("#calendar-event-form", async (event) => {
    event.preventDefault();

    await saveCalendarEventFromForm();
  });
}

/* ---------- To-do ---------- */

function brancherTaches() {
  onClick("#add-task-button", () => {
    openTaskModal();
  });

  onClick("#add-task-dashboard-button", () => {
    openTaskModal();
  });

  onSubmit("#task-form", async (event) => {
    event.preventDefault();

    await saveTaskFromForm();
  });
}

/* ---------- Flashcards ---------- */

function brancherFlashcards() {
  onClick("#add-flashcard-button", () => {
    openManualFlashcardModal();
  });

  onSubmit("#flashcard-form", async (event) => {
    event.preventDefault();

    await saveManualFlashcardFromForm();
  });

  onClick("#flashcard-flip-button", () => {
    if (typeof retournerFlashcard === "function") {
      retournerFlashcard();
    }
  });
}

/* ---------- Quiz ---------- */

function brancherQuiz() {
  onClick("#start-quiz-button", async () => {
    await startQuiz();
  });

  onClick("#restart-quiz-button", () => {
    resetQuiz();
  });

  onClick("#quiz-next-button", () => {
    if (typeof questionSuivanteQuiz === "function") {
      questionSuivanteQuiz();
    }
  });
}

/* ---------- Focus ---------- */

function brancherFocus() {
  onClick("[data-focus-minutes]", (event) => {
    const minutes = Number(event.currentTarget.dataset.focusMinutes);

    if (!Number.isFinite(minutes) || minutes <= 0) return;

    demarrerFocus(minutes);
  });

  onClick("#focus-start-button", () => {
    demarrerFocus(focusMinutes || 25);
  });

  onClick("#focus-pause-button", () => {
    mettrePauseFocus();
  });

  onClick("#focus-stop-button", async () => {
    await arreterFocus();
  });

  onClick("#focus-notification-button", async () => {
    await demanderPermissionNotifications();
  });

  onClick("#focus-fullscreen-button", async () => {
    await activerPleinEcran();
  });

  onClick("#focus-wake-lock-button", async () => {
    await activerWakeLock();
  });
}

/* ---------- Lili ---------- */

function brancherLili() {
  onSubmit("#lili-form", async (event) => {
    event.preventDefault();

    const input = document.getElementById("lili-input");

    if (!input) return;

    const message = input.value.trim();

    if (!message) return;

    input.value = "";

    await sendLiliMessage(message);
  });

  document.querySelectorAll("[data-lili-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = button.dataset.liliPrompt;

      if (!prompt) return;

      await sendLiliMessage(prompt);
    });
  });
}

/* ---------- Study AI ---------- */

function brancherStudyAI() {
  document.querySelectorAll("[data-ai-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.aiAction;

      if (!action) return;

      await executerActionStudyAI(action);
    });
  });

  onSubmit("#study-ai-form", async (event) => {
    event.preventDefault();

    const prompt = valeurInput("study-ai-input");

    if (!prompt) return;

    await askStudyAI(prompt);
  });
}

/* ---------- Modales ---------- */

function brancherModales() {
  onClick("#modal-close", () => {
    closeModal();
  });

  onClick("#modal-cancel", () => {
    closeModal();
  });

  onClick("#modal-overlay", (event) => {
    if (event.target.id === "modal-overlay") {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

/* ---------- Filtres ---------- */

function brancherFiltres() {
  onChange("#material-filter-subject", async () => {
    await renderMaterials();
  });

  onChange("#material-filter-type", async () => {
    await renderMaterials();
  });

  onChange("#revision-filter", async () => {
    await renderRevisions();
  });

  onChange("#stats-period", async () => {
    await renderStats();
  });

  onChange("#friend-class-filter", async () => {
    await renderFriends();
  });

  const searchMaterials = document.getElementById("material-search");

  if (searchMaterials) {
    searchMaterials.addEventListener("input", async () => {
      await renderMaterials();
    });
  }
}

/* ---------- Amis ---------- */

function brancherAmis() {
  onSubmit("#friend-search-form", async (event) => {
    event.preventDefault();

    const search = valeurInput("friend-search");

    if (!search) {
      toast("Entre un nom ou un surnom.", "error");
      return;
    }

    await searchFriendProfile(search);
  });

  onClick("#refresh-friends-button", async () => {
    await renderFriends();
  });
}


/* ---------- Rendu initial ---------- */

async function rafraichirInterfaceComplete() {
  try {
    if (typeof renderTopUser === "function") {
      renderTopUser();
    }

    if (typeof renderDashboard === "function") {
      await renderDashboard();
    }

    if (typeof renderSubjects === "function") {
      await renderSubjects();
    }

    if (typeof renderMaterials === "function") {
      await renderMaterials();
    }

    if (typeof renderRevisions === "function") {
      await renderRevisions();
    }

    if (typeof renderCalendar === "function") {
      await renderCalendar();
    }

    if (typeof renderTasks === "function") {
      await renderTasks();
    }

    if (typeof renderFlashcards === "function") {
      await renderFlashcards();
    }

    if (typeof renderQuiz === "function") {
      await renderQuiz();
    }

    if (typeof renderStats === "function") {
      await renderStats();
    }

    if (typeof renderRewards === "function") {
      await renderRewards();
    }

    if (typeof renderFriends === "function") {
      await renderFriends();
    }

    if (typeof renderProfile === "function") {
      await renderProfile();
    }

    // Administration
    if (typeof verifierEtAfficherAdmin === "function") {
      await verifierEtAfficherAdmin();
    }

    if (typeof brancherAdmin === "function") {
      brancherAdmin();
    }

  } catch (error) {
    console.error(
      "Erreur pendant le rendu initial :",
      error
    );
  }
}
// ============================================================
// ADMIN — DÉTECTION + STATISTIQUES
// ============================================================

async function verifierEtAfficherAdmin() {
  const boutonAdmin = document.getElementById("admin-nav-button");

  if (!boutonAdmin) return;

  try {
    const { data, error } = await supabaseClient.rpc("est_admin");

    if (error) {
      console.error("Erreur vérification Admin :", error);
      boutonAdmin.style.display = "none";
      return;
    }

    const estAdmin = data === true;

    boutonAdmin.style.display = estAdmin ? "" : "none";

   if (estAdmin) {
  await chargerStatistiquesAdmin();
  await chargerUtilisateursAdmin();
}

  } catch (error) {
    console.error("Erreur Admin :", error);
    boutonAdmin.style.display = "none";
  }
}


async function chargerStatistiquesAdmin() {
  try {
    const { data, error } = await supabaseClient.rpc(
      "admin_get_stats"
    );

    if (error) {
      console.error("Erreur statistiques Admin :", error);
      return;
    }

    if (!data) return;

    mettreAJourStatAdmin(
      "admin-stat-users",
      data.users_total
    );

    mettreAJourStatAdmin(
      "admin-stat-premium",
      data.premium_users
    );

    mettreAJourStatAdmin(
      "admin-stat-free",
      data.free_users
    );

    mettreAJourStatAdmin(
      "admin-stat-active",
      data.users_active_today
    );

    mettreAJourStatAdmin(
      "admin-stat-subjects",
      data.subjects_total
    );

    mettreAJourStatAdmin(
      "admin-stat-flashcards",
      data.flashcards_total
    );

    mettreAJourStatAdmin(
      "admin-stat-quizzes",
      data.quiz_attempts_total
    );

    mettreAJourStatAdmin(
      "admin-stat-focus",
      data.focus_minutes_total
    );

    mettreAJourStatAdmin(
      "admin-stat-chapters",
      data.chapters_total
    );

    mettreAJourStatAdmin(
      "admin-stat-materials",
      data.materials_total
    );

    mettreAJourStatAdmin(
      "admin-stat-revisions",
      data.revisions_total
    );

    mettreAJourStatAdmin(
      "admin-stat-xp",
      data.xp_total
    );

    mettreAJourStatAdmin(
      "admin-stat-garden",
      data.garden_placed_blocks_total
    );

    mettreAJourStatAdmin(
      "admin-stat-tasks",
      data.tasks_completed
    );

  } catch (error) {
    console.error(
      "Erreur chargement statistiques Admin :",
      error
    );
  }
}
// ============================================================
// ADMIN — GESTION DES UTILISATEURS
// ============================================================

let utilisateursAdmin = [];


async function chargerUtilisateursAdmin() {
  const liste = document.getElementById("admin-users-list");

  if (!liste) return;

  liste.innerHTML = `
    <div class="admin-loading">
      Chargement des utilisateurs…
    </div>
  `;

  try {
    const { data, error } = await supabaseClient.rpc(
      "admin_get_users"
    );

    if (error) {
      console.error(
        "Erreur chargement utilisateurs Admin :",
        error
      );

      liste.innerHTML = `
        <div class="admin-error">
          Impossible de charger les utilisateurs.
        </div>
      `;

      return;
    }

    utilisateursAdmin = data || [];

    afficherUtilisateursAdmin();

  } catch (error) {
    console.error(
      "Erreur utilisateurs Admin :",
      error
    );

    liste.innerHTML = `
      <div class="admin-error">
        Une erreur est survenue.
      </div>
    `;
  }
}


function afficherUtilisateursAdmin() {
  const liste = document.getElementById(
    "admin-users-list"
  );

  const recherche = (
    document.getElementById(
      "admin-user-search"
    )?.value || ""
  )
    .trim()
    .toLowerCase();

  if (!liste) return;

  const utilisateursFiltres =
    utilisateursAdmin.filter((user) => {

      const texte = [
        user.email,
        user.first_name,
        user.last_name,
        user.display_name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texte.includes(recherche);
    });


  if (utilisateursFiltres.length === 0) {
    liste.innerHTML = `
      <div class="admin-empty">
        Aucun utilisateur trouvé.
      </div>
    `;

    return;
  }


  liste.innerHTML = utilisateursFiltres
    .map((user) => {

      const nom =
        user.display_name ||
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        "Utilisateur";

      const planPremium =
        user.plan === "premium";

      const avatar =
        user.avatar || "🌸";

      const xp =
        Number(user.xp || 0).toLocaleString("fr-FR");

      const credits =
        planPremium
          ? "∞"
          : Number(
              user.ai_credits || 0
            ).toLocaleString("fr-FR");

      const dateInscription =
        user.created_at
          ? new Date(
              user.created_at
            ).toLocaleDateString(
              "fr-FR"
            )
          : "—";


      return `
        <article
          class="admin-user-card"
          data-user-id="${user.user_id}"
        >

          <div class="admin-user-main">

            <div class="admin-user-avatar">
              ${avatar}
            </div>

            <div class="admin-user-info">

              <strong>
                ${echapperHTML(nom)}
              </strong>

              <span>
                ${echapperHTML(user.email || "Email inconnu")}
              </span>

              <small>
                Inscrit le ${dateInscription}
              </small>

            </div>

          </div>


          <div class="admin-user-stats">

            <div>
              <span>Plan</span>
              <strong class="${
                planPremium
                  ? "admin-plan-premium"
                  : "admin-plan-free"
              }">
                ${
                  planPremium
                    ? "PREMIUM"
                    : "FREE"
                }
              </strong>
            </div>

            <div>
              <span>XP</span>
              <strong>${xp}</strong>
            </div>

            <div>
              <span>Streak</span>
              <strong>
                ${Number(user.best_streak || 0)}
              </strong>
            </div>

            <div>
              <span>Crédits IA</span>
              <strong>${credits}</strong>
            </div>

          </div>


          <div class="admin-user-actions">

            ${
              planPremium
                ? `
                  <button
                    type="button"
                    class="admin-action-button danger"
                    data-admin-action="remove-premium"
                    data-user-id="${user.user_id}"
                  >
                    Retirer Premium
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="admin-action-button premium"
                    data-admin-action="give-premium"
                    data-user-id="${user.user_id}"
                  >
                    Donner Premium
                  </button>
                `
            }

            <button
              type="button"
              class="admin-action-button"
              data-admin-action="add-xp"
              data-user-id="${user.user_id}"
            >
              + XP
            </button>

            <button
              type="button"
              class="admin-action-button"
              data-admin-action="add-credits"
              data-user-id="${user.user_id}"
            >
              + crédits
            </button>

            <button
              type="button"
              class="admin-action-button"
              data-admin-action="reward"
              data-user-id="${user.user_id}"
            >
              Récompense
            </button>

          </div>

        </article>
      `;

    })
    .join("");
}

async function gererActionPremium(userId, donnerPremium) {
  try {
    const fonction = donnerPremium
      ? "admin_give_premium"
      : "admin_remove_premium";

    const { error } = await supabaseClient.rpc(fonction, {
      target_user_id: userId
    });

    if (error) {
      console.error("Erreur action Premium :", error);
      alert(error.message || "Impossible de modifier le Premium.");
      return;
    }

    await chargerUtilisateursAdmin();
    await chargerStatistiquesAdmin();

  } catch (error) {
    console.error("Erreur Premium :", error);
    alert("Une erreur est survenue.");
  }
}
async function ajouterXPAdmin(userId) {
  const valeur = prompt("Combien d'XP donner à cet utilisateur ?");

  if (valeur === null) return;

  const montant = Number(valeur);

  if (!Number.isInteger(montant) || montant <= 0) {
    alert("Entre un nombre entier positif.");
    return;
  }

  const { error } = await supabaseClient.rpc(
    "admin_add_xp",
    {
      target_user_id: userId,
      amount: montant
    }
  );

  if (error) {
    console.error("Erreur ajout XP :", error);
    alert(error.message || "Impossible d'ajouter l'XP.");
    return;
  }

  await chargerUtilisateursAdmin();
  await chargerStatistiquesAdmin();
}


async function ajouterCreditsAdmin(userId) {
  const valeur = prompt("Combien de crédits IA donner à cet utilisateur ?");

  if (valeur === null) return;

  const montant = Number(valeur);

  if (!Number.isInteger(montant) || montant <= 0) {
    alert("Entre un nombre entier positif.");
    return;
  }

  const { error } = await supabaseClient.rpc(
    "admin_add_ai_credits",
    {
      target_user_id: userId,
      amount: montant
    }
  );

  if (error) {
    console.error("Erreur ajout crédits :", error);
    alert(error.message || "Impossible d'ajouter les crédits.");
    return;
  }

  await chargerUtilisateursAdmin();
}
async function donnerRecompenseAdmin(userId) {
  const nom = prompt(
    "Nom de la récompense à donner à cet utilisateur :"
  );

  if (nom === null) return;

  const recompense = nom.trim();

  if (!recompense) {
    alert("Entre un nom de récompense.");
    return;
  }

  const { error } = await supabaseClient.rpc(
    "admin_give_reward",
    {
      target_user_id: userId,
      reward_name: recompense
    }
  );

  if (error) {
    console.error("Erreur récompense :", error);
    alert(error.message || "Impossible de donner la récompense.");
    return;
  }

  alert("Récompense donnée avec succès.");
}
function echapperHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function brancherActionsUtilisateursAdmin() {
  const liste = document.getElementById("admin-users-list");

  if (!liste || liste.dataset.actionsBound === "true") return;

  liste.dataset.actionsBound = "true";

  liste.addEventListener("click", async (event) => {
    const bouton = event.target.closest(
      "[data-admin-action]"
    );

    if (!bouton) return;

    const action = bouton.dataset.adminAction;
    const userId = bouton.dataset.userId;

    if (!userId) return;

    if (action === "give-premium") {
      const confirmer = confirm(
        "Donner Premium à cet utilisateur ?"
      );

      if (!confirmer) return;

      bouton.disabled = true;

      await gererActionPremium(userId, true);

      bouton.disabled = false;
    }

    if (action === "remove-premium") {
      const confirmer = confirm(
        "Retirer Premium à cet utilisateur ?"
      );
       if (action === "add-xp") {
  bouton.disabled = true;

  await ajouterXPAdmin(userId);

  bouton.disabled = false;
}

if (action === "add-credits") {
  bouton.disabled = true;

  await ajouterCreditsAdmin(userId);

  bouton.disabled = false;
   if (action === "reward") {
  bouton.disabled = true;

  await donnerRecompenseAdmin(userId);

  bouton.disabled = false;
}
}

      if (!confirmer) return;

      bouton.disabled = true;

      await gererActionPremium(userId, false);

      bouton.disabled = false;
    }
  });
}
function mettreAJourStatAdmin(id, valeur) {
  const element = document.getElementById(id);

  if (!element) return;

  if (valeur === null || valeur === undefined) {
    element.textContent = "0";
    return;
  }

  element.textContent = Number(valeur).toLocaleString("fr-FR");
}


// ============================================================
// BOUTON ACTUALISER
// ============================================================

function brancherAdmin() {
  // Actualiser les statistiques
  const boutonStats = document.getElementById("admin-refresh-stats");

  if (boutonStats && !boutonStats.dataset.bound) {
    boutonStats.dataset.bound = "true";

    boutonStats.addEventListener("click", async () => {
      boutonStats.disabled = true;
      boutonStats.textContent = "Actualisation…";

      await chargerStatistiquesAdmin();

      boutonStats.disabled = false;
      boutonStats.textContent = "Actualiser";
    });
  }

  // Actualiser les utilisateurs
  const boutonUsers = document.getElementById("admin-refresh-users");

  if (boutonUsers && !boutonUsers.dataset.bound) {
    boutonUsers.dataset.bound = "true";

    boutonUsers.addEventListener("click", async () => {
      boutonUsers.disabled = true;
      boutonUsers.textContent = "Actualisation…";

      await chargerUtilisateursAdmin();

      boutonUsers.disabled = false;
      boutonUsers.textContent = "Actualiser";
    });
  }

  // Recherche utilisateur
  const recherche = document.getElementById("admin-user-search");

    if (recherche && !recherche.dataset.bound) {
    recherche.dataset.bound = "true";

    recherche.addEventListener("input", () => {
      afficherUtilisateursAdmin();
    });
  }

  brancherActionsUtilisateursAdmin();
}
/* ---------- Sécurité interface ---------- */

function verifierConnexionAvantAction(callback) {
  return async (...args) => {
    if (!sessionActuelle || !utilisateurActuel) {
      showAuthScreen();
      toast("Connecte-toi pour continuer.", "error");
      return;
    }

    return await callback(...args);
  };
}

/* ---------- Mise à jour automatique du nom ---------- */

function synchroniserProfilInterface() {
  if (!profilActuel) return;

  const displayName =
    profilActuel.display_name ||
    profilActuel.first_name ||
    "Étudiant";

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = displayName;
  });

  document.querySelectorAll("[data-user-avatar]").forEach((element) => {
    element.textContent = profilActuel.avatar || "🌸";
  });

  renderTopUser();
}

/* ---------- Gestion de visibilité Focus ---------- */

document.addEventListener("visibilitychange", () => {
  if (
    document.hidden &&
    typeof focusEnCours !== "undefined" &&
    focusEnCours
  ) {
    console.log("Onglet masqué pendant une session Focus.");
  }
});

/* ---------- Initialisation générale ---------- */

async function initialiserApplication() {
  try {
    brancherNavigation();
    brancherAuthentification();
    brancherProfil();
    brancherMatieres();
    brancherChapitres();
    brancherMateriels();
    brancherRevisions();
    brancherCalendrier();
    brancherTaches();
    brancherFlashcards();
    brancherQuiz();
    brancherFocus();
    brancherLili();
    brancherStudyAI();
    brancherModales();
    brancherFiltres();
    brancherAmis();

    /* Ferme le menu mobile lorsqu'on redimensionne */
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) {
        document
          .getElementById("mobile-menu")
          ?.classList.remove("open");
      }
    });

    /* Raccourci clavier Focus */
    document.addEventListener("keydown", (event) => {
      if (
        event.key.toLowerCase() === "f" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !["INPUT", "TEXTAREA"].includes(
          document.activeElement?.tagName
        )
      ) {
        const focusButton = document.querySelector(
          '[data-page="focus"]'
        );

        if (focusButton) {
          focusButton.click();
        }
      }
    });

    /* Affichage initial */
    if (typeof montrerPage === "function") {
      montrerPage(pageActuelle);
    }

    /* Auth Supabase */
    await initializeAuthentication();

    if (sessionActuelle && utilisateurActuel) {
      synchroniserProfilInterface();
      await rafraichirInterfaceComplete();
    }

    window.studyPlannerInitialized = true;

    console.log("✅ STUDY PLANNER initialisé.");
  } catch (error) {
    console.error("❌ Erreur d'initialisation :", error);

    toast(
      "Une erreur est survenue pendant le chargement de STUDY PLANNER.",
      "error"
    );
  }
}

/* ---------- Protection des boutons avant chargement ---------- */

window.addEventListener("beforeunload", () => {
  try {
    if (typeof wakeLockSentinel !== "undefined" && wakeLockSentinel) {
      wakeLockSentinel.release();
    }
  } catch (error) {
    console.warn("Wake Lock :", error);
  }
});

/* ---------- Lancement ---------- */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initialiserApplication,
    { once: true }
  );
} else {
  initialiserApplication();
}
/* =========================================================
   AMELIORATIONS — FICHIERS DE LEÇON + EDITEUR + LANGUES
   ========================================================= */

/* =========================================================
   1. TYPES DE FICHIERS
   ========================================================= */

const TYPES_FICHIERS_ETUDE = {
  notes: {
    label: "Notes",
    icon: "📝"
  },

  resume_detaille: {
    label: "Résumé détaillé",
    icon: "📚"
  },

  resume_examen: {
    label: "Résumé pour l'examen",
    icon: "🎯"
  },

  flashcards: {
    label: "Flashcards",
    icon: "🧠"
  },

  quiz: {
    label: "Quiz",
    icon: "❓"
  },

  test: {
    label: "Test",
    icon: "📝"
  },

  mindmap: {
    label: "Carte mentale",
    icon: "🗺️"
  },

  podcast: {
    label: "Podcast",
    icon: "🎧"
  }
};


const ICONES_FICHIERS = {
  notes: "📝",
  resume_detaille: "📚",
  resume_examen: "🎯",
  flashcards: "🧠",
  quiz: "❓",
  test: "📝",
  mindmap: "🗺️",
  podcast: "🎧",
  pdf: "📄",
  word: "📘",
  powerpoint: "📊",
  image: "🖼️",
  youtube: "▶️"
};


/* =========================================================
   2. OUTILS HTML
   ========================================================= */

function nettoyerHTML(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";

  const elements = template.content.querySelectorAll("*");

  elements.forEach((element) => {
    const attributs = [...element.attributes];

    attributs.forEach((attribut) => {
      const nom = attribut.name.toLowerCase();
      const valeur = attribut.value;

      /* Suppression des attributs dangereux */
      if (
        nom.startsWith("on") ||
        nom === "srcdoc" ||
        nom === "formaction"
      ) {
        element.removeAttribute(attribut.name);
        return;
      }

      if (
        (nom === "href" || nom === "src") &&
        valeur.toLowerCase().startsWith("javascript:")
      ) {
        element.removeAttribute(attribut.name);
      }
    });

    /* On ne conserve que les balises utiles à l'étude */
    const balisesAutorisees = [
      "P",
      "BR",
      "STRONG",
      "B",
      "EM",
      "I",
      "U",
      "MARK",
      "H2",
      "H3",
      "UL",
      "OL",
      "LI",
      "BLOCKQUOTE",
      "SPAN",
      "DIV"
    ];

    if (!balisesAutorisees.includes(element.tagName)) {
      const fragment = document.createDocumentFragment();

      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }

      element.replaceWith(fragment);
    }
  });

  return template.innerHTML;
}


function texteVersHTML(texte) {
  if (!texte) return "<p></p>";

  const lignes = String(texte)
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter(Boolean);

  if (!lignes.length) return "<p></p>";

  return lignes
    .map((ligne) => `<p>${escapeHTML(ligne)}</p>`)
    .join("");
}


/* =========================================================
   3. CREER UN FICHIER DANS UNE LEÇON
   ========================================================= */

async function creerFichierEtude({
  chapterId,
  title,
  type,
  content,
  sourceMaterialId = null
}) {
  if (!utilisateurActuel) {
    throw new Error("Utilisateur non connecté.");
  }

  if (!chapterId) {
    throw new Error("Aucune leçon/chapter sélectionné.");
  }

  const contenuFinal =
    typeof content === "string"
      ? nettoyerHTML(content)
      : JSON.stringify(content, null, 2);

  const { data, error } = await supabaseClient
    .from("materiels")
    .insert({
      user_id: utilisateurActuel.id,
      chapitre_id: chapterId,
      type,
      titre: title,
      contenu: contenuFinal
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur création fichier :", error);
    throw error;
  }

  DATA.materials.push(data);

  await renderMaterials();

  toast(`"${title}" a été enregistré dans la leçon.`, "success");

  return data;
}


/* =========================================================
   4. TROUVER LA LEÇON D'UN MATÉRIEL
   ========================================================= */

function trouverChapitreDuMateriel(material) {
  if (!material) return null;

  return (
    DATA.chapters.find(
      (chapter) => chapter.id === material.chapitre_id
    ) || null
  );
}


/* =========================================================
   5. EDITEUR RICHE
   ========================================================= */

function executerFormatEditeur(commande, valeur = null) {
  const editor = document.getElementById("rich-material-editor");

  if (!editor) return;

  editor.focus();

  try {
    document.execCommand(commande, false, valeur);
  } catch (error) {
    console.error("Erreur formatage :", error);
  }
}


function insererSurlignage() {
  const editor = document.getElementById("rich-material-editor");

  if (!editor) return;

  editor.focus();

  try {
    document.execCommand(
      "hiliteColor",
      false,
      "#fff3a8"
    );
  } catch (error) {
    try {
      document.execCommand(
        "backColor",
        false,
        "#fff3a8"
      );
    } catch (secondError) {
      console.error(secondError);
    }
  }
}


function ouvrirEditeurMateriel(material) {
  if (!material) {
    toast("Fichier introuvable.", "error");
    return;
  }

  const type = material.type || "notes";

  /*
   * Les fichiers flashcards et quiz possèdent
   * leur propre interface.
   */
  if (type === "flashcards") {
    ouvrirFichierFlashcards(material);
    return;
  }

  if (type === "quiz") {
    ouvrirFichierQuiz(material);
    return;
  }

  let contenu = material.contenu || "";

  /*
   * Si le contenu n'est pas encore du HTML,
   * on le transforme automatiquement.
   */
  if (
    !contientBaliseHTML(contenu)
  ) {
    contenu = texteVersHTML(contenu);
  }

  const typeLabel =
    TYPES_FICHIERS_ETUDE[type]?.label ||
    type;

  const titre = escapeHTML(material.titre || "Document");

  openModal(`
    <div class="rich-editor-modal">

      <div class="rich-editor-header">
        <div>
          <div class="rich-editor-kicker">
            ${ICONES_FICHIERS[type] || "📄"} ${escapeHTML(typeLabel)}
          </div>

          <input
            id="rich-material-title"
            class="rich-editor-title"
            value="${titre}"
            maxlength="150"
          />
        </div>

        <button
          type="button"
          class="icon-button"
          onclick="closeModal()"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>


      <div class="rich-editor-toolbar">

        <button
          type="button"
          onclick="executerFormatEditeur('bold')"
          title="Gras"
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          onclick="executerFormatEditeur('italic')"
          title="Italique"
        >
          <em>I</em>
        </button>

        <button
          type="button"
          onclick="executerFormatEditeur('underline')"
          title="Souligner"
        >
          <u>U</u>
        </button>

        <button
          type="button"
          onclick="insererSurlignage()"
          title="Surligner"
        >
          🖍️
        </button>

        <span class="editor-divider"></span>

        <button
          type="button"
          onclick="executerFormatEditeur('formatBlock', '<h2>')"
          title="Titre"
        >
          H2
        </button>

        <button
          type="button"
          onclick="executerFormatEditeur('formatBlock', '<h3>')"
          title="Sous-titre"
        >
          H3
        </button>

        <button
          type="button"
          onclick="executerFormatEditeur('insertUnorderedList')"
          title="Liste"
        >
          •
        </button>

        <button
          type="button"
          onclick="executerFormatEditeur('insertOrderedList')"
          title="Liste numérotée"
        >
          1.
        </button>

        <button
          type="button"
          onclick="executerFormatEditeur('removeFormat')"
          title="Supprimer le formatage"
        >
          Tx
        </button>

      </div>


      <div
        id="rich-material-editor"
        class="rich-material-editor"
        contenteditable="true"
        spellcheck="true"
      >${contenu}</div>


      <div class="rich-editor-footer">

        <span class="editor-save-info">
          Tes modifications seront enregistrées dans ce fichier.
        </span>

        <div class="editor-footer-actions">

          <button
            type="button"
            class="secondary-button"
            onclick="closeModal()"
          >
            Annuler
          </button>

          <button
            type="button"
            class="primary-button"
            onclick="enregistrerMaterielEdite('${material.id}')"
          >
            💾 Enregistrer
          </button>

        </div>

      </div>

    </div>
  `);
}


function contientBaliseHTML(texte) {
  return /<([a-z][\s\S]*?)>/i.test(texte || "");
}


async function enregistrerMaterielEdite(materialId) {
  const material = DATA.materials.find(
    (item) => item.id === materialId
  );

  if (!material) {
    toast("Fichier introuvable.", "error");
    return;
  }

  const editor =
    document.getElementById("rich-material-editor");

  const titleInput =
    document.getElementById("rich-material-title");

  if (!editor || !titleInput) return;

  const nouveauTitre =
    titleInput.value.trim() || material.titre;

  const nouveauContenu =
    nettoyerHTML(editor.innerHTML);

  try {
    const { data, error } = await supabaseClient
      .from("materiels")
      .update({
        titre: nouveauTitre,
        contenu: nouveauContenu
      })
      .eq("id", materialId)
      .eq("user_id", utilisateurActuel.id)
      .select()
      .single();

    if (error) throw error;

    const index = DATA.materials.findIndex(
      (item) => item.id === materialId
    );

    if (index !== -1) {
      DATA.materials[index] = data;
    }

    closeModal();
    await renderMaterials();

    toast("Fichier enregistré ✨", "success");
  } catch (error) {
    console.error(error);

    toast(
      "Impossible d'enregistrer les modifications.",
      "error"
    );
  }
}


/* =========================================================
   6. RESUME DETAILLE
   ========================================================= */

async function genererResumeEtFichier(materialId, mode) {
  const material = DATA.materials.find(
    (item) => item.id === materialId
  );

  if (!material) {
    toast("Cours introuvable.", "error");
    return;
  }

  const chapter = trouverChapitreDuMateriel(material);

  if (!chapter) {
    toast("Le cours n'est rattaché à aucune leçon.", "error");
    return;
  }

  const estExamen = mode === "examen";

  const titre = estExamen
    ? `Résumé examen — ${material.titre}`
    : `Résumé détaillé — ${material.titre}`;

  const consigne = estExamen
    ? `
Crée un résumé spécialement conçu pour préparer un examen.

Le résumé doit :
- garder uniquement les notions importantes ;
- faire ressortir les définitions ;
- faire ressortir les dates, formules, règles ou mots-clés utiles ;
- signaler les pièges ou confusions fréquentes ;
- être structuré avec des titres et des listes ;
- être facile à relire rapidement avant un contrôle.

Cours :
${material.contenu}
`
    : `
Crée un résumé détaillé et structuré du cours.

Le résumé doit :
- expliquer toutes les notions importantes ;
- conserver les informations utiles ;
- organiser les idées avec des titres et sous-titres ;
- utiliser des listes quand cela améliore la compréhension ;
- rester clair et facile à apprendre.

Cours :
${material.contenu}
`;

  try {
    toast(
      estExamen
        ? "Lili prépare ton résumé examen…"
        : "Lili prépare ton résumé détaillé…",
      "info"
    );

    const resultat =
      await demanderIAEtRecupererTexte(
        consigne,
        material
      );

    if (!resultat) {
      throw new Error("Réponse IA vide.");
    }

    const fichier = await creerFichierEtude({
      chapterId: chapter.id,
      title: titre,
      type: estExamen
        ? "resume_examen"
        : "resume_detaille",
      content: texteVersHTML(resultat),
      sourceMaterialId: material.id
    });

    return fichier;
  } catch (error) {
    console.error(error);

    toast(
      "Impossible de créer le résumé.",
      "error"
    );
  }
}


/* =========================================================
   7. IA — APPEL CENTRAL
   ========================================================= */

async function demanderIAEtRecupererTexte(prompt, material = null) {
  if (!supabaseClient || !utilisateurActuel) {
    throw new Error("Utilisateur non connecté.");
  }

  const { data, error } =
    await supabaseClient.functions.invoke(
      "lili",
      {
        body: {
          action: "study_ai",
          prompt,
          material,
          language: langueActuelle
        }
      }
    );

  if (error) {
    console.error("Erreur Lili :", error);
    throw error;
  }

  return (
    data?.result ||
    data?.text ||
    data?.output ||
    data?.response ||
    data?.message ||
    ""
  );
}


/* =========================================================
   8. FLASHCARDS ENREGISTREES COMME FICHIER
   ========================================================= */

function extraireJSONDepuisTexte(texte) {
  if (!texte) return null;

  let propre = texte
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(propre);
  } catch (_) {}

  const debutTableau = propre.indexOf("[");
  const finTableau = propre.lastIndexOf("]");

  if (
    debutTableau !== -1 &&
    finTableau !== -1 &&
    finTableau > debutTableau
  ) {
    try {
      return JSON.parse(
        propre.slice(
          debutTableau,
          finTableau + 1
        )
      );
    } catch (_) {}
  }

  return null;
}


async function genererFlashcardsEtFichier(materialId) {
  const material = DATA.materials.find(
    (item) => item.id === materialId
  );

  if (!material) {
    toast("Cours introuvable.", "error");
    return;
  }

  const chapter = trouverChapitreDuMateriel(material);

  if (!chapter) {
    toast("Le cours n'a pas de leçon.", "error");
    return;
  }

  const prompt = `
Crée 10 flashcards à partir du cours ci-dessous.

Retourne UNIQUEMENT un tableau JSON valide.

Format exact :
[
  {
    "question": "Question",
    "answer": "Réponse"
  }
]

Les questions doivent tester les notions importantes du cours.

Cours :
${material.contenu}
`;

  try {
    toast("Lili crée tes flashcards…", "info");

    const texte =
      await demanderIAEtRecupererTexte(
        prompt,
        material
      );

    const cards = extraireJSONDepuisTexte(texte);

    if (!Array.isArray(cards) || !cards.length) {
      throw new Error(
        "Format de flashcards invalide."
      );
    }

    const fichier = await creerFichierEtude({
      chapterId: chapter.id,
      title: `Flashcards — ${material.titre}`,
      type: "flashcards",
      content: cards
    });

    return fichier;
  } catch (error) {
    console.error(error);

    toast(
      "Impossible de créer les flashcards.",
      "error"
    );
  }
}


/* =========================================================
   9. QUIZ ENREGISTRE COMME FICHIER
   ========================================================= */

async function genererQuizEtFichier(materialId) {
  const material = DATA.materials.find(
    (item) => item.id === materialId
  );

  if (!material) {
    toast("Cours introuvable.", "error");
    return;
  }

  const chapter = trouverChapitreDuMateriel(material);

  if (!chapter) {
    toast("Le cours n'a pas de leçon.", "error");
    return;
  }

  const prompt = `
Crée un quiz de 10 questions basé sur ce cours.

Retourne UNIQUEMENT un tableau JSON valide.

Format exact :
[
  {
    "question": "Question",
    "choices": [
      "Réponse A",
      "Réponse B",
      "Réponse C",
      "Réponse D"
    ],
    "correct": 0,
    "explanation": "Courte explication"
  }
]

"correct" doit être l'index de la bonne réponse.

Cours :
${material.contenu}
`;

  try {
    toast("Lili crée ton quiz…", "info");

    const texte =
      await demanderIAEtRecupererTexte(
        prompt,
        material
      );

    const questions =
      extraireJSONDepuisTexte(texte);

    if (
      !Array.isArray(questions) ||
      !questions.length
    ) {
      throw new Error(
        "Format de quiz invalide."
      );
    }

    const fichier = await creerFichierEtude({
      chapterId: chapter.id,
      title: `Quiz — ${material.titre}`,
      type: "quiz",
      content: questions
    });

    return fichier;
  } catch (error) {
    console.error(error);

    toast(
      "Impossible de créer le quiz.",
      "error"
    );
  }
}


/* =========================================================
   10. OUVRIR UN FICHIER FLASHCARDS
   ========================================================= */

function ouvrirFichierFlashcards(material) {
  let cards;

  try {
    cards = JSON.parse(material.contenu);
  } catch (error) {
    toast(
      "Ce fichier de flashcards est incorrect.",
      "error"
    );
    return;
  }

  if (!Array.isArray(cards)) {
    toast("Aucune flashcard trouvée.", "error");
    return;
  }

  let index = 0;
  let retournee = false;

  function afficher() {
    const card = cards[index];

    if (!card) {
      closeModal();
      toast("Flashcards terminées 🎉", "success");
      return;
    }

    openModal(`
      <div class="study-file-player">

        <div class="study-file-player-top">
          <span>🧠 Flashcards</span>
          <span>${index + 1} / ${cards.length}</span>
        </div>

        <div
          class="flashcard-player-card ${retournee ? "flipped" : ""}"
          id="saved-flashcard-card"
        >
          <div class="flashcard-side">
            ${
              retournee
                ? escapeHTML(card.answer || "")
                : escapeHTML(card.question || "")
            }
          </div>
        </div>

        <button
          type="button"
          class="secondary-button full-width"
          id="saved-flashcard-flip"
        >
          ${
            retournee
              ? "Voir la question"
              : "Voir la réponse"
          }
        </button>

        <div class="study-file-navigation">
          <button
            type="button"
            class="secondary-button"
            id="saved-flashcard-previous"
            ${index === 0 ? "disabled" : ""}
          >
            ← Précédente
          </button>

          <button
            type="button"
            class="primary-button"
            id="saved-flashcard-next"
          >
            ${
              index === cards.length - 1
                ? "Terminer"
                : "Suivante →"
            }
          </button>
        </div>

      </div>
    `);

    document
      .getElementById("saved-flashcard-flip")
      ?.addEventListener("click", () => {
        retournee = !retournee;
        afficher();
      });

    document
      .getElementById("saved-flashcard-next")
      ?.addEventListener("click", () => {
        index++;
        retournee = false;
        afficher();
      });

    document
      .getElementById("saved-flashcard-previous")
      ?.addEventListener("click", () => {
        if (index <= 0) return;

        index--;
        retournee = false;
        afficher();
      });
  }

  afficher();
}


/* =========================================================
   11. OUVRIR UN QUIZ ENREGISTRE
   ========================================================= */

function ouvrirFichierQuiz(material) {
  let questions;

  try {
    questions = JSON.parse(material.contenu);
  } catch (error) {
    toast(
      "Ce fichier de quiz est incorrect.",
      "error"
    );
    return;
  }

  if (!Array.isArray(questions)) {
    toast("Aucune question trouvée.", "error");
    return;
  }

  let index = 0;
  let score = 0;
  let termine = false;

  function afficherQuestion() {
    if (termine) {
      openModal(`
        <div class="quiz-result-screen">

          <div class="quiz-result-icon">🎉</div>

          <h2>Quiz terminé !</h2>

          <div class="quiz-score">
            ${score} / ${questions.length}
          </div>

          <p>
            ${
              score === questions.length
                ? "Parfait !"
                : score >= questions.length / 2
                  ? "Bien joué !"
                  : "Continue à réviser, tu progresses !"
            }
          </p>

          <button
            type="button"
            class="primary-button"
            onclick="closeModal()"
          >
            Fermer
          </button>

        </div>
      `);

      return;
    }

    const q = questions[index];

    const choices = Array.isArray(q.choices)
      ? q.choices
      : [];

    openModal(`
      <div class="saved-quiz-player">

        <div class="study-file-player-top">
          <span>❓ Quiz</span>
          <span>${index + 1} / ${questions.length}</span>
        </div>

        <h2>
          ${escapeHTML(q.question || "")}
        </h2>

        <div class="saved-quiz-choices">
          ${choices
            .map(
              (choice, choiceIndex) => `
                <button
                  type="button"
                  class="quiz-choice-button"
                  data-saved-choice="${choiceIndex}"
                >
                  ${escapeHTML(choice)}
                </button>
              `
            )
            .join("")}
        </div>

      </div>
    `);

    document
      .querySelectorAll("[data-saved-choice]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const selected = Number(
            button.dataset.savedChoice
          );

          document
            .querySelectorAll("[data-saved-choice]")
            .forEach((item) => {
              item.disabled = true;
            });

          if (selected === Number(q.correct)) {
            button.classList.add("correct");
            score++;
            toast("Bonne réponse ! ✨", "success");
          } else {
            button.classList.add("wrong");

            const good = document.querySelector(
              `[data-saved-choice="${Number(q.correct)}"]`
            );

            good?.classList.add("correct");

            toast(
              "Pas tout à fait. Regarde l'explication.",
              "error"
            );
          }

          const explanation =
            q.explanation || "";

          const container =
            document.querySelector(
              ".saved-quiz-player"
            );

          if (container && explanation) {
            const box =
              document.createElement("div");

            box.className =
              "quiz-answer-explanation";

            box.innerHTML = `
              <strong>💡 Explication</strong>
              <p>${escapeHTML(explanation)}</p>

              <button
                type="button"
                class="primary-button"
                id="saved-quiz-next"
              >
                ${
                  index === questions.length - 1
                    ? "Voir le résultat"
                    : "Question suivante →"
                }
              </button>
            `;

            container.appendChild(box);

            box
              .querySelector("#saved-quiz-next")
              ?.addEventListener("click", () => {
                index++;

                if (index >= questions.length) {
                  termine = true;
                }

                afficherQuestion();
              });
          }
        });
      });
  }

  afficherQuestion();
}


/* =========================================================
   12. MULTILINGUE
   ========================================================= */

const LANGUES_DISPONIBLES = {
  fr: {
    name: "Français",
    flag: "🇫🇷"
  },

  en: {
    name: "English",
    flag: "🇬🇧"
  },

  zh: {
    name: "中文",
    flag: "🇨🇳"
  },

  vi: {
    name: "Tiếng Việt",
    flag: "🇻🇳"
  }
};


const TRADUCTIONS = {

  fr: {
    dashboard: "Accueil",
    subjects: "Matières",
    lessons: "Leçons",
    materials: "Cours et fichiers",
    revisions: "Révisions",
    calendar: "Calendrier",
    flashcards: "Flashcards",
    quiz: "Quiz",
    studyAI: "Study AI",
    lili: "Lili",
    focus: "Focus",
    statistics: "Statistiques",
    friends: "Amis",
    profile: "Profil",
    settings: "Paramètres",
     siteLanguage: "Langue du site",
languageDescription: "Change toute l'interface de STUDY PLANNER.",

    detailedSummary: "Résumé détaillé",
    examSummary: "Résumé examen",
    createFlashcards: "Créer des flashcards",
    createQuiz: "Créer un quiz",

    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    close: "Fermer",
    search: "Rechercher",
    back: "Retour",

    language: "Langue",
    chooseLanguage: "Choisir la langue",

    notes: "Notes",
    summary: "Résumé",
    exam: "Examen"
  },

  en: {
    dashboard: "Home",
    subjects: "Subjects",
    lessons: "Lessons",
    materials: "Courses & files",
    revisions: "Reviews",
    calendar: "Calendar",
    flashcards: "Flashcards",
    quiz: "Quiz",
    studyAI: "Study AI",
    lili: "Lili",
    focus: "Focus",
    statistics: "Statistics",
    friends: "Friends",
    profile: "Profile",
    settings: "Settings",
     siteLanguage: "Website language",
languageDescription: "Change the entire STUDY PLANNER interface.",

    detailedSummary: "Detailed summary",
    examSummary: "Exam summary",
    createFlashcards: "Create flashcards",
    createQuiz: "Create a quiz",

    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    search: "Search",
    back: "Back",

    language: "Language",
    chooseLanguage: "Choose language",

    notes: "Notes",
    summary: "Summary",
    exam: "Exam"
  },

  zh: {
    dashboard: "首页",
    subjects: "科目",
    lessons: "课程",
    materials: "课程与文件",
    revisions: "复习",
    calendar: "日历",
    flashcards: "抽认卡",
    quiz: "测验",
    studyAI: "Study AI",
    lili: "Lili",
    focus: "专注",
    statistics: "统计",
    friends: "朋友",
    profile: "个人资料",
    settings: "设置",
     siteLanguage: "网站语言",
languageDescription: "更改 STUDY PLANNER 的整个界面。",

    detailedSummary: "详细总结",
    examSummary: "考试总结",
    createFlashcards: "创建抽认卡",
    createQuiz: "创建测验",

    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    close: "关闭",
    search: "搜索",
    back: "返回",

    language: "语言",
    chooseLanguage: "选择语言",

    notes: "笔记",
    summary: "总结",
    exam: "考试"
  },

  vi: {
    dashboard: "Trang chủ",
    subjects: "Môn học",
    lessons: "Bài học",
    materials: "Bài học & tệp",
    revisions: "Ôn tập",
    calendar: "Lịch",
    flashcards: "Flashcards",
    quiz: "Bài kiểm tra",
    studyAI: "Study AI",
    lili: "Lili",
    focus: "Tập trung",
    statistics: "Thống kê",
    friends: "Bạn bè",
    profile: "Hồ sơ",
    settings: "Cài đặt",
     siteLanguage: "Ngôn ngữ trang web",
languageDescription: "Thay đổi toàn bộ giao diện STUDY PLANNER.",

    detailedSummary: "Tóm tắt chi tiết",
    examSummary: "Tóm tắt ôn thi",
    createFlashcards: "Tạo flashcards",
    createQuiz: "Tạo bài kiểm tra",

    save: "Lưu",
    cancel: "Hủy",
    delete: "Xóa",
    edit: "Chỉnh sửa",
    close: "Đóng",
    search: "Tìm kiếm",
    back: "Quay lại",

    language: "Ngôn ngữ",
    chooseLanguage: "Chọn ngôn ngữ",

    notes: "Ghi chú",
    summary: "Tóm tắt",
    exam: "Kỳ thi"
  }
};


let langueActuelle =
  localStorage.getItem("study_planner_language") ||
  "fr";


function traduire(cle) {
  return (
    TRADUCTIONS[langueActuelle]?.[cle] ||
    TRADUCTIONS.fr[cle] ||
    cle
  );
}



function appliquerLangue() {
  document.documentElement.lang =
    langueActuelle === "zh" ? "zh-CN" : langueActuelle;

  // Textes simples : conserve les éléments HTML internes.
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const cle = element.dataset.i18n;
    if (!cle) return;

    const traduction = traduire(cle);

    // Si un élément contient des icônes ou d'autres éléments,
    // ne remplace pas toute sa structure HTML.
    const cible = element.querySelector("[data-i18n-text]");
    if (cible) {
      cible.textContent = traduction;
    } else if (element.children.length === 0) {
      element.textContent = traduction;
    }
  });

  // Placeholders des champs
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = traduire(element.dataset.i18nPlaceholder);
  });

  // Libellés de navigation
  document.querySelectorAll("[data-page-label]").forEach((element) => {
    element.textContent = traduire(element.dataset.pageLabel);
  });

  // Titres et infobulles
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = traduire(element.dataset.i18nTitle);
  });

  // Accessibilité
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute(
      "aria-label",
      traduire(element.dataset.i18nAriaLabel)
    );
  });

  if (typeof renderTopUser === "function") {
    renderTopUser();
  }
}

async function changerLangue(langue) {

  if (!LANGUES_DISPONIBLES[langue]) {
    return;
  }

  langueActuelle = langue;

  localStorage.setItem(
    "study_planner_language",
    langue
  );

  appliquerLangue();

  /*
   * Le champ sera ajouté dans profiles lorsque
   * nous ferons la prochaine mise à jour SQL.
   *
   * On tente quand même la sauvegarde maintenant.
   * Si la colonne n'existe pas encore, le site continue
   * simplement avec le stockage local.
   */
  if (utilisateurActuel) {

    try {

      await supabaseClient
        .from("profiles")
        .update({
          language: langue
        })
        .eq("id", utilisateurActuel.id);

    } catch (error) {
      console.warn(
        "La préférence de langue sera synchronisée avec Supabase dans la prochaine mise à jour.",
        error
      );
    }
  }

  toast(
    `${LANGUES_DISPONIBLES[langue].flag} ${
      LANGUES_DISPONIBLES[langue].name
    }`,
    "success"
  );
}


/* =========================================================
   13. PARAMETRES DE LANGUE
   ========================================================= */

function brancherLangue() {

  const select =
    document.getElementById("settings-language");

  if (!select) return;

  select.value = langueActuelle;

  select.addEventListener(
    "change",
    async () => {
      await changerLangue(select.value);
    }
  );

  appliquerLangue();
}


/* =========================================================
   14. BOUTONS DES FICHIERS IA
   ========================================================= */

document.addEventListener("click", async (event) => {

  const button =
    event.target.closest("[data-study-file-action]");

  if (!button) return;

  const action =
    button.dataset.studyFileAction;

  const materialId =
    button.dataset.materialId;

  if (!materialId) {
    toast("Cours introuvable.", "error");
    return;
  }

  if (action === "resume-detaille") {
    await genererResumeEtFichier(
      materialId,
      "detaille"
    );
  }

  if (action === "resume-examen") {
    await genererResumeEtFichier(
      materialId,
      "examen"
    );
  }

  if (action === "flashcards") {
    await genererFlashcardsEtFichier(
      materialId
    );
  }

  if (action === "quiz") {
    await genererQuizEtFichier(
      materialId
    );
}

});


/* =========================================================
   15. CLIQUER SUR UN FICHIER POUR L'OUVRIR
   ========================================================= */

document.addEventListener("click", (event) => {

  const button =
    event.target.closest("[data-open-study-file]");

  if (!button) return;

  const materialId =
    button.dataset.openStudyFile;

  const material =
    DATA.materials.find(
      (item) => item.id === materialId
    );

  if (!material) {
    toast("Fichier introuvable.", "error");
    return;
  }

  if (
    material.type === "flashcards"
  ) {
    ouvrirFichierFlashcards(material);
    return;
  }

  if (
    material.type === "quiz"
  ) {
    ouvrirFichierQuiz(material);
    return;
  }

  ouvrirEditeurMateriel(material);
});


/* =========================================================
   16. INITIALISATION DES NOUVELLES FONCTIONS
   ========================================================= */

function initialiserAmeliorationsStudyPlanner() {

  brancherLangue();

  /*
   * Rend la langue disponible immédiatement
   * dans toute l'application.
   */
  appliquerLangue();

  console.log(
    "✅ Fonctions fichiers/éditeur/langues chargées."
  );
}


if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    initialiserAmeliorationsStudyPlanner,
    { once: true }
  );

} else {

  initialiserAmeliorationsStudyPlanner();

}


/* =========================================================
   17. VARIABLES DISPONIBLES DANS L'INTERFACE
   ========================================================= */

window.creerFichierEtude =
  creerFichierEtude;

window.ouvrirEditeurMateriel =
  ouvrirEditeurMateriel;

window.genererResumeEtFichier =
  genererResumeEtFichier;

window.genererFlashcardsEtFichier =
  genererFlashcardsEtFichier;

window.genererQuizEtFichier =
  genererQuizEtFichier;

window.ouvrirFichierFlashcards =
  ouvrirFichierFlashcards;

window.ouvrirFichierQuiz =
  ouvrirFichierQuiz;

window.changerLangue =
  changerLangue;

window.appliquerLangue =
  appliquerLangue;
/* =========================================================
   FLASHCARDS — SYSTEME COMPLET
   Maîtrise + statistiques + refaire les difficiles
   ========================================================= */


/* =========================================================
   1. ETAT DE LA SESSION
   ========================================================= */

let spFlashcardSession = {
  cards: [],
  originalCards: [],
  index: 0,
  flipped: false,
  results: [],
  materialId: null,
  materialTitle: ""
};


/* =========================================================
   2. NIVEAUX DE MAITRISE
   ========================================================= */

const SP_FLASHCARD_LEVELS = {
  difficile: {
    key: "difficile",
    label: "Compliqué",
    emoji: "🔴",
    className: "mastery-red"
  },

  bof: {
    key: "bof",
    label: "Bof",
    emoji: "🟠",
    className: "mastery-orange"
  },

  ca_va: {
    key: "ca_va",
    label: "Ça va",
    emoji: "🟡",
    className: "mastery-yellow"
  },

  maitrise: {
    key: "maitrise",
    label: "Maîtrisé",
    emoji: "🟢",
    className: "mastery-green"
  }
};


/* =========================================================
   3. UTILITAIRES
   ========================================================= */

function spFlashcardSafeArray(value) {
  return Array.isArray(value) ? value : [];
}


function spFlashcardNormalizeCard(card) {
  if (!card) {
    return {
      question: "",
      answer: ""
    };
  }

  return {
    id:
      card.id ||
      card.card_id ||
      crypto.randomUUID(),

    question:
      card.question ||
      card.front ||
      card.recto ||
      "",

    answer:
      card.answer ||
      card.back ||
      card.verso ||
      "",

    source:
      card.source ||
      null
  };
}


function spFlashcardNormalizeCards(cards) {
  return spFlashcardSafeArray(cards)
    .map(spFlashcardNormalizeCard)
    .filter(card => card.question || card.answer);
}


/* =========================================================
   4. DEMARRER UNE SESSION
   ========================================================= */

function spStartFlashcardSession(
  cards,
  options = {}
) {

  const normalized =
    spFlashcardNormalizeCards(cards);

  if (!normalized.length) {
    toast(
      "Aucune flashcard à réviser.",
      "error"
    );

    return;
  }

  spFlashcardSession = {
    cards: [...normalized],
    originalCards: [...normalized],
    index: 0,
    flipped: false,
    results: [],
    materialId: options.materialId || null,
    materialTitle: options.materialTitle || ""
  };

  spRenderFlashcardPlayer();
}


/* =========================================================
   5. CARTE ACTUELLE
   ========================================================= */

function spCurrentFlashcard() {

  return (
    spFlashcardSession.cards[
      spFlashcardSession.index
    ] || null
  );

}


/* =========================================================
   6. AFFICHER LES FLASHCARDS
   ========================================================= */

function spRenderFlashcardPlayer() {

  const card =
    spCurrentFlashcard();

  if (!card) {
    spShowFlashcardResults();
    return;
  }

  const total =
    spFlashcardSession.cards.length;

  const current =
    spFlashcardSession.index + 1;

  const percent =
    Math.round((current / total) * 100);

  const levelButtons =
    spFlashcardSession.flipped
      ? `
        <div class="sp-flashcard-mastery">

          <p class="sp-flashcard-mastery-title">
            Comment tu maîtrises cette carte ?
          </p>

          <div class="sp-flashcard-mastery-buttons">

            <button
              type="button"
              class="sp-mastery-button sp-mastery-red"
              data-sp-flashcard-level="difficile"
            >
              <span>🔴</span>
              <strong>Compliqué</strong>
            </button>


            <button
              type="button"
              class="sp-mastery-button sp-mastery-orange"
              data-sp-flashcard-level="bof"
            >
              <span>🟠</span>
              <strong>Bof</strong>
            </button>


            <button
              type="button"
              class="sp-mastery-button sp-mastery-yellow"
              data-sp-flashcard-level="ca_va"
            >
              <span>🟡</span>
              <strong>Ça va</strong>
            </button>


            <button
              type="button"
              class="sp-mastery-button sp-mastery-green"
              data-sp-flashcard-level="maitrise"
            >
              <span>🟢</span>
              <strong>Maîtrisé</strong>
            </button>

          </div>

        </div>
      `
      : "";


  openModal(`

    <div class="sp-flashcard-player">

      <div class="sp-flashcard-header">

        <div>

          <span class="sp-flashcard-kicker">
            🧠 FLASHCARDS
          </span>

          <h2>
            ${escapeHTML(
              spFlashcardSession.materialTitle ||
              "Session de flashcards"
            )}
          </h2>

        </div>


        <span class="sp-flashcard-counter">
          ${current} / ${total}
        </span>

      </div>


      <div class="sp-flashcard-progress">

        <div
          class="sp-flashcard-progress-fill"
          style="width:${percent}%"
        ></div>

      </div>


      <button
        type="button"
        class="sp-flashcard-card
          ${spFlashcardSession.flipped
            ? "sp-flashcard-card-flipped"
            : ""}"
        id="sp-flashcard-main-card"
      >

        <span class="sp-flashcard-small-label">

          ${
            spFlashcardSession.flipped
              ? "RÉPONSE"
              : "QUESTION"
          }

        </span>


        <div class="sp-flashcard-content">

          ${
            spFlashcardSession.flipped
              ? escapeHTML(card.answer)
              : escapeHTML(card.question)
          }

        </div>


        <span class="sp-flashcard-click-hint">

          ${
            spFlashcardSession.flipped
              ? "Clique pour revoir la question"
              : "Clique pour voir la réponse"
          }

        </span>

      </button>


      ${
        spFlashcardSession.flipped
          ? levelButtons
          : `
            <button
              type="button"
              class="primary-button full-width"
              id="sp-flashcard-show-answer"
            >
              Voir la réponse
            </button>
          `
      }


      <div class="sp-flashcard-navigation">

        <button
          type="button"
          class="secondary-button"
          id="sp-flashcard-skip-button"
        >
          Passer
        </button>


        <button
          type="button"
          class="text-button"
          id="sp-flashcard-stop-button"
        >
          Quitter la session
        </button>

      </div>

    </div>

  `);


  /* ---------- Cliquer sur la carte ---------- */

  document
    .getElementById("sp-flashcard-main-card")
    ?.addEventListener(
      "click",
      spToggleFlashcard
    );


  /* ---------- Bouton réponse ---------- */

  document
    .getElementById("sp-flashcard-show-answer")
    ?.addEventListener(
      "click",
      spToggleFlashcard
    );


  /* ---------- Niveau de maîtrise ---------- */

  document
    .querySelectorAll(
      "[data-sp-flashcard-level]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const level =
            button.dataset.spFlashcardLevel;

          spRateCurrentFlashcard(level);

        }
      );

    });


  /* ---------- Passer ---------- */

  document
    .getElementById(
      "sp-flashcard-skip-button"
    )
    ?.addEventListener(
      "click",
      () => {

        spRateCurrentFlashcard(
          "bof",
          true
        );

      }
    );


  /* ---------- Quitter ---------- */

  document
    .getElementById(
      "sp-flashcard-stop-button"
    )
    ?.addEventListener(
      "click",
      () => {

        const quitter =
          confirm(
            "Quitter cette session de flashcards ?"
          );

        if (quitter) {
          closeModal();
        }

      }
    );

}


/* =========================================================
   7. RETOURNER LA CARTE
   ========================================================= */

function spToggleFlashcard() {

  spFlashcardSession.flipped =
    !spFlashcardSession.flipped;

  spRenderFlashcardPlayer();

}


/* =========================================================
   8. ENREGISTRER LE NIVEAU
   ========================================================= */

function spRateCurrentFlashcard(
  level,
  skipped = false
) {

  const card =
    spCurrentFlashcard();

  if (!card) return;


  const existingIndex =
    spFlashcardSession.results.findIndex(
      result =>
        result.card.id === card.id
    );


  const result = {
    card: { ...card },
    level,
    skipped
  };


  if (existingIndex === -1) {

    spFlashcardSession.results.push(result);

  } else {

    spFlashcardSession.results[
      existingIndex
    ] = result;

  }


  /* Carte suivante */

  spFlashcardSession.index += 1;

  spFlashcardSession.flipped = false;

  spRenderFlashcardPlayer();

}


/* =========================================================
   9. CALCUL DES STATISTIQUES
   ========================================================= */

function spGetFlashcardStats() {

  const results =
    spFlashcardSession.results;

  const total =
    spFlashcardSession.originalCards.length;


  let difficile = 0;
  let bof = 0;
  let caVa = 0;
  let maitrise = 0;


  results.forEach(result => {

    switch (result.level) {

      case "difficile":
        difficile++;
        break;

      case "bof":
        bof++;
        break;

      case "ca_va":
        caVa++;
        break;

      case "maitrise":
        maitrise++;
        break;

    }

  });


  const repondu =
    difficile +
    bof +
    caVa +
    maitrise;


  const taux =
    total > 0
      ? Math.round(
          (maitrise / total) * 100
        )
      : 0;


  return {
    total,
    repondu,
    difficile,
    bof,
    caVa,
    maitrise,
    taux
  };

}


/* =========================================================
   10. CARTES COMPLIQUEES
   ========================================================= */

function spGetDifficultFlashcards() {

  return spFlashcardSession.results
    .filter(result =>
      result.level === "difficile"
    )
    .map(result => ({
      ...result.card
    }));

}


/* =========================================================
   11. CARTES A REVOIR
   🔴 + 🟠
   ========================================================= */

function spGetCardsToReview() {

  return spFlashcardSession.results
    .filter(result =>
      result.level === "difficile" ||
      result.level === "bof"
    )
    .map(result => ({
      ...result.card
    }));

}


/* =========================================================
   12. TOUTES LES CARTES
   ========================================================= */

function spGetAllFlashcards() {

  return spFlashcardSession.originalCards
    .map(card => ({
      ...card
    }));

}


/* =========================================================
   13. ECRAN DES RESULTATS
   ========================================================= */

function spShowFlashcardResults() {

  const stats =
    spGetFlashcardStats();


  const difficiles =
    spGetDifficultFlashcards();

  const aRevoir =
    spGetCardsToReview();

  const toutes =
    spGetAllFlashcards();


  const maitrisePourcentage =
    stats.total > 0
      ? Math.round(
          (stats.maitrise / stats.total) * 100
        )
      : 0;


  openModal(`

    <div class="sp-flashcard-results">

      <div class="sp-results-emoji">
        ${
          stats.maitrise === stats.total
            ? "🏆"
            : stats.difficile > 0
              ? "🌸"
              : "🎉"
        }
      </div>


      <span class="sp-flashcard-kicker">
        SESSION TERMINÉE
      </span>


      <h2>
        ${
          stats.maitrise === stats.total
            ? "Tout est maîtrisé !"
            : "Bravo, tu as terminé !"
        }
      </h2>


      <div class="sp-results-main-score">

        <strong>
          ${stats.maitrise}
        </strong>

        <span>
          / ${stats.total}
        </span>

      </div>


      <p class="sp-results-score-label">
        cartes maîtrisées
      </p>


      <div class="sp-results-progress">

        <div
          class="sp-results-progress-fill"
          style="width:${maitrisePourcentage}%"
        ></div>

      </div>


      <div class="sp-results-grid">

        <div class="sp-result-card red">

          <span>🔴</span>

          <strong>
            ${stats.difficile}
          </strong>

          <small>
            Compliquées
          </small>

        </div>


        <div class="sp-result-card orange">

          <span>🟠</span>

          <strong>
            ${stats.bof}
          </strong>

          <small>
            Bof
          </small>

        </div>


        <div class="sp-result-card yellow">

          <span>🟡</span>

          <strong>
            ${stats.caVa}
          </strong>

          <small>
            Ça va
          </small>

        </div>


        <div class="sp-result-card green">

          <span>🟢</span>

          <strong>
            ${stats.maitrise}
          </strong>

          <small>
            Maîtrisées
          </small>

        </div>

      </div>


      <div class="sp-results-actions">

        ${
          difficiles.length > 0
            ? `
              <button
                type="button"
                class="primary-button full-width"
                id="sp-redo-difficult"
              >
                🔴 Refaire les ${difficiles.length}
                compliquées
              </button>
            `
            : ""
        }


        ${
          aRevoir.length > 0
            ? `
              <button
                type="button"
                class="secondary-button full-width"
                id="sp-redo-review"
              >
                🟠 Refaire les ${aRevoir.length}
                cartes à revoir
              </button>
            `
            : ""
        }


        <button
          type="button"
          class="secondary-button full-width"
          id="sp-redo-all"
        >
          🔄 Tout refaire
        </button>


        <button
          type="button"
          class="text-button"
          id="sp-finish-session"
        >
          Terminer
        </button>

      </div>

    </div>

  `);


  /* ---------- Refaire compliquées ---------- */

  document
    .getElementById(
      "sp-redo-difficult"
    )
    ?.addEventListener(
      "click",
      () => {

        closeModal();

        spStartFlashcardSession(
          difficiles,
          {
            materialId:
              spFlashcardSession.materialId,

            materialTitle:
              spFlashcardSession.materialTitle
          }
        );

      }
    );


  /* ---------- Refaire à revoir ---------- */

  document
    .getElementById(
      "sp-redo-review"
    )
    ?.addEventListener(
      "click",
      () => {

        closeModal();

        spStartFlashcardSession(
          aRevoir,
          {
            materialId:
              spFlashcardSession.materialId,

            materialTitle:
              spFlashcardSession.materialTitle
          }
        );

      }
    );


  /* ---------- Tout refaire ---------- */

  document
    .getElementById(
      "sp-redo-all"
    )
    ?.addEventListener(
      "click",
      () => {

        closeModal();

        spStartFlashcardSession(
          toutes,
          {
            materialId:
              spFlashcardSession.materialId,

            materialTitle:
              spFlashcardSession.materialTitle
          }
        );

      }
    );


  /* ---------- Terminer ---------- */

  document
    .getElementById(
      "sp-finish-session"
    )
    ?.addEventListener(
      "click",
      () => {

        closeModal();

      }
    );

}


/* =========================================================
   14. OUVRIR UN FICHIER FLASHCARDS ENREGISTRE
   ========================================================= */

function ouvrirFichierFlashcards(material) {

  if (!material) {

    toast(
      "Flashcards introuvables.",
      "error"
    );

    return;

  }


  let cards = [];


  try {

    /*
     * Le contenu peut être :
     * - directement un tableau JSON
     * - ou une chaîne contenant le JSON
     */

    if (Array.isArray(material.contenu)) {

      cards =
        material.contenu;

    } else {

      cards =
        JSON.parse(
          material.contenu || "[]"
        );

    }

  } catch (error) {

    console.error(
      "Erreur lecture flashcards :",
      error
    );

    toast(
      "Impossible de lire ces flashcards.",
      "error"
    );

    return;

  }


  cards =
    spFlashcardNormalizeCards(cards);


  if (!cards.length) {

    toast(
      "Ce fichier ne contient aucune flashcard.",
      "error"
    );

    return;

  }


  spStartFlashcardSession(
    cards,
    {
      materialId: material.id,
      materialTitle:
        material.titre || "Flashcards"
    }
  );

}


/* =========================================================
   15. OUVRIR DEPUIS UN DECK
   ========================================================= */

function lancerSessionFlashcardsPersonnalisee(
  cards,
  options = {}
) {

  spStartFlashcardSession(
    cards,
    options
  );

}


/* =========================================================
   16. ALIAS POUR LES ANCIENNES FONCTIONS
   ========================================================= */

window.ouvrirFichierFlashcards =
  ouvrirFichierFlashcards;

window.lancerSessionFlashcardsPersonnalisee =
  lancerSessionFlashcardsPersonnalisee;

window.spStartFlashcardSession =
  spStartFlashcardSession;

window.spGetFlashcardStats =
  spGetFlashcardStats;


/* =========================================================
   17. CSS DES FLASHCARDS
   ========================================================= */

(function injectFlashcardStyles() {

  if (
    document.getElementById(
      "sp-flashcard-styles"
    )
  ) {
    return;
  }


  const style =
    document.createElement("style");

  style.id =
    "sp-flashcard-styles";


  style.textContent = `

    /* ================================
       PLAYER
       ================================= */

    .sp-flashcard-player {
      width: min(760px, 100%);
      margin: 0 auto;
    }


    .sp-flashcard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-bottom: 15px;
    }


    .sp-flashcard-header h2 {
      margin: 5px 0 0;
    }


    .sp-flashcard-kicker {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      opacity: 0.55;
    }


    .sp-flashcard-counter {
      padding: 8px 13px;
      border-radius: 999px;
      background: #f5edf5;
      font-weight: 700;
      white-space: nowrap;
    }


    .sp-flashcard-progress {
      width: 100%;
      height: 8px;
      border-radius: 99px;
      overflow: hidden;
      background: #eee9ee;
      margin-bottom: 22px;
    }


    .sp-flashcard-progress-fill {
      height: 100%;
      border-radius: inherit;
      background: #d78fb0;
      transition: width 0.25s ease;
    }


    /* ================================
       CARTE
       ================================= */

    .sp-flashcard-card {
      width: 100%;
      min-height: 330px;
      border: 0;
      border-radius: 28px;
      padding: 45px 35px;
      margin-bottom: 18px;

      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      text-align: center;

      background:
        linear-gradient(
          135deg,
          #fff8fb,
          #f8f3ff
        );

      box-shadow:
        0 18px 50px rgba(82, 50, 75, 0.08);

      cursor: pointer;
      transition:
        transform 0.18s ease,
        box-shadow 0.18s ease;
    }


    .sp-flashcard-card:hover {
      transform: translateY(-2px);
      box-shadow:
        0 22px 55px rgba(82, 50, 75, 0.12);
    }


    .sp-flashcard-small-label {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      opacity: 0.45;
      margin-bottom: 25px;
    }


    .sp-flashcard-content {
      font-size: clamp(1.3rem, 3vw, 2rem);
      line-height: 1.45;
      font-weight: 700;
      max-width: 620px;
    }


    .sp-flashcard-click-hint {
      margin-top: 28px;
      font-size: 0.82rem;
      opacity: 0.48;
    }


    /* ================================
       MAITRISE
       ================================= */

    .sp-flashcard-mastery {
      padding: 4px 0 18px;
    }


    .sp-flashcard-mastery-title {
      text-align: center;
      font-weight: 700;
      margin-bottom: 12px;
    }


    .sp-flashcard-mastery-buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }


    .sp-mastery-button {
      border: 0;
      border-radius: 16px;
      padding: 13px 8px;
      cursor: pointer;

      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;

      transition:
        transform 0.15s ease;
    }


    .sp-mastery-button:hover {
      transform: translateY(-2px);
    }


    .sp-mastery-button span {
      font-size: 1.25rem;
    }


    .sp-mastery-button strong {
      font-size: 0.8rem;
    }


    .sp-mastery-red {
      background: #ffe4e4;
      color: #b83333;
    }


    .sp-mastery-orange {
      background: #ffecd9;
      color: #c76718;
    }


    .sp-mastery-yellow {
      background: #fff6c9;
      color: #967400;
    }


    .sp-mastery-green {
      background: #e1f5e6;
      color: #318149;
    }


    .sp-flashcard-navigation {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 15px;
      gap: 15px;
    }


    /* ================================
       RESULTATS
       ================================= */

    .sp-flashcard-results {
      width: min(640px, 100%);
      margin: 0 auto;
      text-align: center;
    }


    .sp-results-emoji {
      font-size: 3.2rem;
      margin-bottom: 8px;
    }


    .sp-flashcard-results h2 {
      margin: 5px 0 18px;
    }


    .sp-results-main-score {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 7px;
    }


    .sp-results-main-score strong {
      font-size: 4rem;
      line-height: 1;
    }


    .sp-results-main-score span {
      font-size: 1.45rem;
      opacity: 0.45;
    }


    .sp-results-score-label {
      opacity: 0.65;
      margin: 8px 0 18px;
    }


    .sp-results-progress {
      height: 10px;
      width: 100%;
      border-radius: 999px;
      overflow: hidden;
      background: #eee9ee;
      margin-bottom: 22px;
    }


    .sp-results-progress-fill {
      height: 100%;
      border-radius: inherit;
      background: #57a86d;
    }


    .sp-results-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }


    .sp-result-card {
      border-radius: 18px;
      padding: 16px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }


    .sp-result-card span {
      font-size: 1.25rem;
    }


    .sp-result-card strong {
      font-size: 1.35rem;
    }


    .sp-result-card small {
      font-size: 0.73rem;
    }


    .sp-result-card.red {
      background: #ffe4e4;
    }


    .sp-result-card.orange {
      background: #ffecd9;
    }


    .sp-result-card.yellow {
      background: #fff6c9;
    }


    .sp-result-card.green {
      background: #e1f5e6;
    }


    .sp-results-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }


    @media (max-width: 650px) {

      .sp-flashcard-mastery-buttons {
        grid-template-columns: repeat(2, 1fr);
      }


      .sp-results-grid {
        grid-template-columns: repeat(2, 1fr);
      }


      .sp-flashcard-card {
        min-height: 280px;
        padding: 30px 20px;
      }


      .sp-flashcard-header {
        flex-direction: column;
      }

    }

  `;


  document.head.appendChild(style);

})();
/* =========================================================
   THEME PERSONNALISE
   Roses / Espace / Neutre
   ========================================================= */


/* =========================================================
   1. THEMES
   ========================================================= */

const SP_THEMES = {
  girly: {
    name: "Roses & fleurs",
    icon: "🌸"
  },

  space: {
    name: "Espace",
    icon: "🌌"
  },

  neutral: {
    name: "Neutre",
    icon: "✨"
  }
};


/* =========================================================
   2. CREER LE FOND
   ========================================================= */

function spCreateThemeBackground() {

  if (
    document.getElementById(
      "sp-theme-background"
    )
  ) {
    return;
  }


  const background =
    document.createElement("div");

  background.id =
    "sp-theme-background";

  background.setAttribute(
    "aria-hidden",
    "true"
  );


  background.innerHTML = `
    <div class="sp-theme-decorations">

      <span class="sp-decoration d1">🌸</span>
      <span class="sp-decoration d2">🌷</span>
      <span class="sp-decoration d3">🌹</span>
      <span class="sp-decoration d4">✿</span>
      <span class="sp-decoration d5">🌸</span>
      <span class="sp-decoration d6">♡</span>

    </div>

    <div class="sp-space-decorations">

      <span class="sp-star s1">✦</span>
      <span class="sp-star s2">✧</span>
      <span class="sp-star s3">★</span>
      <span class="sp-star s4">✦</span>
      <span class="sp-star s5">✧</span>
      <span class="sp-star s6">⋆</span>
      <span class="sp-star s7">✦</span>
      <span class="sp-star s8">★</span>

      <span class="sp-planet p1">🪐</span>
      <span class="sp-planet p2">🌙</span>
      <span class="sp-planet p3">🌑</span>

    </div>

    <div class="sp-neutral-decorations">

      <span>✦</span>
      <span>·</span>
      <span>✧</span>
      <span>·</span>
      <span>✦</span>

    </div>
  `;


  document.body.prepend(background);
}


/* =========================================================
   3. APPLIQUER LE THEME
   ========================================================= */

function spApplyTheme(theme) {

  if (!SP_THEMES[theme]) {
    theme = "neutral";
  }


  spCreateThemeBackground();


  document.body.classList.remove(
    "sp-theme-girly",
    "sp-theme-space",
    "sp-theme-neutral"
  );


  document.body.classList.add(
    `sp-theme-${theme}`
  );


  localStorage.setItem(
    "study_planner_theme",
    theme
  );


  /* Met à jour le thème dans le compte Supabase */

  if (supabaseClient && utilisateurActuel) {

    supabaseClient.auth
      .updateUser({
        data: {
          study_theme: theme
        }
      })
      .then(({ error }) => {

        if (error) {
          console.warn(
            "Impossible de sauvegarder le thème :",
            error
          );
        }

      });

  }
}


/* =========================================================
   4. RECUPERER LE THEME
   ========================================================= */

function spGetSavedTheme() {

  /* Priorité au compte Supabase */

  const themeSupabase =
    utilisateurActuel
      ?.user_metadata
      ?.study_theme;


  if (
    themeSupabase &&
    SP_THEMES[themeSupabase]
  ) {

    return themeSupabase;

  }


  /* Sinon navigateur */

  const themeLocal =
    localStorage.getItem(
      "study_planner_theme"
    );


  if (
    themeLocal &&
    SP_THEMES[themeLocal]
  ) {

    return themeLocal;

  }


  return null;
}


/* =========================================================
   5. CHOIX DU THEME
   ========================================================= */

function spOpenThemeChoice() {

  openModal(`

    <div class="sp-theme-choice">

      <div class="sp-theme-choice-top">
        ✨
      </div>

      <span class="sp-theme-kicker">
        PERSONNALISE TON ESPACE
      </span>

      <h2>
        Quel style veux-tu ?
      </h2>

      <p class="sp-theme-description">
        Choisis l'ambiance de ton STUDY PLANNER.
        Tu pourras la changer plus tard.
      </p>


      <div class="sp-theme-options">


        <!-- GIRLY -->

        <button
          type="button"
          class="sp-theme-option sp-theme-option-girly"
          data-sp-theme-choice="girly"
        >

          <div class="sp-theme-preview roses-preview">

            <span>🌸</span>
            <span>🌷</span>
            <span>🌹</span>
            <span>♡</span>

          </div>

          <strong>
            🌸 Roses & fleurs
          </strong>

          <small>
            Une ambiance douce et fleurie
          </small>

        </button>


        <!-- SPACE -->

        <button
          type="button"
          class="sp-theme-option sp-theme-option-space"
          data-sp-theme-choice="space"
        >

          <div class="sp-theme-preview space-preview">

            <span>✦</span>
            <span>🪐</span>
            <span>✧</span>
            <span>🌙</span>

          </div>

          <strong>
            🌌 Espace
          </strong>

          <small>
            Une ambiance spatiale et futuriste
          </small>

        </button>


        <!-- NEUTRE -->

        <button
          type="button"
          class="sp-theme-option sp-theme-option-neutral"
          data-sp-theme-choice="neutral"
        >

          <div class="sp-theme-preview neutral-preview">

            <span>✦</span>
            <span>✧</span>
            <span>·</span>
            <span>♡</span>

          </div>

          <strong>
            ✨ Neutre
          </strong>

          <small>
            Une ambiance douce et simple
          </small>

        </button>

      </div>

    </div>

  `);


  document
    .querySelectorAll(
      "[data-sp-theme-choice]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const theme =
            button.dataset.spThemeChoice;

          spApplyTheme(theme);

          closeModal();

          toast(
            `${SP_THEMES[theme].icon} Thème ${
              SP_THEMES[theme].name
            } activé`,
            "success"
          );

        }
      );

    });
}


/* =========================================================
   6. CHOIX SELON LE SEXE
   ========================================================= */

/*
 * Le choix "Fille / Garçon / Je préfère ne pas dire"
 * sert seulement à proposer une ambiance.
 *
 * On enregistre uniquement le thème choisi.
 */

function spOpenPersonalizationChoice() {

  openModal(`

    <div class="sp-theme-choice">

      <div class="sp-theme-choice-top">
        🌸
      </div>

      <span class="sp-theme-kicker">
        BIENVENUE SUR STUDY PLANNER
      </span>

      <h2>
        Personnalisons ton espace
      </h2>

      <p class="sp-theme-description">
        Choisis ton sexe pour recevoir une ambiance
        qui te correspond, puis tu pourras modifier
        le thème quand tu veux.
      </p>


      <div class="sp-gender-options">


        <button
          type="button"
          class="sp-gender-option"
          data-sp-gender="girl"
        >

          <span class="sp-gender-icon">
            🌸
          </span>

          <strong>
            Fille
          </strong>

          <small>
            Ambiance roses & fleurs
          </small>

        </button>


        <button
          type="button"
          class="sp-gender-option"
          data-sp-gender="boy"
        >

          <span class="sp-gender-icon">
            🌌
          </span>

          <strong>
            Garçon
          </strong>

          <small>
            Ambiance espace
          </small>

        </button>


        <button
          type="button"
          class="sp-gender-option"
          data-sp-gender="unknown"
        >

          <span class="sp-gender-icon">
            ✨
          </span>

          <strong>
            Je préfère ne pas dire
          </strong>

          <small>
            Ambiance neutre
          </small>

        </button>

      </div>

    </div>

  `);


  document
    .querySelectorAll(
      "[data-sp-gender]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const gender =
            button.dataset.spGender;


          let theme = "neutral";


          if (gender === "girl") {
            theme = "girly";
          }


          if (gender === "boy") {
            theme = "space";
          }


          spApplyTheme(theme);

          closeModal();

          toast(
            "✨ Ton espace est personnalisé !",
            "success"
          );

        }
      );

    });

}


/* =========================================================
   7. VERIFIER LE PREMIER CHOIX
   ========================================================= */

function spCheckThemeAfterLogin() {

  if (
    !utilisateurActuel
  ) {
    return;
  }


  const savedTheme =
    spGetSavedTheme();


  if (savedTheme) {

    spApplyTheme(
      savedTheme
    );

    return;

  }


  /*
   * Aucun thème :
   * première connexion
   */

  setTimeout(() => {

    spOpenPersonalizationChoice();

  }, 500);

}


/* =========================================================
   8. BOUTON POUR CHANGER LE THEME
   ========================================================= */

function spCreateThemeButton() {

  if (
    document.getElementById(
      "sp-change-theme-button"
    )
  ) {
    return;
  }


  const button =
    document.createElement("button");


  button.id =
    "sp-change-theme-button";


  button.type =
    "button";


  button.title =
    "Changer l'ambiance";


  button.innerHTML =
    "🎨";


  button.addEventListener(
    "click",
    () => {
      spOpenThemeChoice();
    }
  );


  document.body.appendChild(
    button
  );

}


/* =========================================================
   9. INITIALISER
   ========================================================= */

function spInitializeThemeSystem() {

  spCreateThemeBackground();

  spCreateThemeButton();


  const savedTheme =
    spGetSavedTheme();


  if (savedTheme) {

    spApplyTheme(
      savedTheme
    );

  }

}


/* =========================================================
   10. APRES LA CONNEXION
   ========================================================= */

const spOriginalShowMainApp =
  showMainApp;


showMainApp = async function() {

  const result =
    spOriginalShowMainApp();

  if (
    result &&
    typeof result.then === "function"
  ) {

    await result;

  }


  spInitializeThemeSystem();

  spCheckThemeAfterLogin();

};


/* =========================================================
   11. STYLE DU FOND
   ========================================================= */

(function spInjectThemeCSS() {

  if (
    document.getElementById(
      "sp-theme-system-css"
    )
  ) {
    return;
  }


  const style =
    document.createElement("style");


  style.id =
    "sp-theme-system-css";


  style.textContent = `

    /* =========================================
       FOND GENERAL
       ========================================= */

    #sp-theme-background {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;

      transition:
        background 0.6s ease;
    }


    body > *:not(#sp-theme-background) {
      position: relative;
      z-index: 1;
    }


    /* =========================================
       NEUTRE
       ========================================= */

    body.sp-theme-neutral {
      background:
        radial-gradient(
          circle at 10% 15%,
          rgba(240, 213, 231, 0.42),
          transparent 28%
        ),
        radial-gradient(
          circle at 90% 80%,
          rgba(219, 211, 242, 0.42),
          transparent 30%
        ),
        #faf8fb;
    }


    body.sp-theme-neutral
    #sp-theme-background {
      background:
        radial-gradient(
          circle at 20% 30%,
          rgba(255,255,255,0.7) 0 2px,
          transparent 3px
        ),
        radial-gradient(
          circle at 80% 70%,
          rgba(255,255,255,0.7) 0 2px,
          transparent 3px
        );
    }


    .sp-neutral-decorations {
      position: absolute;
      inset: 0;
      opacity: 0.22;
      font-size: 1.2rem;
    }


    .sp-neutral-decorations span {
      position: absolute;
    }


    .sp-neutral-decorations span:nth-child(1) {
      top: 14%;
      left: 7%;
    }


    .sp-neutral-decorations span:nth-child(2) {
      top: 30%;
      right: 9%;
    }


    .sp-neutral-decorations span:nth-child(3) {
      bottom: 20%;
      left: 13%;
    }


    .sp-neutral-decorations span:nth-child(4) {
      bottom: 9%;
      right: 20%;
    }


    .sp-neutral-decorations span:nth-child(5) {
      top: 8%;
      right: 28%;
    }


    /* =========================================
       GIRLY / ROSES
       ========================================= */

    body.sp-theme-girly {
      background:
        radial-gradient(
          circle at 10% 10%,
          rgba(255, 204, 223, 0.55),
          transparent 28%
        ),
        radial-gradient(
          circle at 90% 25%,
          rgba(245, 200, 220, 0.48),
          transparent 25%
        ),
        radial-gradient(
          circle at 70% 90%,
          rgba(229, 215, 244, 0.45),
          transparent 30%
        ),
        #fff9fc;
    }


    body.sp-theme-girly
    #sp-theme-background {
      background:
        radial-gradient(
          circle at 5% 90%,
          rgba(255,255,255,0.72),
          transparent 30%
        );
    }


    .sp-theme-decorations {
      position: absolute;
      inset: 0;
    }


    .sp-decoration {
      position: absolute;
      opacity: 0.24;
      filter: blur(0.2px);
      animation:
        spFloat 7s ease-in-out infinite;
    }


    .sp-decoration.d1 {
      top: 10%;
      left: 5%;
      font-size: 3.4rem;
    }


    .sp-decoration.d2 {
      top: 22%;
      right: 6%;
      font-size: 2.8rem;
      animation-delay: -2s;
    }


    .sp-decoration.d3 {
      bottom: 12%;
      left: 7%;
      font-size: 3rem;
      animation-delay: -4s;
    }


    .sp-decoration.d4 {
      bottom: 25%;
      right: 10%;
      font-size: 2.3rem;
      animation-delay: -1s;
    }


    .sp-decoration.d5 {
      top: 65%;
      right: 3%;
      font-size: 3.2rem;
      animation-delay: -3s;
    }


    .sp-decoration.d6 {
      top: 8%;
      right: 30%;
      font-size: 2rem;
    }


    /* =========================================
       ESPACE
       ========================================= */

    body.sp-theme-space {
      background:
        radial-gradient(
          circle at 20% 20%,
          rgba(89, 105, 179, 0.45),
          transparent 30%
        ),
        radial-gradient(
          circle at 85% 75%,
          rgba(112, 76, 156, 0.5),
          transparent 30%
        ),
        linear-gradient(
          135deg,
          #0d1029,
          #17163b 45%,
          #26163e
        );
    }


    body.sp-theme-space
    .main-content {
      color: #f7f5ff;
    }


    body.sp-theme-space
    .topbar,
    body.sp-theme-space
    .panel,
    body.sp-theme-space
    .stat-card,
    body.sp-theme-space
    .subject-card,
    body.sp-theme-space
    .material-card {
      color: #ffffff;
    }


    .sp-space-decorations {
      position: absolute;
      inset: 0;
    }


    .sp-star,
    .sp-planet {
      position: absolute;
    }


    .sp-star {
      color: rgba(255,255,255,0.78);
      animation:
        spTwinkle 3s ease-in-out infinite;
    }


    .sp-star.s1 {
      top: 8%;
      left: 12%;
    }


    .sp-star.s2 {
      top: 20%;
      left: 40%;
      font-size: 0.8rem;
    }


    .sp-star.s3 {
      top: 13%;
      right: 12%;
    }


    .sp-star.s4 {
      top: 45%;
      right: 7%;
    }


    .sp-star.s5 {
      bottom: 18%;
      left: 10%;
    }


    .sp-star.s6 {
      bottom: 9%;
      left: 45%;
    }


    .sp-star.s7 {
      bottom: 30%;
      right: 20%;
    }


    .sp-star.s8 {
      top: 65%;
      left: 30%;
    }


    .sp-planet.p1 {
      top: 6%;
      right: 20%;
      font-size: 3rem;
      opacity: 0.28;
    }


    .sp-planet.p2 {
      bottom: 10%;
      right: 8%;
      font-size: 2.7rem;
      opacity: 0.25;
    }


    .sp-planet.p3 {
      bottom: 30%;
      left: 4%;
      font-size: 2rem;
      opacity: 0.22;
    }


    /* =========================================
       ANIMATIONS
       ========================================= */

    @keyframes spFloat {

      0%,
      100% {
        transform:
          translateY(0)
          rotate(0deg);
      }

      50% {
        transform:
          translateY(-10px)
          rotate(3deg);
      }

    }


    @keyframes spTwinkle {

      0%,
      100% {
        opacity: 0.3;
        transform: scale(0.9);
      }

      50% {
        opacity: 1;
        transform: scale(1.15);
      }

    }


    /* =========================================
       BOUTON THEME
       ========================================= */

    #sp-change-theme-button {
      position: fixed;
      right: 20px;
      bottom: 20px;

      width: 48px;
      height: 48px;

      border: 0;
      border-radius: 50%;

      background:
        rgba(255,255,255,0.88);

      box-shadow:
        0 8px 25px rgba(60,40,70,0.15);

      cursor: pointer;
      font-size: 1.25rem;

      z-index: 100;

      transition:
        transform 0.2s ease;
    }


    #sp-change-theme-button:hover {
      transform:
        translateY(-3px)
        rotate(8deg);
    }


    /* =========================================
       CHOIX DU THEME
       ========================================= */

    .sp-theme-choice {
      width: min(700px, 100%);
      margin: 0 auto;
      text-align: center;
    }


    .sp-theme-choice-top {
      font-size: 2.7rem;
      margin-bottom: 5px;
    }


    .sp-theme-kicker {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.15em;
      opacity: 0.5;
    }


    .sp-theme-choice h2 {
      margin: 7px 0;
    }


    .sp-theme-description {
      opacity: 0.65;
      max-width: 520px;
      margin:
        0 auto 24px;
      line-height: 1.5;
    }


    .sp-theme-options,
    .sp-gender-options {
      display: grid;
      grid-template-columns:
        repeat(3, 1fr);
      gap: 14px;
    }


    .sp-theme-option,
    .sp-gender-option {
      border: 1px solid rgba(0,0,0,0.06);
      background: #fff;
      border-radius: 22px;
      padding: 0 0 17px;

      overflow: hidden;
      cursor: pointer;

      text-align: left;

      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;
    }


    .sp-theme-option:hover,
    .sp-gender-option:hover {
      transform:
        translateY(-4px);

      box-shadow:
        0 12px 30px rgba(50,35,55,0.12);
    }


    .sp-theme-preview {
      height: 120px;

      display: flex;
      align-items: center;
      justify-content: center;

      gap: 10px;

      font-size: 2rem;
    }


    .roses-preview {
      background:
        radial-gradient(
          circle at 30% 30%,
          #ffffffaa,
          transparent 30%
        ),
        linear-gradient(
          135deg,
          #ffe1ec,
          #f9c5da
        );
    }


    .space-preview {
      color: white;

      background:
        radial-gradient(
          circle at 20% 30%,
          #ffffffaa 0 1px,
          transparent 2px
        ),
        linear-gradient(
          135deg,
          #15153b,
          #312052
        );
    }


    .neutral-preview {
      background:
        linear-gradient(
          135deg,
          #f8f5fb,
          #eeeaf6
        );
    }


    .sp-theme-option > strong,
    .sp-theme-option > small,
    .sp-gender-option > strong,
    .sp-gender-option > small {
      display: block;
      padding:
        0 15px;
    }


    .sp-theme-option > strong,
    .sp-gender-option > strong {
      margin-top: 14px;
    }


    .sp-theme-option > small,
    .sp-gender-option > small {
      margin-top: 5px;
      opacity: 0.58;
    }


    .sp-gender-option {
      text-align: center;
      padding: 22px 8px;
    }


    .sp-gender-icon {
      display: block;
      font-size: 2.5rem;
      margin-bottom: 10px;
    }


    @media (max-width: 650px) {

      .sp-theme-options,
      .sp-gender-options {
        grid-template-columns: 1fr;
      }


      #sp-change-theme-button {
        right: 14px;
        bottom: 14px;
      }

    }

  `;


  document.head.appendChild(
    style
  );

})();
/* =========================================================
   CORRECTION — BOUTON CREER UN COMPTE
   ========================================================= */

function correctionBoutonInscription() {

  const boutonCreer =
    document.getElementById("show-signup-button");

  const boutonConnexion =
    document.getElementById("show-login-button");

  const loginView =
    document.getElementById("login-view");

  const signupView =
    document.getElementById("signup-view");


  if (
    boutonCreer &&
    loginView &&
    signupView
  ) {

    boutonCreer.addEventListener(
      "click",
      function () {

        loginView.classList.add("hidden");

        signupView.classList.remove("hidden");

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

      }
    );

  }


  if (
    boutonConnexion &&
    loginView &&
    signupView
  ) {

    boutonConnexion.addEventListener(
      "click",
      function () {

        signupView.classList.add("hidden");

        loginView.classList.remove("hidden");

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

      }
    );

  }

}


if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    correctionBoutonInscription,
    { once: true }
  );

} else {

  correctionBoutonInscription();

}
/* =========================================================
   STUDY GARDEN — GENERATION DES TUILES
   ========================================================= */

function initialiserGarden() {

  const garden = document.getElementById("garden-ground");

  if (!garden) return;

  garden.innerHTML = "";

  const nombreDeTuiles = 100;

  for (let i = 1; i <= nombreDeTuiles; i++) {

    const tile = document.createElement("div");

    tile.className = "garden-tile";

    tile.dataset.tile = i;

    garden.appendChild(tile);
  }
}
initialiserGarden();
