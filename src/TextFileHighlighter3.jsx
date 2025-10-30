import React, { useState, useRef, useMemo } from "react";

export default function TextHighlighter() {
  const [highlights, setHighlights] = useState([]);
  const text = `BERLIN, Oct 8 (Reuters) - A meeting of U.S. President Joe Biden with other leaders of the Ramstein group that supplies Kyiv with arms will send a strong signal of continued military support for Ukraine, a German government source said ahead of the summit on Saturday.
The summit on the sidelines of Biden's state visit to Germany will drive home the message that Russian President Vladimir Putin cannot hope to play for time and wait for Western support to cease, the source, who was speaking on condition of anonymity, told reporters in Berlin on Tuesday.
Biden will visit Germany Oct 10-13. On Oct. 12, French President Emmanuel Macron and British Prime Minister Keir Starmer will join Biden and German Chancellor Olaf Scholz for talks in Berlin before travelling on to the U.S. air base in the small western German town of Ramstein.
After Russia's full-scale invasion of Ukraine in 2022, the United States gathered like-minded nations in Ramstein, establishing a group of now some 50 nations that meet regularly to match Kyiv's arms requests with pledges of donors.
The gathering on Saturday will be the first meeting of the group at the level of leaders.
`;
  const containerRef = useRef(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString();
    if (!selectedText.trim()) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);

    const start = preRange.toString().length;
    const end = start + selectedText.length;

    // --- Handle overlaps (merge logic)
    let mergedStart = start;
    let mergedEnd = end;
    const nonOverlapping = [];

    highlights.forEach((h) => {
      // Overlapping or touching
      if (!(end < h.start || start > h.end)) {
        mergedStart = Math.min(mergedStart, h.start);
        mergedEnd = Math.max(mergedEnd, h.end);
      } else {
        nonOverlapping.push(h);
      }
    });

    const mergedText = text.slice(mergedStart, mergedEnd);
    const newHighlight = { start: mergedStart, end: mergedEnd, text: mergedText };

    setHighlights([...nonOverlapping, newHighlight]);
    selection.removeAllRanges();
  };

  const handleRemove = (start, end) => {
    setHighlights((prev) => prev.filter((h) => h.start !== start || h.end !== end));
  };

  // Concatenate in order (no added spaces)
  const concatenatedText = useMemo(() => {
    if (highlights.length === 0) return "";
    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    return sorted.map((h) => h.text).join(" ");
  }, [highlights]);

  // Render highlights
  const renderHighlightedText = () => {
    if (highlights.length === 0) return text;

    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    const parts = [];
    let lastIndex = 0;

    sorted.forEach((h, i) => {
      if (lastIndex < h.start) parts.push(<span key={`t${i}`}>{text.slice(lastIndex, h.start)}</span>);

      parts.push(
        <span
          key={`h${i}`}
          style={{
            backgroundColor: "yellow",
            borderRadius: "3px",
            padding: "0 3px",
            marginRight: "2px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{text.slice(h.start, h.end)}</span>
          <svg onClick={() => handleRemove(h.start, h.end)} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="red" width="14" height="14" style={{ cursor: "pointer" }} title="Remove highlight">
            <path fillRule="evenodd" d="M10 8.586l4.95-4.95a1 1 0 111.414 1.415L11.414 10l4.95 4.95a1 1 0 11-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 11-1.414-1.414L8.586 10l-4.95-4.95A1 1 0 115.05 3.636L10 8.586z" clipRule="evenodd" />
          </svg>
        </span>
      );

      lastIndex = h.end;
    });

    if (lastIndex < text.length) parts.push(<span key="end">{text.slice(lastIndex)}</span>);

    return parts;
  };

  return (
    <div>
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        style={{
          userSelect: "text",
          cursor: "text",
          lineHeight: "1.6",
          whiteSpace: "pre-wrap",
        }}
      >
        {renderHighlightedText()}
      </div>

      <div
        style={{
          background: "#f8f8f8",
          padding: "10px",
          marginTop: "10px",
          borderRadius: "6px",
          fontFamily: "monospace",
        }}
      >
        <strong>Highlights (with positions):</strong>
        <pre>{JSON.stringify(highlights, null, 2)}</pre>

        <strong>Concatenated Selected Text:</strong>
        <div style={{ color: "darkblue", marginTop: "5px" }}>{concatenatedText || "(none)"}</div>
      </div>
    </div>
  );
}
