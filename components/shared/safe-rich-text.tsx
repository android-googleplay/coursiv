import { richTextEditorHtml, richTextInlineHtml } from "@/lib/rich-text";

export function SafeRichText({
  value,
  className = "canonical-rich-text",
  as: Tag = "div",
  inline = false,
}: {
  value: string;
  className?: string;
  as?: "div" | "span" | "p" | "strong" | "h1" | "h2" | "h3";
  inline?: boolean;
}) {
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: inline ? richTextInlineHtml(value) : richTextEditorHtml(value) }}
    />
  );
}
