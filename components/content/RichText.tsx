import { Fragment, type ReactNode } from "react";

/**
 * Renders a Tiptap/ProseMirror JSON document as React elements.
 *
 * Deliberately NOT dangerouslySetInnerHTML. The admin editor is the source
 * of this content, and an admin pasting from a webpage can carry arbitrary
 * markup along with it. Walking the node tree and emitting known elements
 * means unknown node types are ignored rather than executed — there is no
 * path from stored content to injected script.
 *
 * Anything the editor can produce and this doesn't handle simply renders
 * nothing, which is the safe direction to fail.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = {
  type?: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
  content?: Node[];
};

const isSafeHref = (href: unknown): href is string =>
  typeof href === "string" && /^(https?:\/\/|mailto:|tel:|\/)/i.test(href);

function applyMarks(node: Node, key: string): ReactNode {
  let out: ReactNode = node.text ?? "";

  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
      case "strong":
        out = <strong>{out}</strong>;
        break;
      case "italic":
      case "em":
        out = <em>{out}</em>;
        break;
      case "underline":
        out = <u>{out}</u>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "code":
        out = <code>{out}</code>;
        break;
      case "link": {
        const href = mark.attrs?.href;
        // javascript: and data: URLs are dropped — the text still renders,
        // it just isn't a link.
        if (!isSafeHref(href)) break;
        const external = /^https?:\/\//i.test(href);
        out = (
          <a
            href={href}
            className="underline underline-offset-2 hover:text-teal transition"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {out}
          </a>
        );
        break;
      }
    }
  }

  return <Fragment key={key}>{out}</Fragment>;
}

function renderNodes(nodes: Node[] | undefined, keyPrefix = ""): ReactNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node, i) => renderNode(node, `${keyPrefix}${i}`));
}

function renderNode(node: Node, key: string): ReactNode {
  if (!node || typeof node !== "object") return null;

  switch (node.type) {
    case "doc":
      return <Fragment key={key}>{renderNodes(node.content, `${key}-`)}</Fragment>;

    case "text":
      return applyMarks(node, key);

    case "paragraph":
      return (
        <p key={key} className="leading-[1.75] text-navy/78 mb-4 last:mb-0">
          {renderNodes(node.content, `${key}-`)}
        </p>
      );

    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 3), 2), 4);
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      const size =
        level === 2 ? "text-2xl md:text-3xl" : level === 3 ? "text-xl" : "text-lg";
      return (
        <Tag
          key={key}
          className={`font-display font-medium tracking-tight text-navy mt-8 mb-3 first:mt-0 ${size}`}
        >
          {renderNodes(node.content, `${key}-`)}
        </Tag>
      );
    }

    case "bulletList":
      return (
        <ul key={key} className="mb-5 flex flex-col gap-2.5 last:mb-0">
          {renderNodes(node.content, `${key}-`)}
        </ul>
      );

    case "orderedList":
      return (
        <ol key={key} className="mb-5 flex list-decimal flex-col gap-2.5 pl-5 last:mb-0">
          {renderNodes(node.content, `${key}-`)}
        </ol>
      );

    case "listItem":
      return (
        <li key={key} className="relative pl-6 leading-[1.6] text-navy/78 marker:text-teal">
          <span
            aria-hidden
            className="absolute left-0 top-[0.62em] h-1.5 w-1.5 rounded-full bg-teal"
          />
          {/* Paragraphs inside list items shouldn't add their own margin. */}
          <div className="[&>p]:mb-0">{renderNodes(node.content, `${key}-`)}</div>
        </li>
      );

    case "blockquote":
      return (
        <blockquote
          key={key}
          className="my-6 border-l-2 border-teal pl-5 italic text-navy/70"
        >
          {renderNodes(node.content, `${key}-`)}
        </blockquote>
      );

    case "horizontalRule":
      return <hr key={key} className="my-8 border-navy/10" />;

    case "hardBreak":
      return <br key={key} />;

    case "image": {
      const src = node.attrs?.src;
      if (!isSafeHref(src)) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element -- editor
        // content has no known intrinsic dimensions; next/image needs them.
        <img
          key={key}
          src={src}
          alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : ""}
          loading="lazy"
          className="my-6 w-full rounded-2xl object-cover"
        />
      );
    }

    default:
      // Unknown node type — render its children if it has any, otherwise
      // nothing. Never fall back to raw HTML.
      return node.content ? (
        <Fragment key={key}>{renderNodes(node.content, `${key}-`)}</Fragment>
      ) : null;
  }
}

export function RichText({
  doc,
  className,
}: {
  doc: unknown;
  className?: string;
}) {
  const root = doc as Node | null;
  if (!root || typeof root !== "object" || !Array.isArray(root.content)) return null;

  return <div className={className}>{renderNodes(root.content)}</div>;
}

/** True when a document has no renderable content, for hiding empty sections. */
export function isEmptyDoc(doc: unknown): boolean {
  const root = doc as Node | null;
  if (!root || typeof root !== "object" || !Array.isArray(root.content)) return true;
  return root.content.length === 0;
}
