"use client";

import { useState } from "react";
import { ClarificationQuestion } from "@/lib/types";

interface ClarificationCardProps {
  questions: ClarificationQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  loading: boolean;
}

export default function ClarificationCard({
  questions,
  onSubmit,
  loading,
}: ClarificationCardProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const setAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim() !== "");

  const handleSubmit = () => {
    if (!allAnswered || loading) return;
    onSubmit(answers);
  };

  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid rgba(245,158,11,0.25)",
        borderLeft: "3px solid #f59e0b",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx={12} cy={12} r={10} />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-space), system-ui, sans-serif",
            fontWeight: 600,
            color: "#f59e0b",
            letterSpacing: "0.01em",
          }}
        >
          A few more details needed
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Answer all questions to continue
        </span>
      </div>

      {/* Questions */}
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 20 }}>
        {questions.map((q, qi) => (
          <div key={q.id}>
            <p
              style={{
                fontSize: 13,
                fontFamily: "var(--font-space), system-ui, sans-serif",
                fontWeight: 500,
                color: "var(--text-1)",
                marginBottom: 10,
                letterSpacing: "-0.01em",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 20,
                  height: 20,
                  lineHeight: "20px",
                  textAlign: "center",
                  borderRadius: "50%",
                  background: "rgba(245,158,11,0.15)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#f59e0b",
                  marginRight: 8,
                  fontFamily: "var(--font-space), system-ui, sans-serif",
                }}
              >
                {qi + 1}
              </span>
              {q.text}
            </p>

            {q.options ? (
              /* Chip button grid */
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {q.options.map((opt) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.id, opt)}
                      disabled={loading}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                        fontWeight: selected ? 600 : 400,
                        cursor: loading ? "not-allowed" : "pointer",
                        border: selected
                          ? "1px solid rgba(245,158,11,0.6)"
                          : "1px solid var(--border-mid)",
                        background: selected
                          ? "rgba(245,158,11,0.12)"
                          : "var(--bg-input)",
                        color: selected ? "#f59e0b" : "var(--text-2)",
                        transition: "all 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!selected && !loading) {
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-mid)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) {
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-mid)";
                        }
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}

                {/* Custom text input when "Other" is selected */}
                {answers[q.id] === "Other" && (
                  <input
                    type="text"
                    placeholder="Specify…"
                    autoFocus
                    onChange={(e) => setAnswer(q.id, e.target.value || "Other")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      border: "1px solid rgba(245,158,11,0.4)",
                      background: "var(--bg-input)",
                      color: "var(--text-1)",
                      outline: "none",
                      width: 160,
                    }}
                  />
                )}
              </div>
            ) : (
              /* Free-text input */
              <input
                type="text"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer…"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-1)",
                  outline: "none",
                  transition: "border-color 150ms",
                }}
                onFocus={(e) =>
                  ((e.currentTarget as HTMLInputElement).style.borderColor =
                    "rgba(245,158,11,0.4)")
                }
                onBlur={(e) =>
                  ((e.currentTarget as HTMLInputElement).style.borderColor =
                    "var(--border)")
                }
              />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 18px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {allAnswered
            ? "Ready to generate →"
            : `${questions.filter((q) => (answers[q.id] ?? "").trim()).length} / ${questions.length} answered`}
        </span>

        <button
          onClick={handleSubmit}
          disabled={!allAnswered || loading}
          style={{
            padding: "8px 20px",
            borderRadius: 9,
            fontSize: 13,
            fontFamily: "var(--font-space), system-ui, sans-serif",
            fontWeight: 600,
            border: "1px solid rgba(245,158,11,0.35)",
            background: allAnswered
              ? "rgba(245,158,11,0.12)"
              : "var(--bg-input)",
            color: allAnswered ? "#f59e0b" : "var(--text-3)",
            cursor: allAnswered && !loading ? "pointer" : "not-allowed",
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            if (allAnswered && !loading) {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(245,158,11,0.2)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(245,158,11,0.6)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = allAnswered
              ? "rgba(245,158,11,0.12)"
              : "var(--bg-input)";
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "rgba(245,158,11,0.35)";
          }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                className="pulse-dot"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  display: "inline-block",
                }}
              />
              Generating…
            </span>
          ) : (
            "Continue →"
          )}
        </button>
      </div>
    </div>
  );
}
