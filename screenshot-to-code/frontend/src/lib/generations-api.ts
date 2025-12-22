import { HTTP_BACKEND_URL } from "../config";

export interface GenerationMetadata {
  generation_id: string;
  created_at: string;
  display_name: string;
  variants_count: number;
}

export interface GenerationVariant {
  variant_index: number;
  status: string;
  html?: string;
  error_message?: string;
  created_at: string;
}

export interface GenerationDetail {
  id: string;
  created_at: string;
  status: string;
  variants: GenerationVariant[];
}

/**
 * Fetch list of all saved generations
 */
export async function fetchGenerationsList(limit: number = 20): Promise<GenerationMetadata[]> {
  try {
    const response = await fetch(`${HTTP_BACKEND_URL}/api/generations?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch generations: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching generations list:", error);
    throw error;
  }
}

/**
 * Fetch full details of a specific generation including variants with HTML
 */
export async function fetchGenerationDetail(generationId: string): Promise<GenerationDetail> {
  try {
    const response = await fetch(`${HTTP_BACKEND_URL}/api/generations/${generationId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch generation: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`Error fetching generation ${generationId}:`, error);
    throw error;
  }
}
