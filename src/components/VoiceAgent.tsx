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
  const recognitionRef = useRef<any>(null);
  const waitingForResultRef = useRef(false);
  const currentIndexRef = useRef(index);
  const transcriptRef = useRef<string[]>([]);
  const answersRef = useRef<Record<string, string>>({});

  useEffect(() => { currentIndexRef.current = index; }, [index]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { answersRef.current = answers; }, [answers]);

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

      setTranscript(prev => {
        const updated = [...prev, `User: ${text}`];
        transcriptRef.current = updated;
        return updated;
      });

      handleUserAnswer(text, currentIndexRef.current);
    };

    recognition.onend = () => {
      if (waitingForResultRef.current) {
        try { recognition.start(); } catch (err) {
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
      // Speak a clarifying prompt and restart recognition for the same question
      const clarification = "Could you please provide more details?";
      setTranscript(prev => [...prev, "Agent: " + clarification]);
      await speak(clarification);
      startRecognition();
      return; // don't progress index
    }
  
    setAnswers(prev => {
      const updated = { ...prev, [prompts[currentIndex]]: answer };
      answersRef.current = updated;
      return updated;
    });
  
    // Your existing logic continues here...
    if (currentIndex === 0) {
      // validation logic...
      if (currentIndex === 0) {
        try {
          // Existing industry validation call
          const response = await fetch("http://localhost:4567/api/validate-industry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company: answer }),
          });
          const data = await response.json();
      
          // Also get detailed company summary
          const detailsResponse = await fetch("http://localhost:4567/api/company-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company: answer }),
          });
          const detailsData = await detailsResponse.json();
      
          setAnswers(prev => {
            const updated = {
              ...prev,
              "Industry_Confirmed": data.industryMatch ? "Yes" : "No",
              "Company_Overview": data.companyOverview,
              "Company_Summary": detailsData.companySummary || "No detailed summary available.",
            };
            answersRef.current = updated;
            return updated;
          });
        } catch (e) {
          console.error("Company validation or details fetch failed", e);
        }
      }
      
    }
  
    // Advance to next question
    const nextIndex = currentIndex + 1;
    if (nextIndex < prompts.length) {
      setIndex(nextIndex);
      setCurrentPrompt(prompts[nextIndex]);
      await speak(prompts[nextIndex]);
      startRecognition();
    } else {
      // End of questions - finalize
      setTimeout(() => {
        setIndex(-1);
        setCurrentPrompt("");
        waitingForResultRef.current = false;
        confirmAndGenerateReport();
      }, 100);
    }
  };
  

  const confirmAndGenerateReport = async () => {
    const confirmed = window.confirm("Do you want to submit the info?");
    if (confirmed) await saveToFile();
  };

  const saveToFile = async () => {
    const answers = answersRef.current;
    const transcript = transcriptRef.current.join("\n");

    console.log({answers})
  
    const payload = {
      userName: answers["User Name"] || "Unknown User",
      companyName: answers["What company do you work for?"] || "Unknown Company",
      role: answers["What's your role?"] || "",
      objective: answers["What are you hoping to achieve with your research?"] || "",
      idealOutput: answers["What would the ideal output look like for you? eg) powerpoint"] || "",
      industryConfirmed: answers["Industry Confirmed"] || "No",
      companyOverview: answers["Company Overview"] || "",  
      companySummary: answers["Company_Summary"] || "Something went wrong",


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
    }
  };
  

  const startConversation = async () => {
    setIndex(0);
    setCurrentPrompt(prompts[0]);
    await speak(prompts[0]);
    startRecognition();
  };

  return (
    <div style={{ padding: 20 }}>
      {index === -1 ? (
        <button onClick={startConversation}>Start Conversation</button>
      ) : (
        <p>{currentPrompt}</p>
      )}
    </div>
  );
};
