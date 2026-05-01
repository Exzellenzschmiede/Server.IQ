import React from "react";

/** Minimal Markdown renderer: bold, italic, inline code, code blocks, headers, lists. */
export default function Markdown({ children }: { children: string }) {
  const lines = children.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-slate-950 border border-slate-700/50 rounded-lg p-3 overflow-x-auto my-2">
          {lang && <div className="text-[10px] text-slate-500 mb-1 font-mono">{lang}</div>}
          <code className="text-xs font-mono text-slate-200 whitespace-pre">{codeLines.join("\n")}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls = level === 1 ? "text-base font-bold text-slate-100 mt-3 mb-1"
                : level === 2 ? "text-sm font-semibold text-slate-200 mt-2 mb-1"
                              : "text-xs font-semibold text-slate-300 mt-2 mb-0.5";
      elements.push(<p key={i} className={cls}>{inlineFormat(headingMatch[2])}</p>);
      i++;
      continue;
    }

    // Unordered list item
    if (/^[\s]*[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*+]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc list-inside space-y-0.5 my-1 pl-2">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-slate-200">{inlineFormat(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list item
    if (/^[\s]*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal list-inside space-y-0.5 my-1 pl-2">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-slate-200">{inlineFormat(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-slate-700 my-2" />);
      i++;
      continue;
    }

    // Blank line → spacer
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-slate-200">{inlineFormat(line)}</p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  // Split on inline code, bold, italic
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-slate-800 text-emerald-300 rounded px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={i} className="font-semibold text-slate-100">{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
