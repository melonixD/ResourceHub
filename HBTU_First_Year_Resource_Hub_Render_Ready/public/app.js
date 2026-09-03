const STORAGE = {
  theme: "helpdesk-theme",
  tasks: "helpdesk-tasks",
};

const state = {
  data: null,
  branch: "mechanical",
  subject: "chemistry",
  query: "",
  tasks: readStorage(STORAGE.tasks, []),
};

const subjectCodes = {
  chemistry: "CH",
  pc: "PC",
  bem: "BEM",
  ees: "EES",
  bet: "BET",
  workshop: "CWP",
  "food-tech": "FT",
};

const materialIcons = {
  lecture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z" /></svg>',
  notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" /></svg>',
  pyq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7zM15 3v5h4M10 12h6M10 16h5" /></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23zM20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23z" /></svg>',
};

const elements = {};
let timerSeconds = 25 * 60;
let timerInterval = null;

function readStorage(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed === null || typeof parsed === "undefined" ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value === null || typeof value === "undefined" ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function twoDigits(value) {
  return value < 10 ? "0" + value : String(value);
}

function cacheElements() {
  [
    "theme-toggle", "menu-toggle", "mobile-menu", "menu-backdrop", "available-count", "branch-count",
    "branch-search", "branch-list", "subject-pane", "subject-pane-branch", "subject-list", "content-pane", "path-branch",
    "path-subject", "subject-header", "subject-code", "course-name", "course-description", "course-status",
    "unit-list", "syllabus-list", "today-label", "task-form", "task-input", "task-list",
    "task-empty", "timer-status", "timer-ring", "timer-value", "timer-toggle", "timer-reset",
  ].forEach((id) => { elements[id] = document.getElementById(id); });
}

async function initialise() {
  cacheElements();
  initialiseTheme();
  initialiseNavigation();
  initialiseContacts();
  initialisePlanner();
  initialiseTimer();
  bindBrowserControls();

  try {
    state.data = await loadResourceData();
    renderBrowser();
    renderSyllabi();
    updateStats();
  } catch (error) {
    console.error(error);
    elements["branch-list"].innerHTML = '<p class="no-results">Branches could not load. Please refresh.</p>';
    elements["subject-list"].innerHTML = '<p class="no-results">Subjects could not load.</p>';
    elements["unit-list"].innerHTML =
      '<div class="empty-state"><h3>Resources unavailable</h3><p>Please refresh the page.</p></div>';
  }
}

async function loadResourceData() {
  const sources = ["/api/resources", "/resources.json"];
  let lastError;

  for (const source of sources) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error(source + " returned " + response.status);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error(source + " did not return JSON");
      const data = await response.json();
      if (!Array.isArray(data.branches) || !Array.isArray(data.unitCollections)) {
        throw new Error(source + " returned incomplete data");
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Resources could not be loaded");
}

function initialiseTheme() {
  const stored = localStorage.getItem(STORAGE.theme);
  const prefersDark = typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(stored || (prefersDark ? "dark" : "light"));
  elements["theme-toggle"].addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE.theme, next);
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#000000" : "#f5f5f7";
  elements["theme-toggle"].setAttribute(
    "aria-label",
    "Switch to " + (theme === "dark" ? "light" : "dark") + " theme"
  );
}

function initialiseNavigation() {
  elements["menu-toggle"].addEventListener("click", () => {
    const open = elements["menu-toggle"].getAttribute("aria-expanded") !== "true";
    setMenu(open);
  });
  elements["menu-backdrop"].addEventListener("click", closeMenu);
  elements["mobile-menu"].querySelectorAll(".drawer-nav a").forEach((link) => link.addEventListener("click", closeMenu));
}

function setMenu(open) {
  elements["menu-toggle"].setAttribute("aria-expanded", String(open));
  elements["menu-toggle"].setAttribute("aria-label", open ? "Close menu" : "Open menu");
  elements["mobile-menu"].classList.toggle("open", open);
  elements["mobile-menu"].setAttribute("aria-hidden", String(!open));
  elements["menu-backdrop"].classList.toggle("open", open);
  elements["menu-backdrop"].setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("menu-open", open);
}

function closeMenu() {
  setMenu(false);
}

function initialiseContacts() {
  document.querySelectorAll("[data-contact-trigger]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      button.querySelector("small").textContent = open ? "Tap to show WhatsApp" : "WhatsApp contact";
      button.querySelector(".profile-arrow").textContent = open ? "＋" : "−";
      panel.hidden = open;
    });
  });
}

function bindBrowserControls() {
  elements["branch-search"].addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderBranches();
  });

  elements["branch-list"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-branch]");
    if (!button) return;
    chooseBranch(button.dataset.branch);
  });

  elements["subject-list"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-subject]");
    if (!button) return;
    state.subject = button.dataset.subject;
    renderBrowser("subject");
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("resources").scrollIntoView({ behavior: "smooth" });
      elements["branch-search"].focus();
    }
    if (event.key === "Escape") {
      elements["branch-search"].blur();
      closeMenu();
    }
  });
}

function chooseBranch(branchId) {
  state.branch = branchId;
  const branch = state.data.branches.find((item) => item.id === state.branch);
  if (!branch.subjectIds.includes(state.subject)) state.subject = branch.subjectIds[0];
  renderBrowser("branch");
}

function visibleBranches() {
  const branches = state.data && state.data.branches ? state.data.branches : [];
  if (!state.query) return branches;
  return branches.filter((branch) =>
    (branch.name + " " + branch.code).toLowerCase().includes(state.query)
  );
}

function countPdfs(collection) {
  return collection.units.filter((unit) => Boolean(unit.pyqUrl)).length;
}

function renderBrowser(changeType) {
  renderBranches();
  const branches = state.data.branches;
  const collections = state.data.unitCollections;
  const branch = branches.find((item) => item.id === state.branch) || branches[0];
  state.branch = branch.id;
  const subjects = branch.subjectIds
    .map((id) => collections.find((collection) => collection.id === id))
    .filter(Boolean);
  if (!subjects.some((subject) => subject.id === state.subject)) state.subject = subjects[0].id;
  const subject = subjects.find((item) => item.id === state.subject);

  elements["subject-pane-branch"].textContent = branch.name;
  elements["subject-list"].innerHTML = subjects.map((item) => {
    return '<button class="subject-item ' + (item.id === subject.id ? "active" : "") +
      '" data-subject="' + item.id + '" type="button">' +
      '<span class="subject-monogram">' + escapeHtml(subjectCodes[item.id] || item.name.slice(0, 2)) + '</span>' +
      '<span><strong>' + escapeHtml(item.name) + '</strong><small>' + item.units.length + ' units</small></span>' +
      '<i aria-hidden="true">›</i></button>';
  }).join("");

  elements["path-branch"].textContent = branch.name;
  elements["path-subject"].textContent = subject.name;
  elements["subject-code"].textContent = subjectCodes[subject.id] || subject.name.slice(0, 2).toUpperCase();
  elements["course-name"].textContent = subject.name;
  elements["course-description"].textContent = subject.description;
  const pdfCount = countPdfs(subject);
  elements["course-status"].textContent = subject.units.length + " units" + (pdfCount ? " · " + pdfCount + " PDFs" : "");
  elements["unit-list"].innerHTML = subject.units.map((unit, index) => renderUnit(subject, unit, index)).join("");

  elements["unit-list"].querySelectorAll("details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      elements["unit-list"].querySelectorAll("details[open]").forEach((other) => {
        if (other !== details) other.open = false;
      });
    });
  });

  animateBrowser(changeType);
}

function animateBrowser(changeType) {
  if (!changeType || prefersReducedMotion()) return;

  if (changeType === "branch") {
    setStagger(elements["subject-list"], ".subject-item", 34);
    restartAnimation(elements["subject-list"], "subjects-entering");
  }

  setStagger(elements["unit-list"], ".unit-row", 42);
  restartAnimation(elements["subject-header"], "subject-entering");
  restartAnimation(elements["unit-list"], "units-entering");

  if (window.innerWidth <= 850) {
    const target = changeType === "branch" ? elements["subject-pane"] : elements["content-pane"];
    window.setTimeout(() => {
      try {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        target.scrollIntoView(true);
      }
    }, 140);
  }
}

function setStagger(container, selector, interval) {
  container.querySelectorAll(selector).forEach((item, index) => {
    item.style.animationDelay = String(index * interval) + "ms";
  });
}

function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function renderBranches() {
  const branches = visibleBranches();
  elements["branch-count"].textContent = String(branches.length);
  if (!branches.length) {
    elements["branch-list"].innerHTML = '<p class="no-results">No branch found</p>';
    return;
  }
  elements["branch-list"].innerHTML = branches.map((branch) => {
    return '<button class="branch-item ' + (branch.id === state.branch ? "active" : "") +
      '" data-branch="' + branch.id + '" type="button">' +
      '<span class="branch-code">' + escapeHtml(branch.code) + '</span>' +
      '<span>' + escapeHtml(branch.name) + '</span><i aria-hidden="true">›</i></button>';
  }).join("");
}

function renderUnit(subject, unit, index) {
  const materials = [
    {
      type: "lecture",
      title: "Lectures",
      description: unit.lectureUrl || subject.lectureUrl ? "Video playlist" : "Not added yet",
      url: unit.lectureUrl || subject.lectureUrl,
    },
    {
      type: "notes",
      title: "Notes",
      description: unit.notesUrl || subject.notesUrl ? "Study notes" : "Not added yet",
      url: unit.notesUrl || subject.notesUrl,
    },
    {
      type: "pyq",
      title: "PYQs",
      description: unit.pyqUrl ? "Unit " + unit.number + " question paper" : "Not added yet",
      url: unit.pyqUrl,
    },
    {
      type: "book",
      title: "Books",
      description: unit.bookUrl || subject.booksUrl ? "Recommended reading" : "Not added yet",
      url: unit.bookUrl || subject.booksUrl,
    },
  ];
  const ready = materials.filter((material) => material.url).length;
  return '<details class="unit-row" ' + (index === 0 ? "open" : "") + '>' +
    '<summary><span class="unit-index">' + twoDigits(unit.number) + '</span>' +
    '<span class="unit-title"><strong>Unit ' + unit.number + '</strong><small>' + escapeHtml(unit.title) + '</small></span>' +
    '<span class="unit-count">' + ready + ' available</span><span class="chevron" aria-hidden="true"></span></summary>' +
    '<div class="material-list">' + materials.map(renderMaterial).join("") + '</div></details>';
}

function renderMaterial(material) {
  const content = '<span class="material-icon">' + materialIcons[material.type] + '</span>' +
    '<span class="material-copy"><strong>' + escapeHtml(material.title) + '</strong><small>' +
    escapeHtml(material.description) + '</small></span>' +
    '<span class="material-action">' + (material.url ? "Open" : "Soon") +
    (material.url ? '<i aria-hidden="true">↗</i>' : "") + '</span>';
  return material.url
    ? '<a class="material-item" href="' + escapeHtml(material.url) +
      '" target="_blank" rel="noopener noreferrer">' + content + '</a>'
    : '<div class="material-item unavailable" aria-disabled="true">' + content + '</div>';
}

function renderSyllabi() {
  elements["syllabus-list"].innerHTML = state.data.syllabi.map((item, index) => {
    const content = '<span class="syllabus-index">' + twoDigits(index + 1) + '</span>' +
      '<span><strong>' + escapeHtml(item.title) + '</strong><small>' +
      (item.available ? "Official syllabus" : "Not available yet") + '</small></span>' +
      '<i aria-hidden="true">' + (item.available ? "↗" : "—") + '</i>';
    return item.available
      ? '<a class="syllabus-item" href="' + escapeHtml(item.url) +
        '" target="_blank" rel="noopener noreferrer">' + content + '</a>'
      : '<div class="syllabus-item unavailable">' + content + '</div>';
  }).join("");
}

function updateStats() {
  const pdfCount = state.data.unitCollections.reduce((total, subject) => total + countPdfs(subject), 0);
  elements["available-count"].textContent = String(pdfCount);
}

function initialisePlanner() {
  elements["today-label"].textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());
  renderTasks();

  elements["task-form"].addEventListener("submit", (event) => {
    event.preventDefault();
    const title = elements["task-input"].value.trim();
    if (!title) return;
    state.tasks.unshift({
      id: String(Date.now()) + "-" + Math.random().toString(16).slice(2),
      title,
      done: false,
    });
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
  elements["task-list"].innerHTML = state.tasks.map((task) => {
    return '<label class="task-item ' + (task.done ? "done" : "") + '">' +
      '<input type="checkbox" data-task-toggle="' + task.id + '" ' + (task.done ? "checked" : "") + ' />' +
      '<span>' + escapeHtml(task.title) + '</span>' +
      '<button type="button" data-task-delete="' + task.id + '" aria-label="Delete task">×</button></label>';
  }).join("");
}

function initialiseTimer() {
  updateTimer();
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
    updateTimer();
    if (timerSeconds <= 0) pauseTimer(true);
  }, 1000);
  elements["timer-toggle"].textContent = "Pause";
  elements["timer-status"].textContent = "Focusing";
}

function pauseTimer(complete = false) {
  window.clearInterval(timerInterval);
  timerInterval = null;
  elements["timer-toggle"].textContent = complete ? "Start again" : "Resume";
  elements["timer-status"].textContent = complete ? "Complete" : "Paused";
}

function resetTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 25 * 60;
  elements["timer-toggle"].textContent = "Start";
  elements["timer-status"].textContent = "Ready";
  updateTimer();
}

function updateTimer() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  elements["timer-value"].textContent =
    twoDigits(minutes) + ":" + twoDigits(seconds);
  const elapsed = 25 * 60 - timerSeconds;
  elements["timer-ring"].style.setProperty("--progress", ((elapsed / (25 * 60)) * 100) + "%");
  document.title = timerInterval
    ? elements["timer-value"].textContent + " · HelpDesk"
    : "HelpDesk · HBTU";
}

document.addEventListener("DOMContentLoaded", initialise);
