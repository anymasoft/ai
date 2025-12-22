import { useEffect, useState } from "react";
import { fetchGenerationsList, fetchGenerationDetail, deleteGeneration, GenerationMetadata, GenerationDetail } from "../lib/generations-api";
import toast from "react-hot-toast";
import "./LoadSavedGeneration.css";

interface LoadSavedGenerationProps {
  onLoadGeneration: (detail: GenerationDetail) => void;
  isLoading?: boolean;
}

export default function LoadSavedGeneration({ onLoadGeneration, isLoading = false }: LoadSavedGenerationProps) {
  const [generations, setGenerations] = useState<GenerationMetadata[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch list of generations when component mounts or when dialog opens
  useEffect(() => {
    if (isOpen && generations.length === 0) {
      loadGenerationsList();
    }
  }, [isOpen]);

  const loadGenerationsList = async () => {
    setIsLoadingList(true);
    try {
      const list = await fetchGenerationsList(50);
      setGenerations(list);
    } catch (error) {
      toast.error("Failed to load generations");
      console.error(error);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSelectGeneration = async (generationId: string) => {
    try {
      toast.loading("Loading saved generation...");
      const detail = await fetchGenerationDetail(generationId);
      console.log(`[LoadSavedGeneration] Loaded generation ${generationId}:`, detail);

      // 🔧 DIAGNOSTICS: Check if generation has variants with HTML
      if (!detail.variants || detail.variants.length === 0) {
        toast.error("Generation has no saved variants");
        console.warn(`[LoadSavedGeneration] Generation ${generationId} has no variants`);
        return;
      }

      const validVariants = detail.variants.filter((v: any) => v.html && v.html.trim().length > 0);
      if (validVariants.length === 0) {
        toast.error("Generation has no valid HTML content");
        console.warn(`[LoadSavedGeneration] Generation ${generationId} has no HTML content:`, detail.variants);
        return;
      }

      toast.dismiss();
      onLoadGeneration(detail);
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to load generation details");
      console.error("[LoadSavedGeneration] Error loading generation:", error);
    }
  };

  const handleDeleteGeneration = async (generationId: string, event: React.MouseEvent) => {
    // Prevent triggering the parent button's click handler
    event.stopPropagation();

    try {
      const confirmed = confirm("Are you sure you want to delete this generation?");
      if (!confirmed) return;

      toast.loading("Deleting generation...");
      await deleteGeneration(generationId);
      toast.dismiss();
      toast.success("Generation deleted");

      // Remove from list
      setGenerations((prev) => prev.filter((g) => g.generation_id !== generationId));
    } catch (error) {
      toast.error("Failed to delete generation");
      console.error("[LoadSavedGeneration] Error deleting generation:", error);
    }
  };

  return (
    <div className="load-saved-generation">
      <button
        className="load-saved-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        title="Open a previously saved generation"
      >
        📁 Open Saved
      </button>

      {isOpen && (
        <div className="load-saved-dropdown">
          <div className="dropdown-header">
            <h3>Saved Generations</h3>
            <button
              className="close-btn"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          {isLoadingList ? (
            <div className="dropdown-loading">Loading...</div>
          ) : generations.length === 0 ? (
            <div className="dropdown-empty">No saved generations</div>
          ) : (
            <div className="generation-list">
              {generations.map((gen) => (
                <div key={gen.generation_id} className="generation-item-wrapper">
                  <button
                    className="generation-item"
                    onClick={() => handleSelectGeneration(gen.generation_id)}
                  >
                    <div className="gen-info">
                      <div className="gen-name">{gen.display_name}</div>
                      <div className="gen-variants">{gen.variants_count} variant{gen.variants_count !== 1 ? 's' : ''}</div>
                    </div>
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDeleteGeneration(gen.generation_id, e)}
                    title="Delete this generation"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
