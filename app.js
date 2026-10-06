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

async function registerAccount(event) {
  event.preventDefault();

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
            window.location.origin
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
  event.preventDefault();

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
