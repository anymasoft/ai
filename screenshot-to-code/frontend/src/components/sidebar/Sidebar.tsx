import classNames from "classnames";
import { useAppStore } from "../../store/app-store";
import { useProjectStore } from "../../store/project-store";
import { AppState } from "../../types";
import CodePreview from "../preview/CodePreview";
// import TipLink from "../messages/TipLink";
import SelectAndEditModeToggleButton from "../select-and-edit/SelectAndEditModeToggleButton";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import HistoryDisplay from "../history/HistoryDisplay";
import Variants from "../variants/Variants";
// 🔧 ARCHIVED: UpdateImageUpload, UpdateImagePreview, Textarea removed for text-edit mode

interface SidebarProps {
  showSelectAndEditFeature: boolean;
  regenerate: () => void;
  cancelCodeGeneration: () => void;
  hideVariants?: boolean;  // 🔧 PARTIAL UPDATE: Hide variant UI during element mutations
}

function Sidebar({
  showSelectAndEditFeature,
  regenerate,
  cancelCodeGeneration,
  hideVariants = false,
}: SidebarProps) {
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);

  const { appState } = useAppStore();

  const { referenceImages, head, commits } = useProjectStore();

  const viewedCode =
    head && commits[head]
      ? commits[head].variants[commits[head].selectedVariantIndex].code
      : "";

  // Check if the currently selected variant is complete
  const isSelectedVariantComplete =
    head &&
    commits[head] &&
    commits[head].variants[commits[head].selectedVariantIndex].status ===
      "complete";

  // Check if the currently selected variant has an error
  const isSelectedVariantError =
    head &&
    commits[head] &&
    commits[head].variants[commits[head].selectedVariantIndex].status ===
      "error";

  // Get the error message from the selected variant
  const selectedVariantErrorMessage =
    head &&
    commits[head] &&
    commits[head].variants[commits[head].selectedVariantIndex].errorMessage;

  // Reset error expanded state when variant changes
  useEffect(() => {
    setIsErrorExpanded(false);
  }, [head, commits[head || ""]?.selectedVariantIndex]);

  return (
    <>
      {!hideVariants && <Variants />}

      {/* Show code preview when coding and the selected variant is not complete */}
      {appState === AppState.CODING && !isSelectedVariantComplete && (
        <div className="flex flex-col">
          <CodePreview code={viewedCode} />

          <div className="flex w-full">
            <Button
              onClick={cancelCodeGeneration}
              className="w-full dark:text-white dark:bg-gray-700"
            >
              Cancel All Generations
            </Button>
          </div>
        </div>
      )}

      {/* Show completion status when generation is done */}
      {appState === AppState.CODING && isSelectedVariantComplete && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-2">
          <div className="text-green-800 text-sm">
            <div className="font-medium flex items-center">
              ✓ Generation complete
            </div>
            <div className="text-xs text-green-700 mt-1">
              Your code is ready. Use Select & Edit to make updates.
            </div>
          </div>
        </div>
      )}

      {/* Show error message when selected option has an error */}
      {isSelectedVariantError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-2">
          <div className="text-red-800 text-sm">
            <div className="font-medium mb-1">
              This option failed to generate because
            </div>
            {selectedVariantErrorMessage && (
              <div className="mb-2">
                <div className="text-red-700 bg-red-100 border border-red-300 rounded px-2 py-1 text-xs font-mono break-words">
                  {selectedVariantErrorMessage.length > 200 && !isErrorExpanded
                    ? `${selectedVariantErrorMessage.slice(0, 200)}...`
                    : selectedVariantErrorMessage}
                </div>
                {selectedVariantErrorMessage.length > 200 && (
                  <button
                    onClick={() => setIsErrorExpanded(!isErrorExpanded)}
                    className="text-red-600 text-xs underline mt-1 hover:text-red-800"
                  >
                    {isErrorExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
            <div>Switch to another option above to make updates.</div>
          </div>
        </div>
      )}

      {/* 🎨 Visual-Edit Mode: Select & Edit + Regenerate */}
      {(appState === AppState.CODE_READY || isSelectedVariantComplete) &&
        !isSelectedVariantError && (
          <div className="flex items-center justify-end gap-x-2 mt-4">
            <Button
              onClick={regenerate}
              className="flex items-center gap-x-2 dark:text-white dark:bg-gray-700 regenerate-btn"
            >
              🔄 Regenerate
            </Button>
            {showSelectAndEditFeature && <SelectAndEditModeToggleButton />}
          </div>
        )}

      {/* Reference image display */}
      <div className="flex gap-x-2 mt-2">
        {referenceImages.length > 0 && (
          <div className="flex flex-col">
            <div
              className={classNames({
                "scanning relative": appState === AppState.CODING,
              })}
            >
              {/* 🔧 SIMPLIFICATION: Only image mode supported (video mode removed) */}
              <img
                className="w-[340px] border border-gray-200 rounded-md"
                src={referenceImages[0]}
                alt="Reference"
              />
            </div>
            <div className="text-gray-400 uppercase text-sm text-center mt-1">
              Original Screenshot
            </div>
          </div>
        )}
      </div>

      <HistoryDisplay shouldDisableReverts={appState === AppState.CODING} />
    </>
  );
}

export default Sidebar;
