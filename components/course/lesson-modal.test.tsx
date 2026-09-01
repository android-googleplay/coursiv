import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LessonModal } from "./lesson-modal";

const baseProps={
  courseTitle:"Course",
  lessonTitle:"Lesson",
  onClose:vi.fn(),
  onRead:vi.fn(),
  onListen:vi.fn(),
};

describe("LessonModal",()=>{
  it("hides restart when a lesson has never started",()=>{
    expect(renderToStaticMarkup(<LessonModal {...baseProps}/>)).not.toContain("Restart lesson");
  });

  it("shows restart when lesson progress exists",()=>{
    expect(renderToStaticMarkup(<LessonModal {...baseProps} onRestart={vi.fn()}/>)).toContain("Restart lesson");
  });
});
