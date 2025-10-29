import React, { useState, useRef } from "react";

export default function TextFileHighlighter() {
  const [files, setFiles] = useState([]); // { name, content, highlights: [[s,e]] }
  const [currentFileIndex, setCurrentFileIndex] = useState(null);
  const [selectedTexts, setSelectedTexts] = useState([]); // { fileName, text, start, end }
  const textRef = useRef(null);

  // ----- Upload -----
  const handleFileUpload = (e) => {
    const uploaded = Array.from(e.target.files || []);
    uploaded.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target.result;
        setFiles((prev) => {
          if (prev.some((p) => p.name === file.name)) return prev;
          return [...prev, { name: file.name, content, highlights: [] }];
        });
      };
      reader.readAsText(file);
    });
  };

  const getAbsoluteSelection = (container, rawContent, existingHighlights = []) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;

    let selectedString = sel.toString();
    if (!selectedString.trim()) return null;

    // helper to skip highlight control nodes (like cross icons)
    const isInsideControl = (node) => {
      let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      while (el) {
        if (el.getAttribute && el.getAttribute("data-x") === "true") return true;
        el = el.parentElement;
      }
      return false;
    };

    let charCount = 0;
    let start = -1;
    let end = -1;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.nodeValue ?? "";

      if (!text || !text.trim()) continue;
      if (isInsideControl(node)) continue;

      if (node === range.startContainer) start = charCount + range.startOffset;
      if (node === range.endContainer) {
        end = charCount + range.endOffset;
        break;
      }

      charCount += text.length;
    }

    if (start === -1 || end === -1 || start >= end) return null;

    // --- ✅ Trim whitespace in selection ---
    // Figure out how many leading/trailing whitespace characters to skip
    let preTrim = 0;
    let postTrim = 0;
    while (preTrim < selectedString.length && /\s/.test(selectedString[preTrim])) preTrim++;
    while (postTrim < selectedString.length && /\s/.test(selectedString[selectedString.length - 1 - postTrim])) postTrim++;

    if (preTrim > 0 || postTrim > 0) {
      start += preTrim;
      end -= postTrim;
      selectedString = selectedString.slice(preTrim, selectedString.length - postTrim);
    }

    // prevent overlapping highlights
    const overlaps = (existingHighlights || []).some(([hs, he]) => end > hs && start < he);
    if (overlaps) return null;

    return { start, end, selectedText: selectedString };
  };

  // ----- Merge overlapping / remove contained highlights helper -----
  const mergeAndAddHighlight = (highlights, newRange) => {
    const [ns, ne] = newRange;
    // remove any highlight that overlaps with newRange
    const filtered = (highlights || []).filter(([s, e]) => e <= ns || s >= ne);
    filtered.push([ns, ne]);
    filtered.sort((a, b) => a[0] - b[0]);
    return filtered;
  };

  // ----- On mouse up (create highlight) -----
  const handleMouseUp = () => {
    if (currentFileIndex === null) return;
    const file = files[currentFileIndex];
    if (!file || !textRef.current) return;

    const abs = getAbsoluteSelection(textRef.current, file.content, file.highlights);
    if (!abs || !abs.selectedText.trim()) return;

    const { start, end, selectedText } = abs;

    // ✅ Block duplicate word highlight (same text, different position)
    const alreadyInFile = (file.highlights || []).some(([s, e]) => {
      const existing = file.content.slice(s, e);
      return existing === selectedText && (s !== start || e !== end);
    });
    if (alreadyInFile) {
      alert(`"${selectedText}" is already highlighted in another position.`);
      window.getSelection().removeAllRanges();
      return;
    }

    // ✅ Update highlights for the file
    setFiles((prev) =>
      prev.map((f, idx) => {
        if (idx !== currentFileIndex) return f;
        const newHighlights = mergeAndAddHighlight(f.highlights || [], [start, end]);
        return { ...f, highlights: newHighlights };
      })
    );

    // ✅ Update global selectedTexts (fixed logic)
    setSelectedTexts((prev) => {
      const all = [...prev];

      // remove only *overlapping* highlights within the same file (not substring-based)
      const cleaned = all.filter((t) => !(t.fileName === file.name && !(end <= t.start || start >= t.end)));

      // add new highlight if not duplicate
      const alreadyExists = cleaned.some((t) => t.fileName === file.name && t.start === start && t.end === end && t.text === selectedText);
      if (!alreadyExists) cleaned.push({ fileName: file.name, text: selectedText, start, end });

      // sort by file order then by start index
      const fileOrder = files.map((f) => f.name);
      cleaned.sort((a, b) => {
        const fileIdxA = fileOrder.indexOf(a.fileName);
        const fileIdxB = fileOrder.indexOf(b.fileName);
        if (fileIdxA === fileIdxB) return a.start - b.start;
        return fileIdxA - fileIdxB;
      });

      return cleaned;
    });

    window.getSelection().removeAllRanges();
  };

  // ----- Remove handler from cross button -----
  const handleRemoveHighlight = (start, end) => {
    if (currentFileIndex === null) return;
    const file = files[currentFileIndex];
    if (!file) return;

    const matchIndex = (file.highlights || []).findIndex(([s, e]) => s === start && e === end);
    if (matchIndex === -1) return;

    const removedText = file.content.slice(start, end);
    const removedFileName = file.name;

    // remove highlight immutably
    const updatedFiles = files.map((f, i) => {
      if (i !== currentFileIndex) return f;
      const newHighlights = (f.highlights || []).filter(([s, e]) => !(s === start && e === end));
      return { ...f, highlights: newHighlights };
    });
    setFiles(updatedFiles);

    // remove from selectedTexts
    setSelectedTexts((prev) => prev.filter((t) => !(t.fileName === removedFileName && t.text === removedText)));
  };

  // ----- Render highlighted text (always returns JSX) -----
  const renderHighlightedText = () => {
    if (currentFileIndex === null) return null;
    const file = files[currentFileIndex];
    if (!file) return null;

    const content = file.content ?? "";
    const highlights = Array.isArray(file.highlights) && file.highlights.length ? [...file.highlights].sort((a, b) => a[0] - b[0]) : [];

    if (highlights.length === 0) return <span>{content}</span>;

    const pieces = [];
    let last = 0;
    highlights.forEach(([s, e], i) => {
      const start = Math.max(0, Math.min(content.length, s));
      const end = Math.max(0, Math.min(content.length, e));
      if (start > last) pieces.push(<span key={`plain-${i}`}>{content.slice(last, start)}</span>);

      pieces.push(
        <span
          key={`hl-${i}`}
          style={{
            backgroundColor: "yellow",
            position: "relative",
            borderRadius: 4,
            padding: "1px 4px",
            margin: "0 1px",
            display: "inline-block",
          }}
        >
          {content.slice(start, end)}
          {/* cross button (visible on hover via CSS below) */}
          <span
            onClick={(ev) => {
              ev.stopPropagation();
              handleRemoveHighlight(start, end);
            }}
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              cursor: "pointer",
            }}
            title="Remove highlight"
            data-x="true"
          >
            <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 122.88" width={8} height={8} style={{ marginLeft: 2, verticalAlign: "top", cursor: "pointer" }}>
              <defs></defs>
              <title>cross</title>
              <path
                fill="#ff4141"
                d="M6,6H6a20.53,20.53,0,0,1,29,0l26.5,26.49L87.93,6a20.54,20.54,0,0,1,29,0h0a20.53,20.53,0,0,1,0,29L90.41,61.44,116.9,87.93a20.54,20.54,0,0,1,0,29h0a20.54,20.54,0,0,1-29,0L61.44,90.41,35,116.9a20.54,20.54,0,0,1-29,0H6a20.54,20.54,0,0,1,0-29L32.47,61.44,6,34.94A20.53,20.53,0,0,1,6,6Z"
              />
            </svg>
          </span>
        </span>
      );

      last = end;
    });

    if (last < content.length) pieces.push(<span key="plain-end">{content.slice(last)}</span>);

    return pieces;
  };

  // ----- JSX -----
  return (
    <div style={{ display: "flex", gap: 20, height: "92vh", padding: 20, fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 300, borderRight: "1px solid #ddd", paddingRight: 12, overflowY: "auto" }}>
        <h3>📁 Files</h3>
        <input type="file" accept=".txt" multiple onChange={handleFileUpload} style={{ marginBottom: 12 }} />
        <ul style={{ listStyle: "none", padding: 0 }}>
          {files.map((f, i) => (
            <li
              key={i}
              onClick={() => setCurrentFileIndex(i)}
              style={{
                marginBottom: 8,
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
                backgroundColor: i === currentFileIndex ? "#e6f7ff" : "transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>📄 {f.name}</span>
              <span style={{ backgroundColor: "#ffd54f", borderRadius: 6, padding: "0 6px", fontSize: 12 }}>{(f.highlights || []).length}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Viewer */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {currentFileIndex === null ? (
          <div style={{ textAlign: "center", marginTop: 60, color: "#666" }}>
            <h3>Upload & select a file to view</h3>
          </div>
        ) : (
          <>
            <h3>{files[currentFileIndex]?.name}</h3>
            <div ref={textRef} onMouseUp={handleMouseUp} style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", cursor: "text", userSelect: "text", overflowY: "auto", height: "60vh" }}>
              {renderHighlightedText()}
            </div>
          </>
        )}

        {/* Selected texts */}
        <div style={{ marginTop: 12 }}>
          <h4>🟡 All Highlighted Texts</h4>
          <p>{selectedTexts.map((item) => item.text).join(" ")}</p>
        </div>
      </div>
    </div>
  );
}
