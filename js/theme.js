(() => {
  const STORAGE_KEY = "thanhbinhbds_theme_v1";
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  function systemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function savedTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "dark" || saved === "light" ? saved : null;
  }

  function updateButtons(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const dark = theme === "dark";
      button.setAttribute("aria-label", dark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối");
      button.setAttribute("title", dark ? "Chế độ sáng" : "Chế độ tối");
      button.innerHTML = dark
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
    });
  }

  function applyTheme(theme, persist = false) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (metaTheme) metaTheme.setAttribute("content", theme === "dark" ? "#081713" : "#0b4f3c");
    if (persist) localStorage.setItem(STORAGE_KEY, theme);
    updateButtons(theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  applyTheme(savedTheme() || systemTheme());

  document.addEventListener("DOMContentLoaded", () => {
    updateButtons(root.dataset.theme || "light");

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-theme-toggle]");
      if (!button) return;
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
  });

  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", (event) => {
    if (!savedTheme()) applyTheme(event.matches ? "dark" : "light");
  });
})();
