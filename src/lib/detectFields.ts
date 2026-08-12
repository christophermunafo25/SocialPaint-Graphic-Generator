import type { DetectFields } from "./stores/interfaces";

/**
 * Swappable "Suggest fields" hook for the Template Builder.
 *
 * TODO(vision): replace with a vision-model call that inspects the uploaded
 * background and proposes TemplateField boxes for the admin to correct. The
 * builder treats whatever this returns as suggestions only — the manual
 * overlay editor is the reliable baseline and never depends on this.
 */
export const detectFields: DetectFields = async (_imageUrl: string) => {
  throw new Error(
    "Automatic field suggestion is not available yet — draw fields on the image instead.",
  );
};

export const DETECT_FIELDS_AVAILABLE = false;
