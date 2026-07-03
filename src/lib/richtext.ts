type TiptapNode = {
  type?: string;
  text?: string;
  content?: TiptapNode[];
};

/** Flattens a Tiptap JSON doc to plain text (for cards, meta descriptions, seeds). */
export function tiptapToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const walk = (node: TiptapNode): string => {
    if (node.text) return node.text;
    if (!node.content) return "";
    return node.content.map(walk).join(node.type === "doc" ? "\n" : "");
  };
  return walk(doc as TiptapNode).trim();
}

/** Wraps plain text in a minimal Tiptap doc. */
export function plainTextToTiptap(text: string) {
  return {
    type: "doc",
    content: text
      .split("\n")
      .filter(Boolean)
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
  };
}
