import React, { useState, useRef, useEffect } from "react";

export default function TextFileHighlighter() {
  const [files, setFiles] = useState([]); // [{ name, content, highlights: [[start,end]] }]
  const [currentFileIndex, setCurrentFileIndex] = useState(null);
  const [selectedTexts, setSelectedTexts] = useState([]); // [{ fileName, text }]
  const textRef = useRef(null);

  // Upload files
  const handleFileUpload = (e) => {
    const uploaded = Array.from(e.target.files);
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

  // Compute absolute start & end indices by walking text nodes
  const getAbsoluteSelection = (container) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const selectedString = range.toString();
    if (!selectedString) return null;

    try {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let node;
      let charCount = 0;
      let start = -1;
      let end = -1;

      while ((node = walker.nextNode())) {
        if (node === range.startContainer) {
          start = charCount + range.startOffset;
        }
        if (node === range.endContainer) {
          end = charCount + range.endOffset;
        }
        charCount += node.textContent?.length || 0;
        if (start !== -1 && end !== -1) break;
      }

      if (start !== -1 && end !== -1) {
        return {
          start: Math.min(start, end),
          end: Math.max(start, end),
          selectedText: selectedString,
        };
      }
    } catch (err) {}

    // fallback (rarely needed)
    try {
      const preRange = range.cloneRange();
      preRange.selectNodeContents(container);
      preRange.setEnd(range.startContainer, range.startOffset);
      const startFallback = preRange.toString().length;
      const endFallback = startFallback + range.toString().length;
      return { start: startFallback, end: endFallback, selectedText: selectedString };
    } catch (err) {
      return null;
    }
  };

  // Handle mouse up selection
  const handleMouseUp = () => {
    if (currentFileIndex === null) return;
    const file = files[currentFileIndex];
    if (!file || !textRef.current) return;

    const abs = getAbsoluteSelection(textRef.current);
    if (!abs || !abs.selectedText.trim()) return;

    const { start, end, selectedText } = abs;

    // Add highlight
    setFiles((prev) =>
      prev.map((f, idx) =>
        idx === currentFileIndex
          ? {
              ...f,
              highlights: f.highlights.some(([s, e]) => s === start && e === end) ? f.highlights : [...f.highlights, [start, end]],
            }
          : f
      )
    );

    // Add to global list
    setSelectedTexts((prev) => {
      const exists = prev.some((t) => t.fileName === file.name && t.text === selectedText);
      if (exists) return prev;
      return [...prev, { fileName: file.name, text: selectedText }];
    });

    window.getSelection().removeAllRanges();
  };

  // Remove highlight when clicked
  const handleHighlightClick = (start, end) => {
    if (currentFileIndex === null) return;
    const file = files[currentFileIndex];
    if (!file) return;

    // find matching index in the actual file.highlights array
    const matchIndex = (Array.isArray(file.highlights) ? file.highlights : []).findIndex(([s, e]) => s === start && e === end);
    if (matchIndex === -1) return; // nothing to remove

    const removedText = file.content.slice(start, end);
    const removedFileName = file.name;

    // create updated files immutably
    const newFiles = files.map((f, idx) => {
      if (idx !== currentFileIndex) return f;
      const newHighlights = [...(Array.isArray(f.highlights) ? f.highlights : [])];
      newHighlights.splice(matchIndex, 1);
      return { ...f, highlights: newHighlights };
    });

    setFiles(newFiles);

    // remove from global selectedTexts
    setSelectedTexts((prev) => prev.filter((t) => !(t.fileName === removedFileName && t.text === removedText)));
  };

  // Render text with clickable highlights
  const renderHighlightedText = () => {
    if (currentFileIndex === null) return null;
    const file = files[currentFileIndex];
    const { content, highlights } = file;

    if (!highlights.length) return content;

    const sorted = [...highlights].sort((a, b) => a[0] - b[0]);
    const elements = [];
    let last = 0;

    sorted.forEach(([start, end], i) => {
      elements.push(<span key={`t-${i}-a`}>{content.slice(last, start)}</span>);
      elements.push(
        <span
          key={`t-${i}-h`}
          onClick={() => handleHighlightClick(start, end)}
          style={{
            backgroundColor: "yellow",
            borderRadius: "3px",
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          title="Click to remove highlight"
        >
          {content.slice(start, end)}
          <svg onClick={() => handleHighlightClick(start, end)} id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 122.88" width={8} height={8} style={{ marginLeft: 2, verticalAlign: "top", cursor: "pointer" }}>
            <defs></defs>
            <title>cross</title>
            <path
              fill="#ff4141"
              d="M6,6H6a20.53,20.53,0,0,1,29,0l26.5,26.49L87.93,6a20.54,20.54,0,0,1,29,0h0a20.53,20.53,0,0,1,0,29L90.41,61.44,116.9,87.93a20.54,20.54,0,0,1,0,29h0a20.54,20.54,0,0,1-29,0L61.44,90.41,35,116.9a20.54,20.54,0,0,1-29,0H6a20.54,20.54,0,0,1,0-29L32.47,61.44,6,34.94A20.53,20.53,0,0,1,6,6Z"
            />
          </svg>
        </span>
      );
      last = end;
    });

    elements.push(<span key="t-end">{content.slice(last)}</span>);
    return elements;
  };

  useEffect(() => {
    console.log(selectedTexts);
  }, [selectedTexts]);

  return (
    <div style={{ display: "flex", gap: 20, height: "90vh", padding: 20, fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 260, borderRight: "1px solid #ccc", paddingRight: 10, overflowY: "auto" }}>
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
                backgroundColor: i === currentFileIndex ? "#e0f7fa" : "transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>📄 {f.name}</span>
              {f.highlights.length > 0 && <span style={{ backgroundColor: "#ffd54f", borderRadius: 4, padding: "0 6px", fontSize: 12 }}>{f.highlights.length}</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Viewer */}
      <div style={{ flex: 1 }}>
        {currentFileIndex === null ? (
          <div style={{ textAlign: "center", marginTop: 60, color: "#666" }}>
            <h3>Upload and select a file to view</h3>
          </div>
        ) : (
          <>
            <h3>{files[currentFileIndex].name}</h3>
            <div
              ref={textRef}
              onMouseUp={handleMouseUp}
              style={{
                border: "1px solid #ccc",
                padding: 10,
                borderRadius: 6,
                whiteSpace: "pre-wrap",
                cursor: "text",
                userSelect: "text",
                overflowY: "auto",
                height: "60vh",
              }}
            >
              {renderHighlightedText()}
            </div>
          </>
        )}

        {/* Selected text summary */}
        <div style={{ marginTop: 15 }}>
          <h4>🟡 All Highlighted Texts</h4>
          {selectedTexts.length === 0 ? (
            <p style={{ color: "#666" }}>No highlights yet.</p>
          ) : (
            <>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {selectedTexts.map((item, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: 5,
                      backgroundColor: "#fff9c4",
                      padding: "4px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    <strong>{item.fileName}:</strong> {item.text}
                  </li>
                ))}
              </ul>
              <p>{selectedTexts.map((item) => item.text).join(" ")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
