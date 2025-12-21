import { Stack } from "./lib/stacks";

export enum EditorTheme {
  ESPRESSO = "espresso",
  COBALT = "cobalt",
}

export interface Settings {
  // 🔒 SECURITY: API ключи теперь ТОЛЬКО на backend через env vars
  // 🔧 SIMPLIFICATION: Model is fixed on backend (gpt-4.1-mini), user cannot select

  openAiBaseURL: string | null;
  isImageGenerationEnabled: boolean;
  editorTheme: EditorTheme;
  generatedCodeConfig: Stack;
  // Only relevant for hosted version
  isTermOfServiceAccepted: boolean;
}

export enum AppState {
  INITIAL = "INITIAL",
  CODING = "CODING",
  CODE_READY = "CODE_READY",
}

export enum ScreenRecorderState {
  INITIAL = "initial",
  RECORDING = "recording",
  FINISHED = "finished",
}

export interface PromptContent {
  text: string;
  images: string[]; // Array of data URLs
}

export interface CodeGenerationParams {
  generationType: "create" | "update";
  inputMode: "image" | "text";  // 🔧 Video mode removed for MVP simplification
  prompt: PromptContent;
  history?: PromptContent[];
  isImportedFromCode?: boolean;
  // 🔧 PARTIAL UPDATE: For Select & Edit element updates
  updateMode?: "full" | "partial";
  selectedElement?: string; // outerHTML of selected element
}

export type FullGenerationSettings = CodeGenerationParams & Settings;
