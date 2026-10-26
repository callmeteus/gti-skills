import { describe, expect, it } from "vitest";

import { ArtworkCategory } from "../../src/core";
import { Formats } from "../../src/design";
import { Techniques } from "../../src/techniques";

describe("formats", () => {
    it("labels every output size and matches story by pixels", () => {
        expect(Formats.byId("story")?.short).toBe("Story");
        expect(Formats.match(1080, 1920)?.id).toBe("story");
        const square = Formats.byId("instagram-square") ?? Formats.defaultFor();
        expect(Formats.shortName(square)).toBe("Square");
    });
});

describe("techniques", () => {
    it("picks the story pack from a story format, not the feed-post pack", () => {
        expect(Techniques.forBrief(ArtworkCategory.THUMBNAIL).id).toBe("story");
        expect(Techniques.forBrief({
            formatId: "story"
        }).id).toBe("story");
        expect(Techniques.forBrief({
            category: ArtworkCategory.SOCIAL_CARD,
            formatId: "story"
        }).id).toBe("story");
    });
});
