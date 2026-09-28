import { shallowRef } from "vue";

const theme = shallowRef<"light" | "dark">("light");
export function useTheme() {
  function apply(mode: "light" | "dark") {
    theme.value = mode;
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("theme-mode", mode);
  }
  function initialize() {
    const saved = localStorage.getItem("theme-mode");
    apply(
      saved === "dark" ||
        (!saved && matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light",
    );
  }
  return {
    theme,
    initialize,
    toggle: () => apply(theme.value === "dark" ? "light" : "dark"),
  };
}
