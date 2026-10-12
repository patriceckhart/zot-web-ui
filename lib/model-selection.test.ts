import { describe, expect, test } from "bun:test";
import { filterModels, matchesModel, modelPickerReducer, uniqueModels } from "./model-selection";
import type { HostModel } from "./protocol";

const models: HostModel[] = [
  { provider: "first", id: "shared", display_name: "Fast model", reasoning: false },
  { provider: "second", id: "shared", display_name: "Deep model", reasoning: true },
];

describe("model picker", () => {
  test("selecting a model closes the dropdown and keeps the selected identity", () => {
    const initial = { provider: "first", model: "shared", open: true };
    const selected = modelPickerReducer(initial, { type: "select", model: models[1] });
    expect(selected).toEqual({ provider: "second", model: "shared", open: false });
    expect(initial.open).toBe(true);
    expect(modelPickerReducer(selected, { type: "toggle" })).toEqual({ ...selected, open: true });
  });
  test("selecting the current model also closes the dropdown", () => {
    expect(modelPickerReducer({ provider: "first", model: "shared", open: true }, { type: "select", model: models[0] }).open).toBe(false);
  });
  test("legacy model selection and typed input retain the provider", () => {
    const selected = modelPickerReducer({ provider: "first", model: "old", open: true }, { type: "select", model: { id: "new", reasoning: false } });
    expect(selected).toEqual({ provider: "first", model: "new", open: false });
    expect(modelPickerReducer(selected, { type: "input", model: "typed" })).toEqual({ ...selected, model: "typed" });
  });
});

describe("catalog deduplication", () => {
  test("duplicate provider/model rows are removed without changing first metadata", () => {
    const kimi = { provider: "kimi", id: "kimi-k2-thinking", reasoning: true, max_output: 32768 };
    const input = [kimi, { ...kimi, max_output: 32000 }, ...models, models[0]];
    expect(uniqueModels(input, "kimi")).toEqual([kimi, ...models]);
    expect(input).toHaveLength(5);
  });
  test("legacy rows use the current provider as their identity", () => {
    const legacy = { id: "shared", reasoning: false };
    expect(uniqueModels([legacy, ...models], "first")).toEqual([legacy, models[1]]);
  });
  test("empty catalogs remain empty", () => {
    expect(uniqueModels([], "first")).toEqual([]);
  });
});

describe("cross-provider model selection", () => {
  test("identical IDs from different providers stay distinct", () => {
    expect(models.map((m) => matchesModel(m, "second", "shared"))).toEqual([false, true]);
  });
  test("older hosts without provider fields keep the current provider", () => {
    expect(matchesModel({ id: "shared", reasoning: false }, "first", "shared")).toBe(true);
    expect(matchesModel({ id: "other", reasoning: false }, "first", "shared")).toBe(false);
  });
  test("search matches provider, qualified ID, model ID, and display name", () => {
    expect(filterModels(models, " SECOND ")).toEqual([models[1]]);
    expect(filterModels(models, "first/shared")).toEqual([models[0]]);
    expect(filterModels(models, "shared")).toEqual(models);
    expect(filterModels(models, "deep")).toEqual([models[1]]);
    expect(filterModels(models, "")).toEqual(models);
  });
});
