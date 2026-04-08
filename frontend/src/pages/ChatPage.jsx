import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";

const EMOTION_EMOJIS = {
  anger: "😠",
  fear: "😨",
  sadness: "😢",
  joy: "😊",
  surprise: "😮",
  disgust: "🤢",
  neutral: "😐",
};

export default function ChatPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    const loadHistory = async () => {
      setError("");
      try {
        const data = await api.getChatHistory();
        setHistory(data.items || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const send = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }

    setError("");
    setIsSending(true);
    const userMessage = message;

    try {
      const response = await api.sendMessage(message);

      const newItem = {
        id: Date.now(),
        user_message: userMessage,
        bot_response: response.response,
        emotion: response.emotion,
        confidence: response.confidence,
        escalation_required: response.escalation_required,
        created_at: new Date().toISOString(),
      };

      setHistory([newItem, ...history]);
      setMessage("");
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[600px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6">
            <h1 className="text-2xl font-bold">💬 AI Emotional Support</h1>
            <p className="text-indigo-100 text-sm mt-2">Get CBT-style guidance and support. Type to start.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-3">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoadingHistory ? (
              <div className="text-center text-gray-500 py-8">
                <div className="animate-spin text-3xl mb-2">⏳</div>
                <p>Loading conversation history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <div className="text-5xl mb-4">💭</div>
                <p className="font-semibold mb-2">Start a conversation</p>
                <p className="text-sm">Share how you're feeling and I'll provide supportive guidance.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...history].reverse().map((item) => (
                  <div key={item.id} className="space-y-2">
                    {/* User Message */}
                    <div className="flex justify-end">
                      <div className="bg-blue-600 text-white rounded-lg rounded-tr-none px-4 py-3 max-w-xs">
                        <p className="text-sm">{item.user_message}</p>
                      </div>
                    </div>

                    {/* Bot Response */}
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-800 rounded-lg rounded-tl-none px-4 py-3 max-w-xs">
                        <p className="text-sm mb-3">{item.bot_response}</p>
                        
                        {/* Emotion and Confidence */}
                        <div className="flex items-center gap-3 flex-wrap text-xs">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {EMOTION_EMOJIS[item.emotion?.toLowerCase()] || "❓"} {item.emotion}
                          </span>
                          <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">
                            {(item.confidence * 100).toFixed(0)}% confidence
                          </span>
                          {item.escalation_required && (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                              ⚠️ High Risk
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={endOfMessagesRef} />
              </div>
            )}
          </div>

          {/* Message Input Form */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <form onSubmit={send} className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Share how you're feeling..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={isSending}
              />
              <button
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold transition"
                type="submit"
                disabled={isSending}
              >
                {isSending ? "..." : "Send"}
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2">Your conversations are private and confidential.</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() => navigate("/assessment")}
            className="bg-white hover:shadow-lg px-4 py-2 rounded-lg transition"
          >
            📋 Assessment
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-white hover:shadow-lg px-4 py-2 rounded-lg transition"
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => navigate("/forum")}
            className="bg-white hover:shadow-lg px-4 py-2 rounded-lg transition"
          >
            👥 Forum
          </button>
        </div>
      </div>
    </main>
  );
}
