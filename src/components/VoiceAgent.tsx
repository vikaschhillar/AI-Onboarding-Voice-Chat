import React, { useEffect, useRef, useState } from "react";

const prompts = [
  "What company do you work for?",
  "What's your role?",
  "What are you hoping to achieve with your research?",
  "Is your company in the food and beverage industry?",
  "What would the ideal output look like for you? eg) powerpoint",
];

const synth = window.speechSynthesis;
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const VoiceAgent: React.FC = () => {
  const [index, setIndex] = useState(-1);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [useVoice, setUseVoice] = useState(true);
  const [inputValue, setInputValue] = useState("");

  const [loading, setLoading] = useState(false); // Loading during API calls
  const [saving, setSaving] = useState(false);   // Saving report status

  const recognitionRef = useRef<any>(null);
  const waitingForResultRef = useRef(false);
  const currentIndexRef = useRef(index);
  const transcriptRef = useRef<string[]>([]);
  const answersRef = useRef<Record<string, string>>({});

  useEffect(() => {
    currentIndexRef.current = index;
  }, [index]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!SpeechRecognition) {
      alert("Speech Recognition API not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      waitingForResultRef.current = false;
      const text = event.results[0][0].transcript;

      setTranscript((prev) => {
        const updated = [...prev, `User: ${text}`];
        transcriptRef.current = updated;
        return updated;
      });

      setInputValue(text);
      handleUserAnswer(text, currentIndexRef.current);
    };

    recognition.onend = () => {
      if (waitingForResultRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.warn("Restart failed:", err);
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Recognition error:", e.error);
      waitingForResultRef.current = false;
    };

    recognitionRef.current = recognition;
  }, []);

  const speak = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!synth) {
        resolve();
        return;
      }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = resolve;
      utterance.onerror = resolve;
      synth.speak(utterance);
    });
  };

  const startRecognition = () => {
    if (!recognitionRef.current) return;
    try {
      waitingForResultRef.current = true;
      recognitionRef.current.start();
    } catch (err) {
      console.error("Recognition start failed:", err);
    }
  };

  const vagueAnswers = [
    "i don't know",
    "not sure",
    "maybe",
    "i guess",
    "no idea",
    "don't know",
    "nothing",
    "none",
    "no",
    "n/a",
  ];

  const isAnswerVague = (answer: string): boolean => {
    const trimmed = answer.trim().toLowerCase();
    if (trimmed.length < 3) return true; // too short
    if (vagueAnswers.includes(trimmed)) return true;
    return false;
  };

  const handleUserAnswer = async (answer: string, currentIndex: number) => {
    if (currentIndex < 0 || currentIndex >= prompts.length) return;

    if (isAnswerVague(answer)) {
      const clarification = "Could you please provide more details?";
      setTranscript((prev) => [...prev, "Agent: " + clarification]);
      await speak(clarification);
      if (useVoice) startRecognition();
      return; // don't progress index
    }

    setAnswers((prev) => {
      const updated = { ...prev, [prompts[currentIndex]]: answer };
      answersRef.current = updated;
      return updated;
    });

    if (currentIndex === 0) {
      // Show loading during API calls
      setLoading(true);
      try {
        const newsResponse = await fetch("http://localhost:4567/api/company-news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: answer }),
        });
        const newsData = await newsResponse.json();

        setAnswers((prev) => ({
          ...prev,
          Company_News: newsData.articles
            .map((a: any) => `${a.title} (${a.source.name || a.source})`)
            .join("; ") || "No recent news found.",
        }));

        const response = await fetch("http://localhost:4567/api/validate-industry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: answer }),
        });
        const data = await response.json();

        const detailsResponse = await fetch("http://localhost:4567/api/company-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: answer }),
        });
        const detailsData = await detailsResponse.json();

        setAnswers((prev) => {
          const updated = {
            ...prev,
            Industry_Confirmed: data.industryMatch ? "Yes" : "No",
            Company_Overview: data.companyOverview,
            Company_Summary: detailsData.companySummary || "No detailed summary available.",
          };
          answersRef.current = updated;
          return updated;
        });
      } catch (e) {
        console.error("Company validation or details fetch failed", e);
      } finally {
        setLoading(false);
      }
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < prompts.length) {
      setIndex(nextIndex);
      setCurrentPrompt(prompts[nextIndex]);
      setInputValue("");
      await speak(prompts[nextIndex]);
      if (useVoice) startRecognition();
    } else {
      setTimeout(() => {
        setIndex(-1);
        setCurrentPrompt("");
        waitingForResultRef.current = false;
        confirmAndGenerateReport();
      }, 100);
    }
  };

  const handleSubmitAnswer = async () => {
    if (inputValue.trim()) {
      await handleUserAnswer(inputValue.trim(), index);
    }
  };

  const handleEditAnswer = (i: number) => {
    setIndex(i);
    setCurrentPrompt(prompts[i]);
    setInputValue(answers[prompts[i]] || "");
    if (useVoice) {
      recognitionRef.current?.stop();
      waitingForResultRef.current = false;
    }
  };

  const confirmAndGenerateReport = async () => {
    const confirmed = window.confirm("Do you want to submit the info?");
    if (confirmed) await saveToFile();
  };

  const saveToFile = async () => {
    setSaving(true);
    const answers = answersRef.current;
    const transcript = transcriptRef.current.join("\n");

    const payload = {
      userName: answers["User Name"] || "Unknown User",
      companyName: answers["What company do you work for?"] || "Unknown Company",
      role: answers["What's your role?"] || "",
      objective: answers["What are you hoping to achieve with your research?"] || "",
      idealOutput: answers["What would the ideal output look like for you? eg) powerpoint"] || "",
      industryConfirmed: answers["Industry_Confirmed"] || "No",
      companyOverview: answers["Company_Overview"] || "",
      companySummary: answers["Company_Summary"] || "Something went wrong",
      Company_News: answers["Company_News"],
      transcript,
    };

    try {
      const response = await fetch("http://localhost:4567/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      alert("Report saved successfully!");
      console.log("LLM Summary:", data.report.llmSummary);
    } catch (error) {
      console.error("Error saving report:", error);
      alert("Failed to save report.");
    } finally {
      setSaving(false);
    }
  };

  const startConversation = async () => {
    setIndex(0);
    setCurrentPrompt(prompts[0]);
    setInputValue("");
    await speak(prompts[0]);
    if (useVoice) startRecognition();
  };

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => setUseVoice((v) => !v)} style={{ marginBottom: 10 }}>
        Switch to {useVoice ? "Typing" : "Voice"} Input
      </button>

      {loading && (
        <div
          style={{
            padding: 10,
            marginBottom: 10,
            border: "1px solid #0a74da",
            backgroundColor: "#d0e7ff",
            borderRadius: 4,
            color: "#004a9f",
            fontWeight: "bold",
          }}
        >
          Fetching Data from news api + company summary open ai ...
        </div>
      )}
      {saving && (
        <div
          style={{
            padding: 10,
            marginBottom: 10,
            border: "1px solid #2a9d8f",
            backgroundColor: "#d1f2eb",
            borderRadius: 4,
            color: "#087f71",
            fontWeight: "bold",
          }}
        >
          Saving report to /reports folder in same directory...
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h3>Questions:</h3>
        <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
          {prompts.map((q, i) => (
            <li
              key={i}
              onClick={() => handleEditAnswer(i)}
              style={{
                cursor: "pointer",
                marginBottom: 5,
                padding: 8,
                borderRadius: 5,
                backgroundColor: i === index ? "#cde" : "#eee",
                fontWeight: i === index ? "bold" : "normal",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              title="Click to edit this answer"
            >
              <span>
                {q}{" "}
                {answers[q] && (
                  <em style={{ color: "green", fontWeight: "normal" }}>
                    - {answers[q].length > 30 ? answers[q].slice(0, 30) + "..." : answers[q]}
                  </em>
                )}
              </span>
              {i === index && <span>⬅️ Current</span>}
            </li>
          ))}
        </ul>
      </div>

      {index === -1 ? (
        <button onClick={startConversation} disabled={loading || saving}>
          Start Conversation
        </button>
      ) : (
        <>
          <p style={{ fontWeight: "bold" }}>{currentPrompt}</p>

          {useVoice ? (
            <div>
              <p>
                <em>Listening for your answer... Speak now.</em>
              </p>
              <button
                onClick={() => {
                  if (recognitionRef.current && waitingForResultRef.current) {
                    recognitionRef.current.stop();
                    waitingForResultRef.current = false;
                  } else {
                    startRecognition();
                  }
                }}
                disabled={loading || saving}
              >
                {waitingForResultRef.current ? "Stop Listening" : "Start Listening"}
              </button>
            </div>
          ) : (
            <div>
              <textarea
                rows={3}
                style={{ width: "100%", marginBottom: 10 }}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitAnswer();
                  }
                }}
                placeholder="Type your answer here..."
                disabled={loading || saving}
              />
              <button onClick={handleSubmitAnswer} disabled={!inputValue.trim() || loading || saving}>
                Submit Answer
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
