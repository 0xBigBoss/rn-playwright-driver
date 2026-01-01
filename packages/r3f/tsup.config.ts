import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		helpers: "src/helpers.ts",
	},
	format: ["cjs", "esm"],
	dts: true,
	clean: true,
	external: [
		"react",
		"three",
		"@react-three/fiber",
		"@0xbigboss/rn-playwright-driver",
		"@0xbigboss/rn-playwright-driver/harness",
	],
});
