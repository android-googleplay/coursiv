import { richTextEditorHtml, richTextFeedbackHtml, richTextInlineHtml, richTextLegalReferenceHtml } from "@/lib/rich-text";

export function SafeRichText({
  value,
  className = "canonical-rich-text",
  as: Tag = "div",
  inline = false,
  emphasizeFeedback = false,
  emphasizeLegalText = false,
  highlights = [],
}: {
  value: string;
  className?: string;
  as?: "div" | "span" | "p" | "strong" | "h1" | "h2" | "h3";
  inline?: boolean;
  emphasizeFeedback?: boolean;
  emphasizeLegalText?: boolean;
  highlights?: string[];
}) {
  const html = emphasizeLegalText
    ? richTextLegalReferenceHtml(value)
    : emphasizeFeedback
    ? richTextFeedbackHtml(value, highlights)
    : inline
      ? richTextInlineHtml(value)
      : richTextEditorHtml(value);
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
