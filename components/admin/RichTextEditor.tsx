"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold, Heading2, Heading3, ImagePlus, Italic, List, ListOrdered,
  Loader2, Quote, Redo2, Strikethrough, Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ACCEPT_ATTRIBUTE, uploadImage } from "@/lib/uploadImage";

/**
 * Tiptap editor storing ProseMirror JSON — the same shape the public page's
 * RichText component renders, so what's authored is exactly what ships.
 *
 * Two modes:
 *  - pass `name` and it renders a hidden input, so a plain <form> posting to
 *    a server action picks it up with no client-side fetch.
 *  - pass `onChange` and it reports the document upward, for cases like the
 *    itinerary where many editors are serialised into one field.
 */
export function RichTextEditor({
  name,
  defaultValue,
  minHeight = 160,
  onChange,
}: {
  name?: string;
  defaultValue?: unknown;
  minHeight?: number;
  onChange?: (doc: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    // Next renders this on the server first; without false, hydration
    // mismatches on every editor on the page.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        horizontalRule: false,
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: isDoc(defaultValue) ? (defaultValue as object) : emptyDoc(),
    editorProps: { attributes: { class: "outline-none" } },
  });

  // The submitted value MUST live in React state. Tiptap mutates its own
  // document without re-rendering this component, so computing the hidden
  // input's value inline during render leaves it frozen at the initial doc
  // — the form then posts an empty document and every word typed is lost.
  const [json, setJson] = useState(() =>
    JSON.stringify(isDoc(defaultValue) ? defaultValue : emptyDoc()),
  );

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const doc = editor.getJSON();
      setJson(JSON.stringify(doc));
      onChange?.(doc);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, onChange]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploadError(null);
      setUploading(true);
      const result = await uploadImage(file, "inline");
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";

      if ("error" in result) {
        setUploadError(result.error);
        return;
      }
      editor.chain().focus().setImage({ src: result.url }).run();
    },
    [editor],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#e3e7ee] bg-white focus-within:border-teal focus-within:ring-[3px] focus-within:ring-teal/12">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#e3e7ee] bg-[#fbfcfe] px-2 py-1.5">
        <Tb editor={editor} onClick={(e) => e.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} label="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Tb>
        <Tb editor={editor} onClick={(e) => e.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} label="Italic">
          <Italic className="h-3.5 w-3.5" />
        </Tb>
        <Tb editor={editor} onClick={(e) => e.chain().focus().toggleStrike().run()} active={editor?.isActive("strike")} label="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </Tb>

        <span className="mx-1 h-4 w-px bg-[#e3e7ee]" />

        <Tb editor={editor} onClick={(e) => e.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} label="Large heading">
          <Heading2 className="h-3.5 w-3.5" />
        </Tb>
        <Tb editor={editor} onClick={(e) => e.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive("heading", { level: 3 })} label="Small heading">
          <Heading3 className="h-3.5 w-3.5" />
        </Tb>

        <span className="mx-1 h-4 w-px bg-[#e3e7ee]" />

        <Tb editor={editor} onClick={(e) => e.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} label="Bullet list">
          <List className="h-3.5 w-3.5" />
        </Tb>
        <Tb editor={editor} onClick={(e) => e.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")} label="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </Tb>
        <Tb editor={editor} onClick={(e) => e.chain().focus().toggleBlockquote().run()} active={editor?.isActive("blockquote")} label="Quote">
          <Quote className="h-3.5 w-3.5" />
        </Tb>

        <span className="mx-1 h-4 w-px bg-[#e3e7ee]" />

        <button
          type="button"
          title="Add a photo"
          aria-label="Add a photo"
          disabled={!editor || uploading}
          onClick={() => fileRef.current?.click()}
          className="grid h-7 w-7 place-items-center rounded-md text-[#5a6785] transition hover:bg-[#eef1f6] hover:text-[#16203a] disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        </button>

        <span className="ml-auto" />

        <Tb editor={editor} onClick={(e) => e.chain().focus().undo().run()} label="Undo">
          <Undo2 className="h-3.5 w-3.5" />
        </Tb>
        <Tb editor={editor} onClick={(e) => e.chain().focus().redo().run()} label="Redo">
          <Redo2 className="h-3.5 w-3.5" />
        </Tb>
      </div>

      <div className="px-4 py-3" style={{ minHeight }}>
        {editor ? (
          <EditorContent editor={editor} className="prose-admin text-[0.9rem] leading-[1.7]" />
        ) : (
          <p className="text-[0.85rem] text-[#8b96ad]">Loading editor…</p>
        )}
      </div>

      {uploadError && (
        <p className="border-t border-[#f0cfcf] bg-[#fdeaea] px-4 py-2 text-[0.78rem] font-medium text-[#c33a3a]">
          {uploadError}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void insertImage(file);
        }}
      />

      {name && <input type="hidden" name={name} value={json} readOnly />}
    </div>
  );
}

function Tb({
  editor, onClick, active, label, children,
}: {
  editor: Editor | null;
  onClick: (editor: Editor) => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={!editor}
      onClick={() => editor && onClick(editor)}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md transition disabled:opacity-40",
        active ? "bg-navy text-cream" : "text-[#5a6785] hover:bg-[#eef1f6] hover:text-[#16203a]",
      )}
    >
      {children}
    </button>
  );
}

const emptyDoc = () => ({ type: "doc", content: [{ type: "paragraph" }] });

function isDoc(v: unknown): boolean {
  return Boolean(v && typeof v === "object" && (v as { type?: string }).type === "doc");
}
