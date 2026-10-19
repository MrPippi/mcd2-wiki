import { describe, expect, it } from "vitest";
import { LANGS } from "../../../shared/langs";
import { langPaths } from "../../../src/lib/lang-paths";

describe("langPaths", () => {
  it("makes one path per language, in menu order", () => {
    expect(langPaths().map((path) => path.params.lang)).toEqual([...LANGS]);
  });

  it("passes the language on as a prop too", () => {
    for (const path of langPaths()) expect(path.props).toEqual({ lang: path.params.lang });
  });
});
