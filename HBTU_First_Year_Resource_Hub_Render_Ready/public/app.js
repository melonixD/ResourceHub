const STORAGE = {
  theme: "fyhub-theme",
  tasks: "fyhub-tasks",
};

const state = {
  data: null,
  branch: "mechanical",
  librarySubject: "chemistry",
  query: "",
  tasks: readStorage(STORAGE.tasks, []),
};

const subjectEmoji = {
  chemistry: "🧪",
  pc: "🗣️",
  bem: "⚙️",
  ees: "🌿",
  bet: "⚡",
  workshop: "🛠️",
  "food-tech": "🍞",
};

const elements = {};
let toastTimeout;
let timerSeconds = 25 * 60;
let timerInterval = null;

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cacheElements() {
  [
    "theme-toggle", "menu-toggle", "mobile-menu", "branch-search", "library-branch-count",
    "library-branch-list", "library-branch-breadcrumb", "library-subject-breadcrumb",
    "library-branch-name", "library-branch-status", "branch-subject-list", "library-course-icon",
    "library-course-name", "library-course-description", "library-course-status", "library-unit-list", "syllabus-list",
    "available-count", "hero-resource-count",
    "snapshot-pdf-badge", "library-coverage-bar", "snapshot-subjects", "snapshot-units",
    "snapshot-pdfs", "task-form", "task-input", "task-list", "task-empty", "today-label",
    "timer-value", "timer-toggle", "timer-reset", "timer-ring", "toast",
  ].forEach((id) => { elements[id] = document.getElementById(id); });
}

async function initialise() {
  cacheElements();
  initialiseTheme();
  initialiseNavigation();
  initialisePlanner();
  initialiseTimer();
  initialiseRevealAnimations();
  bindGlobalShortcuts();
  bindLibraryControls();

  try {
    const response = await fetch("/api/resources");
    if (!response.ok) throw new Error("Resource request failed");
    state.data = await response.json();
    renderLibrary();
    renderSyllabi();
    updateLibraryStats();
  } catch (error) {
    console.error(error);
    elements["library-unit-list"].innerHTML = `
      <div class="empty-state"><span>↻</span><h3>Library could not load</h3>
      <p>Please refresh the page in a moment.</p></div>`;
  }
}

function initialiseTheme() {
  const stored = localStorage.getItem(STORAGE.theme);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  setTheme(stored || (prefersDark ? "dark" : "light"));

  elements["theme-toggle"].addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE.theme, next);
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const icon = elements["theme-toggle"].querySelector(".theme-icon");
  icon.textContent = theme === "dark" ? "☀" : "☾";
  elements["theme-toggle"].setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
}

function initialiseNavigation() {
  const header = document.querySelector(".site-header");
  const updateHeader = () => header.classList.toggle("scrolled", window.scrollY > 12);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  elements["menu-toggle"].addEventListener("click", () => {
    const open = elements["menu-toggle"].getAttribute("aria-expanded") !== "true";
    elements["menu-toggle"].setAttribute("aria-expanded", String(open));
    elements["mobile-menu"].classList.toggle("open", open);
    elements["mobile-menu"].setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("menu-open", open);
  });

  elements["mobile-menu"].querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMobileMenu));
}

function closeMobileMenu() {
  elements["menu-toggle"].setAttribute("aria-expanded", "false");
  elements["mobile-menu"].classList.remove("open");
  elements["mobile-menu"].setAttribute("aria-hidden", "true");
  document.body.classList.remove("menu-open");
}

function initialiseRevealAnimations() {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const items = [...document.querySelectorAll(".reveal")];
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const delay = Number(entry.target.dataset.delay || 0);
      window.setTimeout(() => entry.target.classList.add("visible"), delay);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
}

function bindGlobalShortcuts() {
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("resources").scrollIntoView({ behavior: "smooth" });
      window.setTimeout(() => elements["branch-search"].focus(), 420);
    }
    if (event.key === "Escape") {
      elements["branch-search"].blur();
      closeMobileMenu();
    }
  });
}

function bindLibraryControls() {
  elements["branch-search"].addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderLibrary();
  });

  elements["library-branch-list"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-library-branch]");
    if (!button) return;
    state.branch = button.dataset.libraryBranch;
    const branch = state.data.branches.find((item) => item.id === state.branch);
    if (!branch.subjectIds.includes(state.librarySubject)) state.librarySubject = branch.subjectIds[0];
    renderLibrary();
  });

  elements["branch-subject-list"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-branch-subject]");
    if (!button) return;
    state.librarySubject = button.dataset.branchSubject;
    renderLibrary();
  });
}

function countCollectionPdfs(collection) {
  return collection.units.filter((unit) => Boolean(unit.pyqUrl)).length;
}

function renderLibrary() {
  const branches = state.data?.branches || [];
  const collections = state.data?.unitCollections || [];
  const visibleBranches = branches.filter((branch) => !state.query || `${branch.name} ${branch.code}`.toLowerCase().includes(state.query));
  elements["library-branch-count"].textContent = String(visibleBranches.length).padStart(2, "0");

  if (!visibleBranches.length) {
    elements["library-branch-list"].innerHTML = `<div class="subject-empty">No matching branch</div>`;
    elements["library-unit-list"].innerHTML = `
      <div class="empty-state"><span>⌕</span><h3>No matching branch</h3>
      <p>Try “Mechanical”, “Electrical” or “Food Technology”.</p></div>`;
    return;
  }

  if (!visibleBranches.some((branch) => branch.id === state.branch)) {
    state.branch = visibleBranches[0].id;
  }
  const selectedBranch = branches.find((branch) => branch.id === state.branch);
  const branchCollections = selectedBranch.subjectIds
    .map((subjectId) => collections.find((collection) => collection.id === subjectId))
    .filter(Boolean);
  if (!branchCollections.some((collection) => collection.id === state.librarySubject)) {
    state.librarySubject = branchCollections[0].id;
  }
  const selected = branchCollections.find((collection) => collection.id === state.librarySubject);

  elements["library-branch-list"].innerHTML = visibleBranches.map((branch) => {
    return `
      <button class="library-subject ${branch.id === selectedBranch.id ? "active" : ""}" data-library-branch="${branch.id}" type="button">
        <span class="library-subject-icon branch-code" aria-hidden="true">${escapeHtml(branch.code)}</span>
        <span class="library-subject-copy"><strong>${escapeHtml(branch.name)}</strong><small>${branch.subjectIds.length} first-year subjects</small></span>
        <span class="library-subject-arrow" aria-hidden="true">›</span>
      </button>`;
  }).join("");

  elements["library-branch-breadcrumb"].textContent = selectedBranch.name;
  elements["library-subject-breadcrumb"].textContent = selected.name;
  elements["library-branch-name"].textContent = selectedBranch.name;
  elements["library-branch-status"].textContent = `${branchCollections.length} subjects`;
  elements["branch-subject-list"].innerHTML = branchCollections.map((collection) => `
    <button class="branch-subject ${collection.id === selected.id ? "active" : ""}" data-branch-subject="${collection.id}" type="button">
      <span aria-hidden="true">${subjectEmoji[collection.id] || "•"}</span>${escapeHtml(collection.name)}
    </button>
  `).join("");
  elements["library-course-icon"].textContent = subjectEmoji[selected.id] || "•";
  elements["library-course-name"].textContent = selected.name;
  elements["library-course-description"].textContent = selected.description;
  const pdfCount = countCollectionPdfs(selected);
  elements["library-course-status"].textContent = pdfCount
    ? `${selected.units.length} units · ${pdfCount} PDFs ready`
    : `${selected.units.length} unit folders ready`;
  elements["library-unit-list"].dataset.accent = selected.accent;
  elements["library-unit-list"].innerHTML = selected.units.map((unit, index) => renderUnit(selected, unit, index)).join("");

  elements["library-unit-list"].querySelectorAll("details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      elements["library-unit-list"].querySelectorAll("details[open]").forEach((other) => {
        if (other !== details) other.open = false;
      });
    });
  });
}

function renderUnit(collection, unit, index) {
  const materials = [
    {
      icon: "▶", title: "Lectures",
      description: unit.lectureUrl || collection.lectureUrl ? "Open the unit playlist" : "Playlist coming soon",
      url: unit.lectureUrl || collection.lectureUrl,
    },
    {
      icon: "≡", title: "Notes",
      description: unit.notesUrl || collection.notesUrl ? "Open the notes collection" : "Unit notes coming soon",
      url: unit.notesUrl || collection.notesUrl,
    },
    {
      icon: "✓", title: "PYQs",
      description: unit.pyqUrl ? `View only Unit ${unit.number} questions` : "Unit PYQs coming soon",
      url: unit.pyqUrl,
      featured: true,
    },
    {
      icon: "▤", title: "Books",
      description: unit.bookUrl || collection.booksUrl ? "Open recommended books" : "Recommended books coming soon",
      url: unit.bookUrl || collection.booksUrl,
    },
  ];
  const readyCount = materials.filter((material) => material.url).length;

  return `
    <details class="unit-card" ${index === 0 ? "open" : ""}>
      <summary>
        <span class="folder-icon" aria-hidden="true"><i></i></span>
        <span class="unit-summary-copy"><strong>Unit ${unit.number}</strong><small>${escapeHtml(unit.title)}</small></span>
        <span class="unit-ready"><b>${readyCount} available</b><i aria-hidden="true">+</i></span>
      </summary>
      <div class="unit-material-grid">
        ${materials.map((material) => renderMaterial(material)).join("")}
      </div>
    </details>`;
}

function renderMaterial(material) {
  const body = `
    <span class="unit-material-icon" aria-hidden="true">${material.icon}</span>
    <span class="unit-material-copy"><strong>${escapeHtml(material.title)}</strong><small>${escapeHtml(material.description)}</small></span>
    <b class="unit-material-action">${material.url ? "Open" : "Soon"}<span aria-hidden="true">${material.url ? "↗" : ""}</span></b>`;
  return material.url
    ? `<a class="unit-material ${material.featured ? "featured" : ""}" href="${escapeHtml(material.url)}" target="_blank" rel="noopener noreferrer">${body}</a>`
    : `<div class="unit-material disabled" aria-disabled="true">${body}</div>`;
}

function updateLibraryStats() {
  const collections = state.data?.unitCollections || [];
  const unitCount = collections.reduce((total, collection) => total + collection.units.length, 0);
  const pdfCount = collections.reduce((total, collection) => total + countCollectionPdfs(collection), 0);
  const coverage = unitCount ? Math.round((pdfCount / unitCount) * 100) : 0;

  elements["available-count"].textContent = String(pdfCount).padStart(2, "0");
  elements["hero-resource-count"].textContent = `${pdfCount} unit PDFs · ${collections.length} subjects`;
  elements["snapshot-pdf-badge"].textContent = `${pdfCount} PDFs`;
  elements["library-coverage-bar"].style.width = `${coverage}%`;
  elements["snapshot-subjects"].textContent = collections.length;
  elements["snapshot-units"].textContent = unitCount;
  elements["snapshot-pdfs"].textContent = pdfCount;
}

function renderSyllabi() {
  elements["syllabus-list"].innerHTML = state.data.syllabi.map((item, index) => {
    const body = `
      <span class="syllabus-number">${String(index + 1).padStart(2, "0")}</span>
      <p><strong>${escapeHtml(item.title)}</strong><small>${item.available ? "Official syllabus · PDF" : "Will be updated shortly"}</small></p>
      <span aria-hidden="true">${item.available ? "↗" : "···"}</span>`;
    return item.available
      ? `<a class="syllabus-item" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${body}</a>`
      : `<div class="syllabus-item disabled">${body}</div>`;
  }).join("");
}

function initialisePlanner() {
  elements["today-label"].textContent = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
  renderTasks();

  elements["task-form"].addEventListener("submit", (event) => {
    event.preventDefault();
    const title = elements["task-input"].value.trim();
    if (!title) return;
    state.tasks.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, done: false });
    elements["task-input"].value = "";
    persistTasks();
    renderTasks();
  });

  elements["task-list"].addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-task-toggle]");
    if (!checkbox) return;
    const task = state.tasks.find((item) => item.id === checkbox.dataset.taskToggle);
    if (task) task.done = checkbox.checked;
    persistTasks();
    renderTasks();
  });

  elements["task-list"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-task-delete]");
    if (!button) return;
    state.tasks = state.tasks.filter((item) => item.id !== button.dataset.taskDelete);
    persistTasks();
    renderTasks();
  });
}

function persistTasks() {
  saveStorage(STORAGE.tasks, state.tasks);
}

function renderTasks() {
  elements["task-empty"].hidden = state.tasks.length > 0;
  elements["task-list"].innerHTML = state.tasks.map((task) => `
    <label class="task-item ${task.done ? "done" : ""}">
      <input type="checkbox" data-task-toggle="${task.id}" ${task.done ? "checked" : ""} />
      <span>${escapeHtml(task.title)}</span>
      <button type="button" data-task-delete="${task.id}" aria-label="Delete task">×</button>
    </label>
  `).join("");
}

function initialiseTimer() {
  updateTimerDisplay();
  elements["timer-toggle"].addEventListener("click", () => {
    if (timerInterval) pauseTimer();
    else startTimer();
  });
  elements["timer-reset"].addEventListener("click", resetTimer);
}

function startTimer() {
  if (timerSeconds <= 0) timerSeconds = 25 * 60;
  timerInterval = window.setInterval(() => {
    timerSeconds -= 1;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      pauseTimer();
      showToast("Focus session complete. Take a short break!");
    }
  }, 1000);
  elements["timer-toggle"].textContent = "Pause";
  document.querySelector(".status-dot").textContent = "Focusing";
}

function pauseTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  elements["timer-toggle"].textContent = timerSeconds === 0 ? "Start again" : "Resume";
  document.querySelector(".status-dot").textContent = timerSeconds === 0 ? "Complete" : "Paused";
}

function resetTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 25 * 60;
  elements["timer-toggle"].textContent = "Start focus";
  document.querySelector(".status-dot").textContent = "Ready";
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  elements["timer-value"].textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const elapsed = 25 * 60 - timerSeconds;
  elements["timer-ring"].style.setProperty("--timer-progress", `${(elapsed / (25 * 60)) * 360}deg`);
  document.title = timerInterval ? `${elements["timer-value"].textContent} · Focus` : "First Year Resource Hub · HBTU";
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove("show"), 2500);
}

document.addEventListener("DOMContentLoaded", initialise);
