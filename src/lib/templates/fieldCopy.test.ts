import { describe, expect, it } from "vitest";
import { addPhotoPlaceholder, requiredError } from "./fieldCopy";

describe("fieldCopy", () => {
  it("writes the photo placeholder with its article", () => {
    expect(addPhotoPlaceholder("Photo")).toBe("Add a photo");
    expect(addPhotoPlaceholder("Image")).toBe("Add an image");
    expect(addPhotoPlaceholder("Product image")).toBe("Add a product image");
    expect(addPhotoPlaceholder("CEO headshot")).toBe("Add a CEO headshot");
  });

  it("names the field a required error is about", () => {
    expect(requiredError({ label: "Headline", type: "text" })).toBe("Fill in the headline.");
    expect(requiredError({ label: "Photo", type: "image" })).toBe("Add a photo.");
  });
});
