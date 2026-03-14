// ─── minimal markdown → HTML renderer ───────────────────────────────────────

/**
 * Converts basic markdown to HTML.
 * Handles: headers, bold, italic, code, tables, lists, line breaks.
 * Safe for innerHTML (no script injection from AI responses).
 */
export function parseMarkdown(text) {
  if (!text) return "";

  // Escape HTML entities first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Tables: | col | col |
  html = html.replace(/(\|.+\|\n?)+/g, (tableBlock) => {
    const rows = tableBlock.trim().split("\n").filter(Boolean);
    if (rows.length < 2) return tableBlock;

    const parseRow = (row) =>
      row
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

    const isSeparator = (row) => /^[\s|:\-]+$/.test(row);

    let tableHtml = '<table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0">';
    let inBody = false;

    rows.forEach((row, i) => {
      if (isSeparator(row)) {
        inBody = true;
        return;
      }
      const cells = parseRow(row);
      const tag = !inBody && i === 0 ? "th" : "td";
      const style =
        tag === "th"
          ? 'style="padding:6px 8px;border-bottom:2px solid var(--border);text-align:left;font-weight:700;color:var(--accent)"'
          : 'style="padding:5px 8px;border-bottom:1px solid var(--border)"';
      tableHtml += "<tr>" + cells.map((c) => `<${tag} ${style}>${c}</${tag}>`).join("") + "</tr>";
    });

    tableHtml += "</table>";
    return tableHtml;
  });

  // Code blocks ```...```
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    return `<pre style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:10px;overflow-x:auto;font-size:12px;margin:8px 0"><code>${code.trim()}</code></pre>`;
  });

  // Inline code `...`
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--card);padding:2px 5px;border-radius:4px;font-size:12px">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="margin:12px 0 4px;font-size:14px;color:var(--accent)">$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2 style="margin:14px 0 6px;font-size:16px;color:var(--accent)">$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1 style="margin:16px 0 8px;font-size:18px;color:var(--accent)">$1</h1>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^[-*•] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n(?!<li>)|$)/g, '<ul style="margin:6px 0 6px 18px;padding:0">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<oli>$1</oli>");
  html = html.replace(/(<oli>[\s\S]*?<\/oli>)(\n(?!<oli>)|$)/g, (_, items) => {
    return '<ol style="margin:6px 0 6px 18px;padding:0">' + items.replace(/<\/?oli>/g, (t) => t === "<oli>" ? "<li>" : "</li>") + "</ol>";
  });

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:12px 0">');

  // Double newline → paragraph break
  html = html.replace(/\n\n/g, "<br><br>");
  html = html.replace(/\n/g, "<br>");

  return html;
}
