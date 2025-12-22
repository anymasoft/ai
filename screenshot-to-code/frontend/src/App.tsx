import { useEffect, useRef, useState } from "react";
import { generateCode } from "./generateCode";
import SettingsDialog from "./components/settings/SettingsDialog";
import { AppState, CodeGenerationParams, EditorTheme, Settings, FullGenerationSettings } from "./types";
import { IS_RUNNING_ON_CLOUD } from "./config";
import { PicoBadge } from "./components/messages/PicoBadge";
import { usePersistedState } from "./hooks/usePersistedState";
import TermsOfServiceDialog from "./components/TermsOfServiceDialog";
import { USER_CLOSE_WEB_SOCKET_CODE } from "./constants";
import { extractHistory } from "./components/history/utils";
import toast from "react-hot-toast";
import { Stack } from "./lib/stacks";
import useBrowserTabIndicator from "./hooks/useBrowserTabIndicator";
// import TipLink from "./components/messages/TipLink";
import { useAppStore } from "./store/app-store";
import { useProjectStore } from "./store/project-store";
import Sidebar from "./components/sidebar/Sidebar";
import PreviewPane from "./components/preview/PreviewPane";
import { GenerationSettings } from "./components/settings/GenerationSettings";
import StartPane from "./components/start-pane/StartPane";
import { Commit } from "./components/commits/types";
import { createCommit } from "./components/commits/utils";
import LoadSavedGeneration from "./components/LoadSavedGeneration";
// 🔧 ARCHIVED: GenerateFromText removed for MVP (text-to-code in /archived/text-edit-mode/)

function App() {
  const {
    // Inputs
    isImportedFromCode,
    setIsImportedFromCode,
    referenceImages,
    setReferenceImages,

    head,
    commits,
    addCommit,
    removeCommit,
    setHead,
    appendCommitCode,
    setCommitCode,
    resetCommits,
    resetHead,
    updateVariantStatus,
    resizeVariants,

    // Outputs
    appendExecutionConsole,
    resetExecutionConsoles,
  } = useProjectStore();

  const {
    disableInSelectAndEditMode,
    appState,
    setAppState,
    setIsPartialUpdateInProgress,
  } = useAppStore();

  // Settings
  // 🔒 SECURITY & 🔧 SIMPLIFICATION: API ключи удалены, модель зафиксирована на backend
  const [settings, setSettings] = usePersistedState<Settings>(
    {
      openAiBaseURL: null,
      isImageGenerationEnabled: true,
      editorTheme: EditorTheme.COBALT,
      generatedCodeConfig: Stack.HTML_TAILWIND,
      // Only relevant for hosted version
      isTermOfServiceAccepted: false,
    },
    "setting"
  );

  const wsRef = useRef<WebSocket>(null);

  const showSelectAndEditFeature =
    settings.generatedCodeConfig === Stack.HTML_TAILWIND ||
    settings.generatedCodeConfig === Stack.HTML_CSS;

  // Indicate coding state using the browser tab's favicon and title
  useBrowserTabIndicator(appState === AppState.CODING);

  // When the user already has the settings in local storage, newly added keys
  // do not get added to the settings so if it's falsy, we populate it with the default
  // value
  useEffect(() => {
    if (!settings.generatedCodeConfig) {
      setSettings((prev) => ({
        ...prev,
        generatedCodeConfig: Stack.HTML_TAILWIND,
      }));
    }
  }, [settings.generatedCodeConfig, setSettings]);

  // Track if we're currently doing a partial update (for UI hiding)
  const [isCurrentlyDoingPartialUpdate, setIsCurrentlyDoingPartialUpdate] = useState(false);

  // Functions
  const reset = () => {
    setAppState(AppState.INITIAL);
    disableInSelectAndEditMode();
    resetExecutionConsoles();
    setIsCurrentlyDoingPartialUpdate(false);

    resetCommits();
    resetHead();

    // Inputs
    setReferenceImages([]);
    setIsImportedFromCode(false);
  };

  const regenerate = () => {
    if (head === null) {
      toast.error(
        "No current version set. Please contact support via chat or Github."
      );
      throw new Error("Regenerate called with no head");
    }

    // Retrieve the previous command
    const currentCommit = commits[head];
    if (currentCommit.type !== "ai_create") {
      toast.error("Only the first version can be regenerated.");
      return;
    }

    // 🔧 MVP: Only image mode supported
    doCreate(referenceImages);
  };

  // Used when the user cancels the code generation
  const cancelCodeGeneration = () => {
    wsRef.current?.close?.(USER_CLOSE_WEB_SOCKET_CODE);
  };

  // Used for code generation failure as well
  const cancelCodeGenerationAndReset = (commit: Commit) => {
    // 🔧 CHECK: Are there any completed variants? If yes, DON'T reset state
    const hasCompletedVariants = commit.variants.some(
      (variant) => variant.status === "complete"
    );

    // If there are completed variants, keep them on screen with error status for the failed ones
    if (hasCompletedVariants) {
      console.log(
        "Generation failed but some variants are complete - keeping them on screen"
      );
      setAppState(AppState.CODE_READY);
      return;
    }

    // Only reset if ALL variants failed or never started
    // When the current commit is the first version, reset the entire app state
    if (commit.type === "ai_create") {
      reset();
    } else {
      // Otherwise, remove current commit from commits
      removeCommit(commit.hash);

      // Revert to parent commit
      const parentCommitHash = commit.parentHash;
      if (parentCommitHash) {
        setHead(parentCommitHash);
      } else {
        throw new Error("Parent commit not found");
      }

      setAppState(AppState.CODE_READY);
    }
  };

  function doGenerateCode(params: CodeGenerationParams) {
    // Reset the execution console
    resetExecutionConsoles();

    // Set the app state to coding during generation
    setAppState(AppState.CODING);

    // 🔒 SECURITY: Only merge safe settings, NO API keys sent to backend
    // API ключи теперь используются только на backend через env vars
    const updatedParams: FullGenerationSettings = {
      ...params,
      // Все безопасные settings (API ключи исключены):
      generatedCodeConfig: settings.generatedCodeConfig,
      isImageGenerationEnabled: settings.isImageGenerationEnabled,
      openAiBaseURL: settings.openAiBaseURL,
      editorTheme: settings.editorTheme,
      // 🔧 SIMPLIFICATION: Model fixed to gpt-4.1-mini on backend (no selection UI)
      isTermOfServiceAccepted: settings.isTermOfServiceAccepted,
    };

    // 🔧 PARTIAL UPDATE: Create only 1 variant for element mutations, 4 for full generation
    const isPartialUpdate = params.generationType === "update" && (params as any).updateMode === "partial";
    const variantCount = isPartialUpdate ? 1 : 4;

    // Set flag to hide variant UI during partial update
    setIsCurrentlyDoingPartialUpdate(isPartialUpdate);

    const baseCommitObject = {
      variants: Array(variantCount)
        .fill(null)
        .map(() => ({ code: "" })),
    };

    const commitInputObject =
      params.generationType === "create"
        ? {
            ...baseCommitObject,
            type: "ai_create" as const,
            parentHash: null,
            inputs: params.prompt,
          }
        : {
            ...baseCommitObject,
            type: "ai_edit" as const,
            parentHash: head,
            inputs: params.history
              ? params.history[params.history.length - 1]
              : { text: "", images: [] },
          };

    // Create a new commit and set it as the head
    const commit = createCommit(commitInputObject);
    addCommit(commit);
    setHead(commit.hash);

    // Store generation params for fallback handling
    const generationParams = updatedParams;

    generateCode(wsRef, updatedParams, {
      onChange: (token, variantIndex) => {
        appendCommitCode(commit.hash, variantIndex, token);
      },
      onSetCode: (code, variantIndex) => {
        setCommitCode(commit.hash, variantIndex, code);
      },
      onStatusUpdate: (line, variantIndex) =>
        appendExecutionConsole(variantIndex, line),
      onVariantComplete: (variantIndex) => {
        console.log(`Variant ${variantIndex} complete event received`);
        updateVariantStatus(commit.hash, variantIndex, "complete");
      },
      onVariantError: (variantIndex, error) => {
        console.error(`Error in variant ${variantIndex}:`, error);
        updateVariantStatus(commit.hash, variantIndex, "error", error);
      },
      onVariantCount: (count) => {
        console.log(`Backend is using ${count} variants`);
        resizeVariants(commit.hash, count);
      },
      onGenerationComplete: () => {
        // 🔧 Backend signaled generation is complete
        // Complete all variants that are still in "generating" state
        const currentCommit = commits[commit.hash];
        if (currentCommit) {
          currentCommit.variants.forEach((variant, index) => {
            if (variant.status === "generating") {
              console.log(`Completing pending variant ${index} at generation_complete signal`);
              updateVariantStatus(commit.hash, index, "complete");
            }
          });
        }
      },
      onPartialSuccess: (html: string) => {
        // 🔧 PARTIAL UPDATE: Apply element change to iframe and extract full HTML
        console.log("Partial update successful, applying element to preview");

        // 🔧 PREVENT IFRAME SRCDOC UPDATE: Set flag BEFORE updating commitCode
        // This prevents PreviewComponent from re-rendering iframe
        setIsPartialUpdateInProgress(true);

        try {
          // Get iframe from DOM (try desktop first, fallback to mobile)
          const desktopIframe = document.getElementById(
            "preview-desktop"
          ) as HTMLIFrameElement | null;
          const mobileIframe = document.getElementById(
            "preview-mobile"
          ) as HTMLIFrameElement | null;
          const iframe = desktopIframe || mobileIframe;

          if (!iframe || !iframe.contentDocument) {
            console.error("Could not access iframe for partial update");
            throw new Error("Iframe not accessible");
          }

          const iframeDoc = iframe.contentDocument;

          // Parse the updated HTML element from backend
          const parser = new DOMParser();
          const parsed = parser.parseFromString(html, "text/html");
          const updatedElement = parsed.body.firstElementChild;

          if (!updatedElement) {
            throw new Error("Could not parse updated element");
          }

          // Find and replace element by tag name in iframe
          // This is a simplified heuristic - finds first matching tag
          const tagName = updatedElement.tagName.toLowerCase();
          const matchingElements =
            iframeDoc.querySelectorAll(tagName);

          if (matchingElements.length === 0) {
            console.warn(
              `No matching ${tagName} element found in iframe, using first element`
            );
            // Fallback: try to replace first child of body
            const bodyFirstChild = iframeDoc.body.firstElementChild;
            if (bodyFirstChild) {
              bodyFirstChild.replaceWith(updatedElement);
            } else {
              throw new Error(
                "Could not find element to replace in iframe"
              );
            }
          } else {
            // Replace first matching element
            matchingElements[0].replaceWith(updatedElement);
          }

          // Extract full HTML from updated iframe
          const fullUpdatedHTML =
            iframeDoc.documentElement.outerHTML;

          // Update code with full HTML
          const currentCommit = commits[commit.hash];
          if (currentCommit) {
            setCommitCode(
              commit.hash,
              currentCommit.selectedVariantIndex,
              fullUpdatedHTML
            );
            updateVariantStatus(
              commit.hash,
              currentCommit.selectedVariantIndex,
              "complete"
            );
          }
        } catch (error) {
          console.error("Error applying partial update:", error);
          // Fallback to full regenerate on any error
          doGenerateCode({
            ...generationParams,
            updateMode: "full",
            selectedElement: undefined,
          });
        } finally {
          // 🔧 ALLOW IFRAME SRCDOC UPDATE: Clear flag after partial update completes
          // This allows future full generates to update iframe normally
          setIsPartialUpdateInProgress(false);
        }
      },
      onPartialFailed: () => {
        // 🔧 PARTIAL UPDATE: Failed, trigger full regenerate as fallback
        console.log("Partial update failed, falling back to full regenerate");

        // 🔧 Clear partial update flag if it was still set
        setIsPartialUpdateInProgress(false);

        // Re-run full code generation with same parameters but in full mode
        doGenerateCode({
          ...generationParams,
          updateMode: "full",
          selectedElement: undefined,
        });
      },
      onCancel: () => {
        cancelCodeGenerationAndReset(commit);
      },
      onComplete: () => {
        setAppState(AppState.CODE_READY);
      },
    });
  }

  // Initial version creation
  // 🔧 SIMPLIFICATION: Only image mode supported (video mode removed)
  function doCreate(referenceImages: string[]) {
    // Reset any existing state
    reset();

    // Set the input states
    setReferenceImages(referenceImages);

    // Kick off the code generation
    if (referenceImages.length > 0) {
      doGenerateCode({
        generationType: "create",
        inputMode: "image",
        prompt: { text: "", images: [referenceImages[0]] },
      });
    }
  }

  // Subsequent updates (visual-edit mode only)
  async function doUpdate(
    updateInstruction: string,
    selectedElement?: HTMLElement
  ) {
    if (updateInstruction.trim() === "") {
      toast.error("Please include some instructions for AI on what to update.");
      return;
    }

    if (head === null) {
      toast.error(
        "No current version set. Contact support or open a Github issue."
      );
      throw new Error("Update called with no head");
    }

    let historyTree;
    try {
      historyTree = extractHistory(head, commits);
    } catch {
      toast.error(
        "Version history is invalid. This shouldn't happen. Please contact support or open a Github issue."
      );
      throw new Error("Invalid version history");
    }

    let modifiedUpdateInstruction = updateInstruction;

    // Send in a reference to the selected element if it exists
    if (selectedElement) {
      modifiedUpdateInstruction =
        updateInstruction +
        " referring to this element specifically: " +
        selectedElement.outerHTML;
    }

    const updatedHistory = [
      ...historyTree,
      { text: modifiedUpdateInstruction, images: [] },
    ];

    // 🎨 MVP: Visual-edit mode only (image-based code updates)
    // 🔧 PARTIAL UPDATE: Use partial mode if element is selected
    doGenerateCode({
      generationType: "update",
      inputMode: "image",
      prompt: { text: "", images: [referenceImages[0]] },
      history: updatedHistory,
      isImportedFromCode,
      updateMode: selectedElement ? "partial" : "full",
      selectedElement: selectedElement ? selectedElement.outerHTML : undefined,
    });
  }

  const handleTermDialogOpenChange = (open: boolean) => {
    setSettings((s) => ({
      ...s,
      isTermOfServiceAccepted: !open,
    }));
  };

  function setStack(stack: Stack) {
    setSettings((prev) => ({
      ...prev,
      generatedCodeConfig: stack,
    }));
  }

  function importFromCode(code: string, stack: Stack) {
    // Reset any existing state
    reset();

    // Set input state
    setIsImportedFromCode(true);

    // Set up this project
    setStack(stack);

    // Create a new commit and set it as the head
    const commit = createCommit({
      type: "code_create",
      parentHash: null,
      variants: [{ code }],
      inputs: null,
    });
    addCommit(commit);
    setHead(commit.hash);

    // Set the app state
    setAppState(AppState.CODE_READY);
  }

  function loadSavedGenerationDetail(generationDetail: any) {
    // 🔧 NEW: Load a previously saved generation from database
    // Do NOT reset state - load in addition to existing content

    // Create a new commit with saved variants
    const variants = generationDetail.variants.map((variant: any) => ({
      code: variant.html || "",
    }));

    const commit = createCommit({
      type: "ai_create" as const,
      parentHash: null,
      variants,
      inputs: null, // No inputs available for saved generation
    });

    addCommit(commit);
    setHead(commit.hash);

    // Update variant statuses based on saved data
    for (let i = 0; i < variants.length; i++) {
      const variant = generationDetail.variants[i];
      if (variant.status === "done") {
        updateVariantStatus(commit.hash, i, "complete");
      } else if (variant.status === "failed") {
        updateVariantStatus(commit.hash, i, "error", variant.error_message);
      }
    }

    // Set the app state to show the code
    setAppState(AppState.CODE_READY);

    toast.success("Generation loaded from database");
  }

  return (
    <div className="mt-2 dark:bg-black dark:text-white">
      {IS_RUNNING_ON_CLOUD && <PicoBadge />}
      {IS_RUNNING_ON_CLOUD && (
        <TermsOfServiceDialog
          open={!settings.isTermOfServiceAccepted}
          onOpenChange={handleTermDialogOpenChange}
        />
      )}
      <div className="lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-96 lg:flex-col">
        <div className="flex grow flex-col gap-y-2 overflow-y-auto border-r border-gray-200 bg-white px-6 dark:bg-zinc-950 dark:text-white">
          {/* Header with access to settings */}
          <div className="flex items-center justify-between mt-10 mb-2">
            <h1 className="text-2xl ">Screenshot to Code</h1>
            <SettingsDialog settings={settings} setSettings={setSettings} />
          </div>

          {/* Generation settings like stack and model */}
          <GenerationSettings settings={settings} setSettings={setSettings} />

          {/* 🔧 NEW: Load previously saved generation from database */}
          <LoadSavedGeneration
            onLoadGeneration={loadSavedGenerationDetail}
            isLoading={appState === AppState.CODING}
          />

          {/* Show tip link until coding is complete */}
          {/* {appState !== AppState.CODE_READY && <TipLink />} */}

          {/* 🔒 SECURITY: Проверка openAiApiKey удалена - API ключи теперь только на backend */}
          {/* OnboardingNote может быть показан только если backend не настроен */}

          {/* 🔧 ARCHIVED: GenerateFromText (text-to-code) removed for MVP */}

          {/* Rest of the sidebar when we're not in the initial state */}
          {(appState === AppState.CODING ||
            appState === AppState.CODE_READY) && (
            <Sidebar
              showSelectAndEditFeature={showSelectAndEditFeature}
              regenerate={regenerate}
              cancelCodeGeneration={cancelCodeGeneration}
              hideVariants={isCurrentlyDoingPartialUpdate}
            />
          )}
        </div>
      </div>

      <main className="py-2 lg:pl-96">
        {appState === AppState.INITIAL && (
          <StartPane
            doCreate={doCreate}
            importFromCode={importFromCode}
          />
        )}

        {(appState === AppState.CODING || appState === AppState.CODE_READY) && (
          <PreviewPane doUpdate={doUpdate} reset={reset} settings={settings} />
        )}
      </main>
    </div>
  );
}

export default App;
