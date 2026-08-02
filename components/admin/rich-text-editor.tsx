"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from "lucide-react";
import {
  richTextEditorHtml,
  richTextInlineHtml,
  richTextPlainText,
  sanitizeRichText,
} from "@/lib/rich-text";

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inline?: boolean;
};

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder = "Start writing…",
  inline = false,
}: RichTextEditorProps) {
  const [linkOpen,setLinkOpen]=useState(false);
  const [linkValue,setLinkValue]=useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            target: "_blank",
            rel: "noreferrer noopener",
          },
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: richTextEditorHtml(value),
    editorProps: {
      attributes: {
        class: "cms-rich-text-content",
        "aria-label": label,
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(inline ? richTextInlineHtml(activeEditor.getHTML()) : sanitizeRichText(activeEditor.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const incoming = inline
      ? `<p>${richTextInlineHtml(value)}</p>`
      : richTextEditorHtml(value);
    if (editor.getHTML() !== incoming) editor.commands.setContent(incoming, { emitUpdate: false });
  }, [editor, inline, value]);

  if (!editor) {
    return (
      <label className="cms-rich-text-field">
        <span>{label}</span>
        <div className="cms-rich-text-loading">Loading visual editor…</div>
      </label>
    );
  }

  const setLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    setLinkValue(current??"https://");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const href=linkValue.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const button = (
    labelText: string,
    active: boolean,
    disabled: boolean,
    action: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      className={active ? "active" : ""}
      aria-label={labelText}
      aria-pressed={active}
      title={labelText}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
        action();
      }}
    >
      {icon}
    </button>
  );

  const characters = richTextPlainText(editor.getHTML()).length;
  return (
    <div className="cms-rich-text-field">
      <span>{label}</span>
      <div className={`cms-rich-text-editor ${editor.isFocused ? "focused" : ""}`}>
        <div className="cms-rich-text-toolbar" role="toolbar" aria-label={`${label} formatting`}>
          {button("Bold", editor.isActive("bold"), !editor.can().chain().focus().toggleBold().run(), () => editor.chain().focus().toggleBold().run(), <Bold />)}
          {button("Italic", editor.isActive("italic"), !editor.can().chain().focus().toggleItalic().run(), () => editor.chain().focus().toggleItalic().run(), <Italic />)}
          {button("Underline", editor.isActive("underline"), !editor.can().chain().focus().toggleUnderline().run(), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon />)}
          <i aria-hidden="true" />
          {!inline && <>
            {button("Bulleted list", editor.isActive("bulletList"), !editor.can().chain().focus().toggleBulletList().run(), () => editor.chain().focus().toggleBulletList().run(), <List />)}
            {button("Numbered list", editor.isActive("orderedList"), !editor.can().chain().focus().toggleOrderedList().run(), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered />)}
            <i aria-hidden="true" />
          </>}
          {button("Add or edit link", editor.isActive("link"), editor.state.selection.empty, setLink, <LinkIcon />)}
          {button("Remove link", false, !editor.isActive("link"), () => editor.chain().focus().unsetLink().run(), <Unlink />)}
          {button("Clear formatting", false, !editor.can().chain().focus().unsetAllMarks().clearNodes().run(), () => editor.chain().focus().unsetAllMarks().clearNodes().run(), <RemoveFormatting />)}
          <span className="cms-rich-text-spacer" />
          {button("Undo", false, !editor.can().chain().focus().undo().run(), () => editor.chain().focus().undo().run(), <Undo2 />)}
          {button("Redo", false, !editor.can().chain().focus().redo().run(), () => editor.chain().focus().redo().run(), <Redo2 />)}
        </div>
        {linkOpen&&<form className="cms-rich-text-link" onSubmit={(event)=>{event.preventDefault();applyLink()}}>
          <label><span>Link address</span><input autoFocus aria-label="Link address" value={linkValue} onChange={(event)=>setLinkValue(event.target.value)} placeholder="https://example.com"/></label>
          <button type="button" onClick={()=>setLinkOpen(false)}>Cancel</button>
          <button type="submit">Apply link</button>
        </form>}
        <EditorContent editor={editor} />
        <footer>
          <span>Visual editor</span>
          <span>{characters.toLocaleString()} characters</span>
        </footer>
      </div>
    </div>
  );
}
