import { defineConfig } from "vite";

// Relative base so the build works at https://malek1414.github.io/starry/ or any other path.
export default defineConfig({
  base: "./",
  build: { target: "es2022" },
});
