"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const initialMessages: Message[] = [
  {
    id: 1,
    text: "Hi there! 👋 I'm BooBoo Buddy, your friendly health assistant. How can I help you today? You can ask me about symptoms, general health tips, or describe how you're feeling.",
    sender: "bot",
    timestamp: new Date(),
  },
];

const quickReplies = [
  "I have a headache",
  "I'm feeling tired",
  "I have a cold",
  "General health tips",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes("headache")) {
      return "I'm sorry to hear you have a headache! 🤕 Here are some tips:\n\n• Stay hydrated - drink plenty of water\n• Rest in a quiet, dark room\n• Try a cold or warm compress on your forehead\n• Over-the-counter pain relievers may help\n\nIf your headache is severe, sudden, or accompanied by other symptoms like fever or stiff neck, please consult a healthcare professional immediately.";
    }

    if (lowerMessage.includes("tired") || lowerMessage.includes("fatigue")) {
      return "Feeling tired can have many causes! 😴 Here are some suggestions:\n\n• Ensure you're getting 7-9 hours of sleep\n• Stay hydrated throughout the day\n• Take short breaks during work\n• Consider light exercise - it can boost energy!\n• Check your diet - eat balanced meals\n\nIf fatigue persists for more than 2 weeks, it's a good idea to consult with a doctor.";
    }

    if (
      lowerMessage.includes("cold") ||
      lowerMessage.includes("runny nose") ||
      lowerMessage.includes("congestion")
    ) {
      return "Having a cold is no fun! 🤧 Here's what might help:\n\n• Rest as much as possible\n• Drink warm fluids like tea or soup\n• Use a humidifier\n• Gargle with salt water for sore throat\n• Try over-the-counter cold medicines\n\nMost colds resolve in 7-10 days. If symptoms worsen or you develop a high fever, please see a doctor.";
    }

    if (
      lowerMessage.includes("health tips") ||
      lowerMessage.includes("advice")
    ) {
      return "Here are some general health tips to keep you feeling great! 💪\n\n• Exercise regularly - aim for 30 minutes daily\n• Eat a balanced diet with plenty of fruits and vegetables\n• Stay hydrated - drink 8 glasses of water daily\n• Get 7-9 hours of quality sleep\n• Manage stress through meditation or hobbies\n• Don't skip regular check-ups with your doctor\n\nIs there anything specific you'd like to know more about?";
    }

    if (
      lowerMessage.includes("hello") ||
      lowerMessage.includes("hi") ||
      lowerMessage.includes("hey")
    ) {
      return "Hello! 😊 I'm here to help with any health-related questions you might have. What's on your mind today?";
    }

    if (lowerMessage.includes("thank")) {
      return "You're very welcome! 💚 I'm always here if you need more help. Take care of yourself!";
    }

    return (
      "I understand you're asking about \"" +
      userMessage +
      "\". While I can provide general health information, please remember I'm not a substitute for professional medical advice. 🩺\n\nCould you tell me more about what you're experiencing? Or feel free to ask about:\n• Specific symptoms\n• General wellness tips\n• When to see a doctor"
    );
  };

  const handleSendMessage = (text?: string) => {
    const messageText = text || inputValue.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate bot response delay
    setTimeout(() => {
      const botResponse: Message = {
        id: messages.length + 2,
        text: generateBotResponse(messageText),
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLogout = () => {
    router.push("/login");
  };

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-teal-200 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-teal-800 dark:bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
            <span className="text-xl">🩹</span>
          </div>
          <div>
            <h1 className="font-bold text-teal-700 dark:text-teal-400">
              BooBoo Buddy
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Your Health Assistant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.sender === "user"
                    ? "bg-teal-600 text-white"
                    : "bg-white shadow-md dark:bg-zinc-800"
                }`}
              >
                {message.sender === "bot" && (
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm">🩹</span>
                    <span className="text-xs font-medium text-teal-600 dark:text-teal-400">
                      BooBoo Buddy
                    </span>
                  </div>
                )}
                <p
                  className={`whitespace-pre-line text-sm ${
                    message.sender === "user"
                      ? "text-white"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {message.text}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    message.sender === "user"
                      ? "text-teal-100"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-md dark:bg-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🩹</span>
                  <div className="flex gap-1">
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-teal-400"
                      style={{ animationDelay: "0ms" }}
                    ></span>
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-teal-400"
                      style={{ animationDelay: "150ms" }}
                    ></span>
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-teal-400"
                      style={{ animationDelay: "300ms" }}
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Replies */}
      <div className="border-t border-teal-200 bg-white/50 px-4 py-2 dark:border-teal-800 dark:bg-zinc-900/50">
        <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => handleSendMessage(reply)}
              className="shrink-0 rounded-full border border-teal-300 bg-white px-4 py-1.5 text-sm text-teal-700 transition-colors hover:bg-teal-50 dark:border-teal-700 dark:bg-zinc-800 dark:text-teal-400 dark:hover:bg-zinc-700"
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-teal-200 bg-white p-4 dark:border-teal-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <div className="relative flex-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your health question..."
              rows={1}
              className="w-full resize-none rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 pr-12 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white transition-colors hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-400 dark:text-zinc-500">
          BooBoo Buddy provides general health information only. Always consult
          a healthcare professional for medical advice.
        </p>
      </div>
    </div>
  );
}
