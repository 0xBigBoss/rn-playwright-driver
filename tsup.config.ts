import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    test: "src/test.ts",
    "harness/index": "harness/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
});
