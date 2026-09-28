import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({
  entryPoints: [
    fileURLToPath(new URL("../src/utils/whale-pet.ts", import.meta.url)),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const {
  readPetPreferences,
  petSize,
  petBounds,
  clampPetPosition,
  relativePetPosition,
  restorePetPosition,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

test("whale defaults visible on desktop, hidden on compact screens", () => {
  assert.deepEqual(readPetPreferences(null, false), {
    visible: true,
    asleep: false,
    position: null,
  });
  assert.deepEqual(readPetPreferences(null, true), {
    visible: false,
    asleep: false,
    position: null,
  });
  assert.equal(petSize(760).width, 112);
  assert.equal(petSize(761).width, 156);
});
test("invalid or obsolete stored preferences never block the app", () => {
  for (const raw of ["{oops", "null", "[]", "false", "7", '"text"']) {
    assert.deepEqual(readPetPreferences(raw, false), {
      visible: true,
      asleep: false,
      position: null,
    });
  }
  assert.deepEqual(
    readPetPreferences(
      '{"visible":"false","asleep":1,"position":{"x":"2","y":0}}',
      true,
    ),
    { visible: false, asleep: false, position: null },
  );
  for (const position of [
    null,
    [],
    1,
    "invalid",
    { x: 0 },
    { x: null, y: 1 },
  ]) {
    assert.equal(
      readPetPreferences(JSON.stringify({ position }), false).position,
      null,
    );
  }
  assert.equal(
    readPetPreferences('{"position":{"x":1e999,"y":0}}', false).position,
    null,
  );
});
test("valid preferences persist visibility and sleep, normalized positions are clamped", () => {
  assert.deepEqual(
    readPetPreferences(
      '{"visible":false,"asleep":true,"position":{"x":-1,"y":3}}',
      false,
    ),
    { visible: false, asleep: true, position: { x: 0, y: 1 } },
  );
});
test("drag and keyboard positions stay inside desktop and mobile boundaries", () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 667 },
  ]) {
    const b = petBounds(viewport);
    assert.deepEqual(clampPetPosition({ x: -900, y: -900 }, viewport), {
      x: 12,
      y: 12,
    });
    assert.deepEqual(clampPetPosition({ x: 9999, y: 9999 }, viewport), {
      x: b.maxX,
      y: b.maxY,
    });
    const restored = restorePetPosition(null, viewport);
    assert.ok(
      restored.x >= 12 &&
        restored.x + petSize(viewport.width).width <= viewport.width - 12,
    );
    assert.ok(
      restored.y >= 12 &&
        restored.y + petSize(viewport.width).height <= viewport.height - 12,
    );
  }
});
test("relative positions survive resize and responsive pet-size changes", () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 667 },
  ]) {
    const relative = { x: 0.72, y: 0.35 };
    const actual = relativePetPosition(
      restorePetPosition(relative, viewport),
      viewport,
    );
    assert.ok(Math.abs(relative.x - actual.x) < 1e-10);
    assert.ok(Math.abs(relative.y - actual.y) < 1e-10);
  }
});
test("extremely small viewport has non-inverted bounds and finite stored coordinates", () => {
  const viewport = { width: 80, height: 80 };
  assert.deepEqual(petBounds(viewport), {
    minX: 12,
    minY: 12,
    maxX: 12,
    maxY: 12,
  });
  assert.deepEqual(
    relativePetPosition(restorePetPosition(null, viewport), viewport),
    { x: 0, y: 0 },
  );
});
