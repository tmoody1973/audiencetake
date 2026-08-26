import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(resolve(root, "contracts/fixtures/manifest.json"), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

let invalid = 0;
for (const pair of manifest) {
  const schema = JSON.parse(
    await readFile(resolve(root, "contracts/schemas", pair.schema), "utf8"),
  );
  const fixture = JSON.parse(
    await readFile(resolve(root, "contracts/fixtures", pair.fixture), "utf8"),
  );
  const validate = ajv.compile(schema);
  if (!validate(fixture)) {
    invalid += 1;
    console.error(`${pair.fixture} failed ${pair.schema}`);
    console.error(validate.errors);
  }
}

if (invalid > 0) {
  process.exitCode = 1;
} else {
  console.log(`Validated ${manifest.length} cross-runtime contract fixtures.`);
}
