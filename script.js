/* =========================================================
   CONFIG
   ========================================================= */
const ADMIN_CREDENTIALS = { username: "Dillibabu", password: "Dillibabu123" };
const STORAGE_KEYS = {
    responses: "portfolio_contact_responses",
    theme: "portfolio_theme",
    adminSession: "portfolio_admin_logged_in"
};

/* =========================================================
   TOAST HELPER
   ========================================================= */
function showToast(message) {
    let toast = document.querySelector(".toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* =========================================================
   THEME TOGGLE (persisted via localStorage)
   ========================================================= */
(function initTheme() {
    const root = document.documentElement;
    const toggleBtn = document.getElementById("theme-toggle");

    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    const initial = saved || (prefersLight ? "light" : "dark");
    root.setAttribute("data-theme", initial);

    toggleBtn.addEventListener("click", () => {
        const current = root.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem(STORAGE_KEYS.theme, next);
        showToast(next === "dark" ? "Dark mode enabled" : "Light mode enabled");
    });
})();

/* =========================================================
   TAB NAVIGATION (active state + mobile menu)
   ========================================================= */
(function initNav() {
    const tabs = document.querySelectorAll(".tab");
    const sections = document.querySelectorAll("main .section");
    const tabToggle = document.getElementById("tab-toggle");
    const tabList = document.getElementById("tab-list");

    tabToggle.addEventListener("click", () => {
        const isOpen = tabList.classList.toggle("open");
        tabToggle.setAttribute("aria-expanded", String(isOpen));
    });

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabList.classList.remove("open");
            tabToggle.setAttribute("aria-expanded", "false");
        });
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === id));
            }
        });
    }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });

    sections.forEach(section => observer.observe(section));
})();

/* =========================================================
   SKILL BAR ANIMATION (fills bars when scrolled into view)
   ========================================================= */
(function initSkillBars() {
    const bars = document.querySelectorAll(".bar-fill");
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("filled");
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });
    bars.forEach(bar => observer.observe(bar));
})();

/* =========================================================
   RESUME BUTTON (placeholder — informs the user)
   ========================================================= */
document.getElementById("resume-btn").addEventListener("click", (e) => {
    e.preventDefault();
    showToast("Add your resume PDF and link it here");
});

/* =========================================================
   EMAIL VALIDATION HELPER
   ========================================================= */
function isValidEmail(value) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value.trim());
}

function setFieldError(fieldId, errorId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(errorId);
    const wrapper = field.closest(".field");
    if (message) {
        wrapper.classList.add("invalid");
        errorEl.textContent = message;
    } else {
        wrapper.classList.remove("invalid");
        errorEl.textContent = "";
    }
}

/* =========================================================
   CONTACT FORM — validation + localStorage persistence
   ========================================================= */
(function initContactForm() {
    const form = document.getElementById("contact-form");
    const statusEl = document.getElementById("form-status");
    const emailInput = document.getElementById("email");

    // live email validation as the user types
    emailInput.addEventListener("input", () => {
        if (emailInput.value.trim() === "") { setFieldError("email", "email-error", ""); return; }
        if (!isValidEmail(emailInput.value)) {
            setFieldError("email", "email-error", "Enter a valid email address (e.g. name@example.com)");
        } else {
            setFieldError("email", "email-error", "");
        }
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();

        let hasError = false;

        if (!name) {
            setFieldError("name", "name-error", "Name is required");
            hasError = true;
        } else {
            setFieldError("name", "name-error", "");
        }

        if (!email) {
            setFieldError("email", "email-error", "Email is required");
            hasError = true;
        } else if (!isValidEmail(email)) {
            setFieldError("email", "email-error", "Enter a valid email address (e.g. name@example.com)");
            hasError = true;
        } else {
            setFieldError("email", "email-error", "");
        }

        if (!message) {
            setFieldError("message", "message-error", "Message can't be empty");
            hasError = true;
        } else {
            setFieldError("message", "message-error", "");
        }

        if (hasError) {
            statusEl.textContent = "// fix the errors above before sending";
            statusEl.className = "form-status error";
            return;
        }

        const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.responses) || "[]");
        responses.unshift({
            id: Date.now(),
            name,
            email,
            message,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEYS.responses, JSON.stringify(responses));

        statusEl.textContent = "✓ Message sent — thank you, " + name.split(" ")[0] + "!";
        statusEl.className = "form-status success";
        form.reset();
        showToast("Message saved locally");

        // refresh admin view in case it's open
        if (typeof renderResponses === "function") renderResponses();
    });
})();

/* =========================================================
   ADMIN LOGIN + RESPONSES VIEWER
   ========================================================= */
const loginView = document.getElementById("admin-login-view");
const dashboardView = document.getElementById("admin-dashboard");
const adminForm = document.getElementById("admin-login-form");
const adminStatus = document.getElementById("admin-status");
const logoutBtn = document.getElementById("logout-btn");
const responsesList = document.getElementById("responses-list");
const emptyState = document.getElementById("empty-state");
const responseCount = document.getElementById("response-count");
const clearAllBtn = document.getElementById("clear-all-btn");

function formatTimestamp(iso) {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function renderResponses() {
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.responses) || "[]");
    responseCount.textContent = `${responses.length} message${responses.length === 1 ? "" : "s"}`;

    if (responses.length === 0) {
        responsesList.innerHTML = "";
        emptyState.classList.remove("hidden");
        return;
    }
    emptyState.classList.add("hidden");

    responsesList.innerHTML = responses.map(r => `
    <div class="response-card" data-id="${r.id}">
      <div class="response-head">
        <span class="response-name">${escapeHTML(r.name)}</span>
        <span class="response-time">${formatTimestamp(r.timestamp)}</span>
      </div>
      <p class="response-email">${escapeHTML(r.email)}</p>
      <p class="response-message">${escapeHTML(r.message)}</p>
      <button class="response-delete" data-delete="${r.id}">delete ✕</button>
    </div>
  `).join("");
}

function showDashboard() {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    renderResponses();
}

function showLogin() {
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
    adminForm.reset();
    adminStatus.textContent = "";
}

// restore admin session on load
(function restoreAdminSession() {
    if (sessionStorage.getItem(STORAGE_KEYS.adminSession) === "true") {
        showDashboard();
    }
})();

adminForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        sessionStorage.setItem(STORAGE_KEYS.adminSession, "true");
        adminStatus.textContent = "";
        showDashboard();
        showToast("Welcome back, admin");
    } else {
        adminStatus.textContent = "✕ Invalid username or password";
        adminStatus.className = "form-status error";
    }
});

logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(STORAGE_KEYS.adminSession);
    showLogin();
    showToast("Logged out");
});

responsesList.addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-delete");
    if (!id) return;
    let responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.responses) || "[]");
    responses = responses.filter(r => String(r.id) !== id);
    localStorage.setItem(STORAGE_KEYS.responses, JSON.stringify(responses));
    renderResponses();
    showToast("Message deleted");
});

clearAllBtn.addEventListener("click", () => {
    if (confirm("Clear all saved messages? This can't be undone.")) {
        localStorage.setItem(STORAGE_KEYS.responses, "[]");
        renderResponses();
        showToast("All messages cleared");
    }
});