import React, { useEffect, useRef, useState } from "react";

const prompts = [
  "What company do you work for?",
  "What's your role?",
  "What are you hoping to achieve with your research?",
  "Is your company in the food and beverage industry?",
  "What would the ideal output look like for you? eg) powerpoint",
];

const synth = window.speechSynthesis;
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const VoiceAgent: React.FC = () => {
  const [index, setIndex] = useState(-1);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const recognitionRef = useRef<any>(null);
  const waitingForResultRef = useRef(false);
  const currentIndexRef = useRef(index);

  // Keep transcript and answers refs for saving latest state
  const transcriptRef = useRef<string[]>([]);
  const answersRef = useRef<Record<string, string>>({});

  // Sync refs on state update
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
      console.log("Recognition result:", text);

      setTranscript((prev) => {
        const updated = [...prev, `User: ${text}`];
        transcriptRef.current = updated;
        return updated;
      });

      handleUserAnswer(text, currentIndexRef.current);
    };

    recognition.onend = () => {
      console.log("Recognition ended");
      if (waitingForResultRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.warn("Failed to restart recognition:", err);
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
        console.warn("Speech synthesis not supported");
        resolve();
        return;
      }

      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);

      utterance.onstart = () => console.log("Speech synthesis started");
      utterance.onend = () => {
        console.log("Speech synthesis ended");
        resolve();
      };
      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e.error);
        resolve();
      };

      synth.speak(utterance);
    });
  };

  const startRecognition = () => {
    if (!recognitionRef.current) {
      console.warn("No recognition instance available");
      return;
    }
    try {
      waitingForResultRef.current = true;
      recognitionRef.current.start();
      console.log("Recognition requested to start");
    } catch (err) {
      console.error("Recognition start failed:", err);
    }
  };

  const handleUserAnswer = async (answer: string, currentIndex: number) => {
    console.log(`Answer received for question ${currentIndex}: ${answer}`);
  
    if (currentIndex < 0 || currentIndex >= prompts.length) {
      return;
    }
  
    // Save answer mapping question → answer
    setAnswers((prev) => {
      const updated = { ...prev, [prompts[currentIndex]]: answer };
      answersRef.current = updated;
      return updated;
    });
  
    if (currentIndex === 0) {
      // Industry validation, async update answers with extra keys
      try {
        const response = await fetch("http://localhost:4567/api/validate-industry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: answer }),
        });
        const data = await response.json();
        setAnswers((prev) => {
          const updated = {
            ...prev,
            "Industry Confirmed": data.industryMatch ? "Yes" : "No",
            "Company Overview": data.companyOverview || "",
          };
          answersRef.current = updated;
          return updated;
        });
      } catch (e) {
        console.error("Industry validation failed", e);
      }
    }
  
    const nextIndex = currentIndex + 1;
  
    if (nextIndex < prompts.length) {
      setIndex(nextIndex);
      setCurrentPrompt(prompts[nextIndex]);
      await speak(prompts[nextIndex]);
      startRecognition();
    } else {
      // VERY IMPORTANT: Wait a tick so last setAnswers finishes before saving
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
    if (confirmed) {
      await saveToFile();
    }
  };

const saveToFile = async () => {
    const answers = answersRef.current;
    const transcript = transcriptRef.current.join("\n");
  
    const payload = {
      userName: answers["User Name"] || "Unknown User",
      companyName: answers["What company do you work for?"] || "Unknown Company",
      role: answers["What's your role?"] || "",
      objective: answers["What are you hoping to achieve with your research?"] || "",
      idealOutput: answers["What would the ideal output look like for you? eg) powerpoint"] || "",
      industryConfirmed: answers["Industry Confirmed"] || "No",
      companyOverview: answers["Company Overview"] || "",
      transcript,
    };
  
    try {
      const response = await fetch("http://localhost:4567/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
  
      const data = await response.json();
      alert("Report saved successfully!");
      console.log("Report response:", data);
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
