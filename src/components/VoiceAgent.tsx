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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (trimmed.length < 3) return true;
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
      return;
    }

    setAnswers((prev) => {
      const updated = { ...prev, [prompts[currentIndex]]: answer };
      answersRef.current = updated;
      return updated;
    });

    if (currentIndex === 0) {
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

  const progress = index >= 0 ? ((index + 1) / prompts.length) * 100 : 0;
  const completedAnswers = Object.keys(answers).filter(key => prompts.includes(key)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Main Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20">
          
          {/* Header */}
          <div className="text-center p-8 border-b border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-white">🤖</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
              Voice Research Agent
            </h1>
            <p className="text-gray-600">AI-powered interview for market research</p>
          </div>

          {/* Progress Section */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Interview Progress</span>
              <span className="text-sm font-bold text-purple-600">{completedAnswers}/{prompts.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Start</span>
              <span>{Math.round(progress)}% Complete</span>
              <span>Finish</span>
            </div>
          </div>

          {/* Input Mode Toggle */}
          <div className="flex justify-center p-4 border-b border-gray-100">
            <button
              onClick={() => setUseVoice((v) => !v)}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                useVoice 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              } hover:shadow-sm`}
            >
              <span>{useVoice ? '🎤' : '⌨️'}</span>
              {useVoice ? 'Voice Mode' : 'Text Mode'}
            </button>
          </div>

          {/* Status Messages */}
          {loading && (
            <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
                <span className="text-blue-800 font-medium">Analyzing company data...</span>
              </div>
            </div>
          )}

          {saving && (
            <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="animate-pulse rounded-full h-5 w-5 bg-green-500 mr-3"></div>
                <span className="text-green-800 font-medium">Generating report...</span>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="p-8">
            {index === -1 ? (
              /* Welcome State */
              <div className="text-center py-8">
                <div className="text-6xl mb-6">🚀</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3">Ready to Begin?</h2>
                <p className="text-gray-600 mb-8">I'll ask you 5 questions to understand your research needs</p>
                <button
                  onClick={startConversation}
                  disabled={loading || saving}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Start Interview
                </button>
              </div>
            ) : (
              /* Interview State */
              <div>
                {/* Question Display */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm text-gray-500 font-medium">Question {index + 1} of {prompts.length}</span>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
                    <p className="text-xl font-medium text-gray-800">{currentPrompt}</p>
                  </div>
                </div>

                {/* Input Area */}
                {useVoice ? (
                  <div className="text-center py-8">
                    <div className={`w-24 h-24 mx-auto rounded-full border-4 flex items-center justify-center text-4xl mb-6 transition-all duration-300 ${
                      waitingForResultRef.current 
                        ? 'border-red-300 bg-red-50 text-red-500 animate-pulse scale-110' 
                        : 'border-gray-300 bg-gray-50 text-gray-400'
                    }`}>
                      🎤
                    </div>
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      {waitingForResultRef.current ? 'Listening...' : 'Voice Input Ready'}
                    </p>
                    <p className="text-sm text-gray-500 mb-8">
                      {waitingForResultRef.current ? 'Speak your answer clearly' : 'Click to start recording'}
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
                      className={`px-8 py-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        waitingForResultRef.current
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      {waitingForResultRef.current ? '⏹️ Stop Recording' : '🎤 Start Recording'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={5}
                      className="w-full p-6 border-2 border-gray-200 rounded-2xl text-lg focus:border-purple-400 focus:outline-none transition-colors duration-200 resize-none bg-gray-50 focus:bg-white"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitAnswer();
                        }
                      }}
                      placeholder="Type your detailed answer here..."
                      disabled={loading || saving}
                    />
                    <div className="flex justify-between items-center mt-4">
                      <p className="text-sm text-gray-500">Press Enter to submit</p>
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={!inputValue.trim() || loading || saving}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        Submit Answer →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Access to Previous Answers */}
          {completedAnswers > 0 && index !== -1 && (
            <div className="border-t border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Previous Answers (click to edit):</h3>
              <div className="flex flex-wrap gap-2">
                {prompts.map((q, i) => {
                  if (answers[q]) {
                    return (
                      <button
                        key={i}
                        onClick={() => handleEditAnswer(i)}
                        className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition-colors duration-200"
                      >
                        Q{i + 1}: ✓
                      </button>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};