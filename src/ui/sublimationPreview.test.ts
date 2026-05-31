import assert from "node:assert/strict";
import test from "node:test";

import { createSublimationPreviewItems } from "./sublimationPreview.ts";

test("creates Wakfuli-style sublimation preview items with capped levels", () => {
  const items = createSublimationPreviewItems({
    selections: [
      { sublimationId: "appret-3" },
      { sublimationId: "appret-3" },
      { sublimationId: "report-pa" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(items[0].name, "Apprêt III");
  assert.equal(items[0].rawLevel, 6);
  assert.equal(items[0].effectiveLevel, 4);
  assert.deepEqual(items[0].effectLines, ["+4 % Dommages infligés"]);
  assert.equal(items[1].name, "Report PA");
  assert.deepEqual(items[1].effectLines, ["Reporte 2 PA"]);
});
