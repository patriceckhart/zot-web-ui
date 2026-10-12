import type { HostModel } from "./protocol";

export type ModelPickerState = { provider: string; model: string; open: boolean };
export type ModelPickerAction =
  | { type: "select"; model: HostModel }
  | { type: "toggle" }
  | { type: "input"; model: string };

export function modelPickerReducer(state: ModelPickerState, action: ModelPickerAction): ModelPickerState {
  switch (action.type) {
    case "select":
      return { provider: action.model.provider ?? state.provider, model: action.model.id, open: false };
    case "toggle":
      return { ...state, open: !state.open };
    case "input":
      return { ...state, model: action.model };
  }
}

export function matchesModel(model: HostModel, selectedProvider: string, selectedID: string): boolean {
  return model.id === selectedID && (model.provider ?? selectedProvider) === selectedProvider;
}

// Older hosts can return duplicate catalog entries. Keep the first row for
// each effective provider/model identity, without collapsing other providers.
export function uniqueModels(models: HostModel[], defaultProvider: string): HostModel[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = JSON.stringify([model.provider ?? defaultProvider, model.id]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterModels(models: HostModel[], query: string): HostModel[] {
  const q = query.trim().toLowerCase();
  return q ? models.filter((m) => `${m.provider ?? ""}/${m.id} ${m.display_name ?? ""}`.toLowerCase().includes(q)) : models;
}
