"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConsentModal from "@/components/ConsentModal";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface ApiMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating: number | null;
  distance?: number;
  availableSlots: string[];
  specialties: string[];
}

interface ToolResult {
  toolName: string;
  result: {
    clinics?: Clinic[];
    confirmed?: boolean;
    appointmentTime?: string;
    confirmationCode?: string;
    message?: string;
  };
}

const quickReplies = [
  "My child is sick",
  "Fever and cough",
  "Stomach ache",
  "Need a doctor",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Check for existing consent on mount
  useEffect(() => {
    const consent = localStorage.getItem("booboobuddy_consent");
    if (consent === "true") {
      setHasConsented(true);
      setShowConsentModal(false);
    }
  }, []);

  const handleAcceptConsent = () => {
    localStorage.setItem("booboobuddy_consent", "true");
    localStorage.setItem("booboobuddy_consent_date", new Date().toISOString());
    setHasConsented(true);
    setShowConsentModal(false);
  };

  const handleDeclineConsent = () => {
    router.push("/");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start a new conversation on mount
  const initConversation = useCallback(async () => {
    if (isInitialized || !hasConsented) return;

    try {
      setIsTyping(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      });

      if (!response.ok) throw new Error("Failed to start conversation");

      const data = await response.json();
      setConversationId(data.conversationId);

      // Add the bot's greeting
      setMessages([
        {
          id: data.message.id,
          text: data.message.content,
          sender: "bot",
          timestamp: new Date(data.message.createdAt),
        },
      ]);
      setIsInitialized(true);
    } catch (error) {
      console.error("Error starting conversation:", error);
      // Fallback greeting if API fails
      setMessages([
        {
          id: "fallback-1",
          text: "Hi there! 👋 I'm BooBoo Buddy, your friendly health assistant. I'm having trouble connecting right now, but please try sending a message!",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
      setIsInitialized(true);
    } finally {
      setIsTyping(false);
    }
  }, [isInitialized, hasConsented]);

  useEffect(() => {
    if (hasConsented) {
      initConversation();
    }
  }, [initConversation, hasConsented]);

  const sendMessageToApi = async (userMessage: string): Promise<{
    message: ApiMessage;
    toolResults?: ToolResult[];
  }> => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: userMessage,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    const data = await response.json();

    // Update conversation ID if this was a new conversation
    if (!conversationId && data.conversationId) {
      setConversationId(data.conversationId);
    }

    return data;
  };

  const formatToolResults = (toolResults?: ToolResult[]): string => {
    if (!toolResults || toolResults.length === 0) return "";

    let formatted = "";
    for (const tr of toolResults) {
      if (tr.toolName === "clinic_search" && tr.result.clinics) {
        formatted += "\n\n📍 **Nearby Clinics Found:**\n";
        tr.result.clinics.forEach((clinic, index) => {
          formatted += `\n${index + 1}. **${clinic.name}**`;
          formatted += `\n   📍 ${clinic.address}`;
          formatted += `\n   📞 ${clinic.phone}`;
          if (clinic.rating) formatted += `\n   ⭐ ${clinic.rating}/5`;
          if (clinic.distance) formatted += `\n   🚗 ${clinic.distance} miles`;
          if (clinic.availableSlots.length > 0) {
            const nextSlot = new Date(clinic.availableSlots[0]);
            formatted += `\n   ⏰ Next: ${nextSlot.toLocaleString()}`;
          }
        });
      } else if (tr.toolName === "schedule_call" && tr.result.confirmed) {
        formatted += `\n\n✅ **Appointment Confirmed!**`;
        formatted += `\n📅 ${new Date(tr.result.appointmentTime!).toLocaleString()}`;
        formatted += `\n🔖 Confirmation: ${tr.result.confirmationCode}`;
      }
    }
    return formatted;
  };

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputValue.trim();
    if (!messageText || isTyping) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await sendMessageToApi(messageText);

      // Format the response with any tool results
      let botText = response.message.content;
      const toolFormatted = formatToolResults(response.toolResults);
      if (toolFormatted) {
        botText += toolFormatted;
      }

      const botMessage: Message = {
        id: response.message.id,
        text: botText,
        sender: "bot",
        timestamp: new Date(response.message.createdAt),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
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
    <>
      {/* Informed Consent Modal */}
      {showConsentModal && (
        <ConsentModal
          onAccept={handleAcceptConsent}
          onDecline={handleDeclineConsent}
        />
      )}

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
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
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
              disabled={isTyping}
              className="shrink-0 rounded-full border border-teal-300 bg-white px-4 py-1.5 text-sm text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-teal-700 dark:bg-zinc-800 dark:text-teal-400 dark:hover:bg-zinc-700"
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
              disabled={isTyping}
              className="w-full resize-none rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 pr-12 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isTyping}
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
    </>
  );
}
