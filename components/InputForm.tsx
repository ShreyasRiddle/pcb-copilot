"use client";

import { useState, useRef } from "react";

interface InputFormProps {
  onRun: (prompt: string, pdfBase64?: string) => void;
  loading: boolean;
}

const EXAMPLES = [
  "TPS563201 synchronous buck converter, 12V in → 5V out at 2A",
  "LM358 op-amp inverting amplifier, ±15V supply, gain of 10",
  "DRV8833 dual H-bridge motor driver, 5V logic, 1A per channel",
  "TP4056 lithium battery charger IC, 1A charge current",
  "NE555 astable oscillator, 1kHz square wave, 5V supply",
];

export default function InputForm({ onRun, loading }: InputFormProps) {
  const [prompt, setPrompt] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | undefined>();
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    if (!file.name.endsWith(".pdf")) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setPdfBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed && !pdfBase64) return;
    onRun(trimmed || "Design the circuit from the attached datasheet", pdfBase64);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  const applyExample = (ex: string) => {
    setPrompt(ex);
  };

  return (
    <div>
      {/* Example chips — above the card */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-space), system-ui, sans-serif",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          Try:
        </span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => applyExample(ex)}
            disabled={loading}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 99,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-3)",
              fontFamily: "var(--font-geist-mono), monospace",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "color 120ms, border-color 120ms",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-mid)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            }}
          >
            {ex.split(",")[0]}
          </button>
        ))}
      </div>

      {/* Main card */}
      <div className="card" style={{ padding: 20 }}>
        {/* Prompt textarea */}
        <label
          className="section-label"
          htmlFor="circuit-prompt"
          style={{ display: "block", marginBottom: 8 }}
        >
          Describe your circuit
        </label>
        <div style={{ position: "relative" }}>
          <textarea
            id="circuit-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder={`e.g. "${EXAMPLES[0]}"`}
            disabled={loading}
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 14,
              color: "var(--text-1)",
              lineHeight: 1.6,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              resize: "none",
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLTextAreaElement).style.borderColor =
                "rgba(110,231,247,0.35)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLTextAreaElement).style.borderColor =
                "var(--border)";
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 12,
              fontSize: 10,
              color: "var(--text-3)",
              fontFamily: "var(--font-geist-mono), monospace",
              pointerEvents: "none",
            }}
          >
            ⌘↵ to run
          </div>
        </div>

        {/* PDF toggle + upload area */}
        <div style={{ marginTop: 10 }}>
          {!showPdf ? (
            <button
              type="button"
              onClick={() => setShowPdf(true)}
              style={{
                fontSize: 12,
                color: "var(--text-3)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                padding: 0,
                transition: "color 120ms",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)")
              }
            >
              + Attach datasheet PDF
            </button>
          ) : (
            <div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: dragging ? "rgba(110,231,247,0.06)" : "var(--bg-input)",
                  border: `1px dashed ${dragging ? "rgba(110,231,247,0.4)" : "var(--border-mid)"}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "background 150ms, border-color 150ms",
                }}
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  style={{ color: fileName ? "var(--accent)" : "var(--text-3)", flexShrink: 0 }}
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span
                  style={{
                    fontSize: 13,
                    color: fileName ? "var(--text-1)" : "var(--text-3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {fileName || "Drop or click to attach PDF"}
                </span>
                {fileName ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileName("");
                      setPdfBase64(undefined);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    style={{
                      fontSize: 12,
                      color: "var(--text-3)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: "0 4px",
                    }}
                  >
                    ✕
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPdf(false);
                    }}
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    cancel
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </div>
          )}
        </div>

        {/* Run button */}
        <button
          onClick={handleSubmit}
          disabled={loading || (!prompt.trim() && !pdfBase64)}
          className="btn-primary"
          style={{ width: "100%", padding: "11px 0", marginTop: 16 }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span
                className="pulse-dot"
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  flexShrink: 0,
                }}
              />
              Generating…
            </span>
          ) : (
            "Generate →"
          )}
        </button>
      </div>
    </div>
  );
}
