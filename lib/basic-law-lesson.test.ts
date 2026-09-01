import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { basicLawStatusAutonomyLesson } from "./basic-law-lesson";

describe("Basic Law Claude-style lesson", () => {
  it("matches the Meet Claude screen rhythm", () => {
    const claude = JSON.parse(readFileSync(join(process.cwd(), "content/coursiv/courses/claude.json"), "utf8"));
    const meetClaudeTypes = claude.units[0].lessons[0].screens.map((screen: { type: string }) => screen.type);

    expect(basicLawStatusAutonomyLesson.screens).toHaveLength(27);
    expect(basicLawStatusAutonomyLesson.screens.map((screen) => screen.type)).toEqual(meetClaudeTypes);
  });

  it("uses interactions as understanding, practice and retrieval", () => {
    const screens = basicLawStatusAutonomyLesson.screens;
    expect(screens.filter((screen) => screen.interactionPolicy === "required-interaction").map((screen) => screen.order + 1)).toEqual([6, 8, 23]);
    expect(screens.filter((screen) => screen.interactionPolicy === "optional-practice").map((screen) => screen.order + 1)).toEqual([7, 21, 22, 25]);
  });

  it("keeps the three official legal anchors explicit", () => {
    const text = JSON.stringify(basicLawStatusAutonomyLesson);
    expect(text).toContain("不可分離的部分");
    expect(text).toContain("全國人民代表大會授權");
    expect(text).toContain("直轄於中央人民政府");
    expect(text).toContain("依照本法的規定");
  });
});
