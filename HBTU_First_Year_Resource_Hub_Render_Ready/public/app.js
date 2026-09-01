const STORAGE = {
  theme: "fyhub-theme",
  saved: "fyhub-saved",
  completed: "fyhub-completed",
  tasks: "fyhub-tasks",
};

const state = {
  data: null,
  subject: "all",
  type: "all",
  query: "",
  saved: new Set(readStorage(STORAGE.saved, [])),
  completed: new Set(readStorage(STORAGE.completed, [])),
  tasks: readStorage(STORAGE.tasks, []),
};

const subjectEmoji = {
  all: "✦",
  chemistry: "🧪",
  pc: "🗣️",
  bem: "⚙️",
  ees: "🌿",
  bet: "⚡",
  workshop: "🛠️",
  "food-tech": "🍞",
};

const typeMeta = {
  lecture: { label: "Lecture", icon: "▶" },
  notes: { label: "Notes", icon: "≡" },
  pyq: { label: "PYQ", icon: "✓" },
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cacheElements() {
  [
    "theme-toggle", "menu-toggle", "mobile-menu", "resource-search", "type-filters",
    "subject-tabs", "resource-grid", "result-count", "result-context", "clear-filters",
    "syllabus-list", "available-count", "hero-resource-count", "preview-progress-value",
    "preview-progress-bar", "progress-percent", "big-progress-bar", "completed-count",
    "saved-count", "remaining-count", "task-form", "task-input", "task-list", "task-empty",
    "today-label", "timer-value", "timer-toggle", "timer-reset", "timer-ring", "toast",
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

  try {
    const response = await fetch("/api/resources");
    if (!response.ok) throw new Error("Resource request failed");
    state.data = await response.json();
    renderSubjectTabs();
    renderSyllabi();
    renderResources();
    bindResourceControls();
    updateDashboardStats();
  } catch (error) {
    console.error(error);
    elements["resource-grid"].innerHTML = `
      <div class="empty-state"><span>↻</span><h3>Resources could not load</h3>
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
      window.setTimeout(() => elements["resource-search"].focus(), 420);
    }
    if (event.key === "Escape") {
      elements["resource-search"].blur();
      closeMobileMenu();
    }
  });
}

function flattenResources() {
  if (!state.data) return [];
  return state.data.subjects.flatMap((subject) => subject.resources.map((resource) => ({
    ...resource,
    subjectId: subject.id,
    subjectName: subject.shortName,
    accent: subject.accent,
  })));
}

function availableResources() {
  return flattenResources().filter((resource) => resource.available);
}

function renderSubjectTabs() {
  const tabs = [{ id: "all", shortName: "All subjects" }, ...state.data.subjects];
  elements["subject-tabs"].innerHTML = tabs.map((subject) => `
    <button class="subject-tab ${subject.id === state.subject ? "active" : ""}" data-subject="${subject.id}" type="button">
      <span aria-hidden="true">${subjectEmoji[subject.id] || "•"}</span>${escapeHtml(subject.shortName)}
    </button>
  `).join("");

  elements["subject-tabs"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-subject]");
    if (!button) return;
    state.subject = button.dataset.subject;
    elements["subject-tabs"].querySelectorAll(".subject-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
    renderResources();
  });
}

function bindResourceControls() {
  elements["resource-search"].addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderResources();
  });

  elements["type-filters"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    state.type = button.dataset.type;
    elements["type-filters"].querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip === button));
    renderResources();
  });

  elements["clear-filters"].addEventListener("click", clearFilters);

  elements["resource-grid"].addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-save]");
    const completeButton = event.target.closest("[data-complete]");
    if (saveButton) toggleSaved(saveButton.dataset.save);
    if (completeButton) toggleCompleted(completeButton.dataset.complete);
  });
}

function clearFilters() {
  state.subject = "all";
  state.type = "all";
  state.query = "";
  elements["resource-search"].value = "";
  elements["type-filters"].querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.type === "all"));
  elements["subject-tabs"].querySelectorAll(".subject-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.subject === "all"));
  renderResources();
}

function filteredResources() {
  return flattenResources().filter((resource) => {
    const subjectMatch = state.subject === "all" || resource.subjectId === state.subject;
    const typeMatch = state.type === "all"
      || (state.type === "saved" ? state.saved.has(resource.id) : resource.type === state.type);
    const text = `${resource.title} ${resource.description} ${resource.subjectName} ${resource.type}`.toLowerCase();
    const queryMatch = !state.query || text.includes(state.query);
    return subjectMatch && typeMatch && queryMatch;
  });
}

function renderResources() {
  const resources = filteredResources();
  const subjectName = state.subject === "all"
    ? "all subjects"
    : state.data.subjects.find((item) => item.id === state.subject)?.shortName || "this subject";

  elements["result-count"].textContent = `${resources.length} resource${resources.length === 1 ? "" : "s"}`;
  elements["result-context"].textContent = ` across ${subjectName}`;

  if (!resources.length) {
    elements["resource-grid"].innerHTML = `
      <div class="empty-state"><span>⌕</span><h3>No matching resources</h3>
      <p>Try a different keyword or clear the current filters.</p></div>`;
    return;
  }

  elements["resource-grid"].innerHTML = resources.map((resource) => {
    const meta = typeMeta[resource.type] || { label: resource.type, icon: "•" };
    const isSaved = state.saved.has(resource.id);
    const isComplete = state.completed.has(resource.id);
    return `
      <article class="resource-card ${isComplete ? "completed" : ""}" data-accent="${resource.accent}">
        <div class="resource-top">
          <span class="resource-icon" aria-hidden="true">${meta.icon}</span>
          <button class="save-button ${isSaved ? "saved" : ""}" type="button" data-save="${resource.id}" aria-label="${isSaved ? "Remove from" : "Add to"} saved resources" aria-pressed="${isSaved}">${isSaved ? "★" : "☆"}</button>
        </div>
        <span class="resource-type">${escapeHtml(meta.label)} · ${resource.available ? "Ready" : "Upcoming"}</span>
        <h3>${escapeHtml(resource.title)}</h3>
        <p>${escapeHtml(resource.description)}</p>
        <div class="resource-footer">
          <span class="subject-label">${escapeHtml(resource.subjectName)}</span>
          <div class="resource-actions">
            ${resource.available ? `
              <button class="complete-button ${isComplete ? "is-complete" : ""}" type="button" data-complete="${resource.id}" aria-label="${isComplete ? "Mark incomplete" : "Mark complete"}" aria-pressed="${isComplete}">✓</button>
              <a class="open-link" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">Open <span aria-hidden="true">↗</span></a>
            ` : `<span class="coming-soon">Coming soon</span>`}
          </div>
        </div>
      </article>`;
  }).join("");
}

function toggleSaved(id) {
  const willSave = !state.saved.has(id);
  if (willSave) state.saved.add(id);
  else state.saved.delete(id);
  saveStorage(STORAGE.saved, [...state.saved]);
  renderResources();
  updateDashboardStats();
  showToast(willSave ? "Saved to your personal collection." : "Removed from saved resources.");
}

function toggleCompleted(id) {
  const willComplete = !state.completed.has(id);
  if (willComplete) state.completed.add(id);
  else state.completed.delete(id);
  saveStorage(STORAGE.completed, [...state.completed]);
  renderResources();
  updateDashboardStats();
  showToast(willComplete ? "Nice work—resource marked complete." : "Resource moved back to your list.");
}

function updateDashboardStats() {
  if (!state.data) return;
  const available = availableResources();
  const validIds = new Set(available.map((resource) => resource.id));
  const completed = [...state.completed].filter((id) => validIds.has(id)).length;
  const saved = [...state.saved].filter((id) => flattenResources().some((resource) => resource.id === id)).length;
  const percent = available.length ? Math.round((completed / available.length) * 100) : 0;

  elements["available-count"].textContent = String(available.length).padStart(2, "0");
  elements["hero-resource-count"].textContent = `${available.length} ready links`;
  elements["preview-progress-value"].textContent = `${percent}%`;
  elements["preview-progress-bar"].style.width = `${percent}%`;
  elements["progress-percent"].textContent = `${percent}%`;
  elements["big-progress-bar"].style.width = `${percent}%`;
  elements["completed-count"].textContent = completed;
  elements["saved-count"].textContent = saved;
  elements["remaining-count"].textContent = Math.max(0, available.length - completed);
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
