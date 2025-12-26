import type { Stack } from "./stacks"
import type { CodeGenerationModel } from "./models"

export const EditorTheme = {
  ESPRESSO: "espresso",
  COBALT: "cobalt",
} as const

export type EditorTheme = typeof EditorTheme[keyof typeof EditorTheme]

export interface Settings {
  openAiApiKey: string | null
  openAiBaseURL: string | null
  screenshotOneApiKey: string | null
  isImageGenerationEnabled: boolean
  editorTheme: EditorTheme
  generatedCodeConfig: Stack
  codeGenerationModel: CodeGenerationModel
  // Only relevant for hosted version
  isTermOfServiceAccepted: boolean
  anthropicApiKey: string | null // Added property for anthropic API key
  shouldGenerateImages?: boolean // Whether to generate images for full mode
}

export const AppState = {
  INITIAL: "INITIAL",
  CODING: "CODING",
  CODE_READY: "CODE_READY",
} as const

export type AppState = typeof AppState[keyof typeof AppState]

export const ScreenRecorderState = {
  INITIAL: "initial",
  RECORDING: "recording",
  FINISHED: "finished",
} as const

export type ScreenRecorderState = typeof ScreenRecorderState[keyof typeof ScreenRecorderState]

export interface PromptContent {
  text: string
  images: string[] // Array of data URLs
}

export interface CodeGenerationParams {
  generationType: "create" | "update"
  inputMode: "image" | "video" | "text"
  prompt: PromptContent
  history?: PromptContent[]
  isImportedFromCode?: boolean
}

export type FullGenerationSettings = CodeGenerationParams & Settings
