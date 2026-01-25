"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  users: number;
  conversations: number;
  messages: number;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  isOnboarded: boolean;
  createdAt: string;
  location: string | null;
}

interface Conversation {
  id: string;
  state: string;
  userName: string | null;
  healthConcern: string | null;
  location: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "conversations">("overview");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin");
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setUsers(data.recentUsers);
        setConversations(data.recentConversations);
      } else {
        setError(data.error || "Failed to fetch data");
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConversationMessages = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/conversations/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.conversation.messages);
        setSelectedConversation(id);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await response.json();
      
      if (data.success) {
        setUsers(users.filter((u) => u.id !== id));
        fetchData(); // Refresh stats
      }
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const deleteConversation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    
    try {
      const response = await fetch(`/api/admin/conversations/${id}`, { method: "DELETE" });
      const data = await response.json();
      
      if (data.success) {
        setConversations(conversations.filter((c) => c.id !== id));
        if (selectedConversation === id) {
          setSelectedConversation(null);
          setMessages([]);
        }
        fetchData(); // Refresh stats
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading admin data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        <div className="text-center">
          <p className="text-red-500 text-lg">⚠️ {error}</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🩹</span>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                BooBoo Buddy Admin
              </h1>
              <p className="text-sm text-zinc-500">Database Management</p>
            </div>
          </div>
          <Link
            href="/chat"
            className="px-4 py-2 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600"
          >
            Back to Chat
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Users</p>
              <p className="text-3xl font-bold text-teal-600">{stats.users}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Conversations</p>
              <p className="text-3xl font-bold text-blue-600">{stats.conversations}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Messages</p>
              <p className="text-3xl font-bold text-purple-600">{stats.messages}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(["overview", "users", "conversations"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-teal-500 text-white"
                  : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          {activeTab === "overview" && (
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                Recent Activity
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Recent Users */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-500 mb-2">Recent Users</h3>
                  <div className="space-y-2">
                    {users.slice(0, 5).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-700 rounded">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {user.email}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {user.isOnboarded ? "✅ Onboarded" : "⏳ Pending"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Recent Conversations */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-500 mb-2">Recent Conversations</h3>
                  <div className="space-y-2">
                    {conversations.slice(0, 5).map((conv) => (
                      <div key={conv.id} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-700 rounded">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {conv.userName || "Anonymous"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {conv.messageCount} messages • {conv.state}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700">
                      <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{user.name || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.isOnboarded 
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        }`}>
                          {user.isOnboarded ? "Onboarded" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{user.location || "-"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <p className="text-center py-8 text-zinc-500">No users yet</p>
              )}
            </div>
          )}

          {activeTab === "conversations" && (
            <div className="flex">
              {/* Conversation List */}
              <div className="w-1/3 border-r border-zinc-200 dark:border-zinc-700">
                <div className="overflow-y-auto max-h-[600px]">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => fetchConversationMessages(conv.id)}
                      className={`p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 ${
                        selectedConversation === conv.id ? "bg-teal-50 dark:bg-teal-900/20" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {conv.userName || "Anonymous"}
                          </p>
                          <p className="text-xs text-zinc-500">{conv.healthConcern || "No concern specified"}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-zinc-100 dark:bg-zinc-600 px-2 py-0.5 rounded">
                          {conv.state}
                        </span>
                        <span className="text-xs text-zinc-500">{conv.messageCount} msgs</span>
                      </div>
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <p className="text-center py-8 text-zinc-500">No conversations yet</p>
                  )}
                </div>
              </div>

              {/* Message View */}
              <div className="w-2/3 p-4 max-h-[600px] overflow-y-auto">
                {selectedConversation ? (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.role === "user"
                            ? "bg-teal-100 dark:bg-teal-900/30 ml-12"
                            : "bg-zinc-100 dark:bg-zinc-700 mr-12"
                        }`}
                      >
                        <p className="text-xs font-medium text-zinc-500 mb-1">
                          {msg.role.toUpperCase()}
                        </p>
                        <p className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                          {msg.content}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {new Date(msg.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-500">
                    Select a conversation to view messages
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
