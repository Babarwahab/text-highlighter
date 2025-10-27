import React, { useState } from "react";

export default function TextHighlighterApp() {
  const [files, setFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(null);
  const [selectedTexts, setSelectedTexts] = useState([]);

  // 📂 Handle upload
  const handleFileUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files);
    uploadedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFiles((prev) => [...prev, { name: file.name, content: event.target.result, highlights: [] }]);
      };
      reader.readAsText(file);
    });
  };

  // ✍️ Handle text selection
  const handleTextSelection = () => {
    if (currentFileIndex === null) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    const file = files[currentFileIndex];
    const fullText = file.content;
    const fileName = file.name;

    const start = fullText.indexOf(text);
    const end = start + text.length;
    if (start === -1 || end === -1) return;

    const normalized = text.toLowerCase().replace(/\s+/g, " ");

    // 🔍 Check duplicate highlight in other files
    const duplicateInOther = selectedTexts.some((t) => t.fileName !== fileName && t.text.toLowerCase().replace(/\s+/g, " ") === normalized);
    if (duplicateInOther) {
      alert(`"${text}" is already highlighted in another file.`);
      selection.removeAllRanges();
      return;
    }

    // 🔍 Check if already highlighted in same file
    const alreadyHighlighted = (file.highlights || []).some(([s, e]) => {
      const highlighted = fullText.slice(s, e).toLowerCase().replace(/\s+/g, " ");
      return highlighted === normalized;
    });
    if (alreadyHighlighted) {
      selection.removeAllRanges();
      return;
    }

    // ✅ Add new highlight
    const newHighlight = [start, end];
    const updatedFiles = files.map((f, idx) => {
      if (idx !== currentFileIndex) return f;
      return { ...f, highlights: [...(f.highlights || []), newHighlight] };
    });
    setFiles(updatedFiles);

    // ✅ Update selectedTexts globally with proper ordering
    setSelectedTexts((prev) => {
      const next = [...prev, { fileName, text, start, end }];
      const fileOrder = updatedFiles.map((f) => f.name);
      next.sort((a, b) => {
        const fa = fileOrder.indexOf(a.fileName);
        const fb = fileOrder.indexOf(b.fileName);
        if (fa === fb) return a.start - b.start;
        return fa - fb;
      });
      return next;
    });

    selection.removeAllRanges();
  };

  // ❌ Remove highlight (by clicking highlight or ×)
  const handleRemoveHighlight = (textToRemove, fileName) => {
    const normalized = textToRemove.toLowerCase().replace(/\s+/g, " ");

    setFiles((prevFiles) =>
      prevFiles.map((f) => {
        if (f.name !== fileName) return f;
        const newHighlights = (f.highlights || []).filter(([s, e]) => {
          const highlighted = f.content.slice(s, e).toLowerCase().replace(/\s+/g, " ");
          return highlighted !== normalized;
        });
        return { ...f, highlights: newHighlights };
      })
    );

    setSelectedTexts((prev) => prev.filter((t) => !(t.fileName === fileName && t.text.toLowerCase().replace(/\s+/g, " ") === normalized)));
  };

  // 🧩 Render text with highlights
  const renderHighlightedText = (file) => {
    const { content, highlights } = file;
    if (!highlights || highlights.length === 0) return content;

    const sorted = [...highlights].sort((a, b) => a[0] - b[0]);
    const parts = [];
    let lastIndex = 0;

    sorted.forEach(([start, end], idx) => {
      if (start > lastIndex) {
        parts.push(content.slice(lastIndex, start));
      }
      const highlightedText = content.slice(start, end);
      parts.push(
        <span
          key={`${start}-${end}-${idx}`}
          style={{
            backgroundColor: "yellow",
            position: "relative",
            display: "inline-block",
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveHighlight(highlightedText, file.name);
          }}
        >
          {highlightedText}
          <span
            style={{
              position: "absolute",
              right: "-8px",
              top: "-8px",
              background: "red",
              color: "white",
              borderRadius: "50%",
              fontSize: "10px",
              padding: "1px 3px",
              cursor: "pointer",
              lineHeight: 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveHighlight(highlightedText, file.name);
            }}
          >
            ×
          </span>
        </span>
      );
      lastIndex = end;
    });

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: "20px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
      onMouseUp={handleTextSelection}
    >
      <h2>📝 Text Highlighter with File Upload</h2>

      {/* File Upload */}
      <input type="file" multiple accept=".txt" onChange={handleFileUpload} style={{ marginBottom: "15px" }} />

      {/* File List */}
      <div style={{ marginBottom: "20px" }}>
        {files.map((file, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentFileIndex(idx)}
            style={{
              marginRight: "10px",
              padding: "5px 10px",
              background: idx === currentFileIndex ? "#007bff" : "#f0f0f0",
              color: idx === currentFileIndex ? "white" : "black",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {file.name}
          </button>
        ))}
      </div>

      {/* Text Viewer */}
      {currentFileIndex !== null && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: "15px",
            borderRadius: "8px",
            minHeight: "150px",
            lineHeight: 1.6,
            cursor: "text",
          }}
        >
          {renderHighlightedText(files[currentFileIndex])}
        </div>
      )}

      {/* Selected Texts */}
      <div style={{ marginTop: "20px" }}>
        <h3>Selected Texts (All Files):</h3>
        <div
          style={{
            background: "#f9f9f9",
            padding: "10px",
            borderRadius: "6px",
            whiteSpace: "pre-wrap",
          }}
        >
          {selectedTexts.map((t, i) => (
            <span key={i}>
              <strong>{t.text}</strong>{" "}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
