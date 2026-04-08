import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";

export default function ForumPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", content: "" });
  const [showForm, setShowForm] = useState(false);
  const userName = localStorage.getItem("full_name") || "User";

  useEffect(() => {
    const loadPosts = async () => {
      setError("");
      try {
        const data = await api.listForumPosts();
        setPosts(data.items || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoadingPosts(false);
      }
    };

    loadPosts();
  }, []);

  const handleCreatePost = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required");
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const newPost = await api.createForumPost(form);
      setPosts([newPost, ...posts]);
      setForm({ title: "", content: "" });
      setShowForm(false);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">👥 Community Forum</h1>
          <p className="text-gray-600 mt-2">A safe space to share experiences and support each other</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Create Post Button Or Form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl font-semibold hover:shadow-lg transition mb-8"
          >
            ✍️ Start a New Discussion
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Share Your Story</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  className="w-full rounded-lg border-2 border-gray-200 focus:border-purple-600 focus:outline-none px-4 py-3"
                  placeholder="What would you like to discuss?"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  maxLength={150}
                  required
                />
                <p className="text-xs text-gray-500 mt-2">{form.title.length}/150</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Message</label>
                <textarea
                  className="w-full rounded-lg border-2 border-gray-200 focus:border-purple-600 focus:outline-none px-4 py-3"
                  placeholder="Share your thoughts, experiences, or ask for advice... Be respectful and supportive."
                  rows={6}
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  maxLength={3000}
                  required
                />
                <p className="text-xs text-gray-500 mt-2">{form.content.length}/3000</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  {isCreating ? "Posting..." : "Post Discussion"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Posts List */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              💬 {posts.length} Discussion{posts.length !== 1 ? 's' : ''}
            </h2>
          </div>

          {isLoadingPosts ? (
            <div className="text-center py-12">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-gray-600">Loading discussions...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <div className="text-5xl mb-4">🌱</div>
              <p className="text-gray-700 font-semibold mb-2">No discussions yet</p>
              <p className="text-gray-600">Be the first to start a conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition overflow-hidden border-l-4 border-purple-600"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 hover:text-purple-600 transition">
                          {post.title}
                        </h3>
                        <p className="text-gray-600 mt-2 flex items-center gap-2">
                          <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                            👤 {post.author_name}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(post.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-3">
                      {post.content}
                    </p>

                    <div className="mt-4 flex gap-3">
                      <button className="text-sm px-4 py-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg font-semibold transition">
                        💬 Reply
                      </button>
                      <button className="text-sm px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-semibold transition">
                        ❤️ Support
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-12 flex gap-3 justify-center">
          <button
            onClick={() => navigate("/assessment")}
            className="bg-white hover:shadow-lg px-4 py-2 rounded-lg transition"
          >
            📋 Assessment
          </button>
          <button
            onClick={() => navigate("/chat")}
            className="bg-white hover:shadow-lg px-4 py-2 rounded-lg transition"
          >
            💬 Chat
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-white hover:shadow-lg px-4 py-2 rounded-lg transition"
          >
            📊 Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
