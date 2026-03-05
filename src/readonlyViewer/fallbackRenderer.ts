import { escapeHtml } from "./webviewUtils";

function splitTableCells(line: string): string[] {
  const trimmedLine = line.trim();
  const withoutEdgePipes = trimmedLine.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdgePipes.split("|").map((cell) => cell.trim());
}

function renderInlineMarkdown(rawText: string): string {
  const codeSpanTokens: string[] = [];
  let html = escapeHtml(rawText);

  html = html.replace(/`([^`]+)`/g, (_match, codeText: string) => {
    const token = `@@CODESPAN${codeSpanTokens.length}@@`;
    codeSpanTokens.push(`<code>${codeText}</code>`);
    return token;
  });

  html = html.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
    (_match, altText: string, src: string, title?: string) => {
      const safeAltText = altText;
      const safeTitle = title ? ` title="${title}"` : "";
      return `<img src="${src}" alt="${safeAltText}"${safeTitle} />`;
    },
  );

  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
    (_match, text: string, href: string, title?: string) => {
      const safeText = text;
      const safeTitle = title ? ` title="${title}"` : "";
      return `<a href="${href}"${safeTitle}>${safeText}</a>`;
    },
  );

  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  for (let tokenIndex = 0; tokenIndex < codeSpanTokens.length; tokenIndex += 1) {
    html = html.replace(`@@CODESPAN${tokenIndex}@@`, codeSpanTokens[tokenIndex]);
  }

  return html;
}

export function renderMarkdownWithFallback(markdownContent: string): string {
  const lines = markdownContent.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenceStartMatch = line.match(/^```([\w-]+)?\s*$/);
    if (fenceStartMatch) {
      const language = fenceStartMatch[1] ?? "";
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      const escapedCode = escapeHtml(codeLines.join("\n"));
      const languageClass = language ? ` class="language-${language}"` : "";
      output.push(`<pre><code${languageClass}>${escapedCode}</code></pre>`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      output.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^(\|.*\|)$/.test(line) && index + 1 < lines.length) {
      const delimiterLine = lines[index + 1];
      if (/^\|?(\s*:?-{3,}:?\s*\|)+\s*$/.test(delimiterLine)) {
        const headers = splitTableCells(line);
        const alignments = splitTableCells(delimiterLine).map((cell) => {
          const normalized = cell.trim();
          const startsWithColon = normalized.startsWith(":");
          const endsWithColon = normalized.endsWith(":");
          if (startsWithColon && endsWithColon) {
            return "center";
          }
          if (endsWithColon) {
            return "right";
          }
          if (startsWithColon) {
            return "left";
          }
          return "";
        });

        index += 2;
        const rowHtml: string[] = [];
        while (index < lines.length && /^\|.*\|$/.test(lines[index])) {
          const rowCells = splitTableCells(lines[index]);
          const cells = rowCells.map((cell, cellIndex) => {
            const align = alignments[cellIndex]
              ? ` style="text-align: ${alignments[cellIndex]};"`
              : "";
            return `<td${align}>${renderInlineMarkdown(cell)}</td>`;
          });
          rowHtml.push(`<tr>${cells.join("")}</tr>`);
          index += 1;
        }

        const headerHtml = headers.map((header, cellIndex) => {
          const align = alignments[cellIndex]
            ? ` style="text-align: ${alignments[cellIndex]};"`
            : "";
          return `<th${align}>${renderInlineMarkdown(header)}</th>`;
        });
        output.push(
          `<table><thead><tr>${headerHtml.join("")}</tr></thead><tbody>${rowHtml.join("")}</tbody></table>`,
        );
        continue;
      }
    }

    const unorderedListMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unorderedListMatch) {
      const listItems: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        listItems.push(`<li>${renderInlineMarkdown(itemMatch[1])}</li>`);
        index += 1;
      }
      output.push(`<ul>${listItems.join("")}</ul>`);
      continue;
    }

    const orderedListMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedListMatch) {
      const listItems: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*\d+\.\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        listItems.push(`<li>${renderInlineMarkdown(itemMatch[1])}</li>`);
        index += 1;
      }
      output.push(`<ol>${listItems.join("")}</ol>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const currentQuoteMatch = lines[index].match(/^>\s?(.*)$/);
        if (!currentQuoteMatch) {
          break;
        }
        quoteLines.push(renderInlineMarkdown(currentQuoteMatch[1]));
        index += 1;
      }
      output.push(`<blockquote><p>${quoteLines.join("<br />")}</p></blockquote>`);
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      output.push("<hr />");
      index += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      if (
        /^#{1,6}\s+/.test(lines[index]) ||
        /^```/.test(lines[index]) ||
        /^\s*[-*+]\s+/.test(lines[index]) ||
        /^\s*\d+\.\s+/.test(lines[index]) ||
        /^>\s?/.test(lines[index])
      ) {
        break;
      }

      paragraphLines.push(lines[index]);
      index += 1;
    }
    if (paragraphLines.length === 0) {
      index += 1;
      continue;
    }
    output.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
  }

  return output.join("\n");
}
