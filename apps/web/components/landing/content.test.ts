import { describe, expect, it } from "bun:test";
import { parseVideoId } from "@repo/ui/youtube";
import { heroVideo } from "./content";

describe("landing content", () => {
  it("links the hero play button to a valid YouTube video ID", () => {
    // A typo here would send visitors to /watch's "doesn't look like a YouTube link" error.
    expect(parseVideoId(heroVideo)).toBe(heroVideo);
  });
});
