import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      email: "",
      password: "",
      full_name: "",
    },
  });

  const onSubmit = async (form) => {
    setError("");
    setIsLoading(true);

    try {
      const payload = isRegister
        ? await api.register(form)
        : await api.login({ email: form.email, password: form.password });

      localStorage.setItem("token", payload.access_token);
      localStorage.setItem("user_id", payload.user_id || "");
      localStorage.setItem("email", payload.user_email || payload.email || "");
      localStorage.setItem("full_name", payload.full_name || "");
      navigate("/dashboard");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="animated-gradient flex min-h-screen items-center justify-center px-4 py-6">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mb-4 inline-block rounded-full bg-white p-4">
            <span className="text-5xl">❤️</span>
          </div>
          <h1 className="text-4xl font-bold text-white">Healthly</h1>
          <p className="mt-2 text-sm text-blue-100">Your Mental Wellness Companion</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit(onSubmit)}
          className="card-glass"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {isRegister
              ? "Join our supportive community"
              : "Sign in to your account"}
          </p>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  className="input-field focus-ring"
                  placeholder="John Doe"
                  {...register("full_name", { required: isRegister })}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                className="input-field focus-ring"
                type="email"
                placeholder="you@example.com"
                {...register("email", { required: true })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <input
                className="input-field focus-ring"
                type="password"
                placeholder="••••••••"
                {...register("password", { required: true, minLength: 8 })}
              />
              {!isRegister && (
                <p className="text-xs text-gray-600 mt-1">Minimum 8 characters</p>
              )}
            </div>
          </div>

          <button
            className="btn-primary btn-ripple focus-ring mt-6 w-full"
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? "One moment..."
              : isRegister
              ? "Create Account"
              : "Sign In"}
          </button>

          <button
            className="w-full mt-4 text-blue-600 hover:text-blue-700 font-semibold text-sm transition"
            onClick={() => {
              setIsRegister((value) => !value);
              setError("");
              reset({ email: "", password: "", full_name: "" });
            }}
            type="button"
          >
            {isRegister
              ? "Already have an account? Sign In"
              : "Don't have an account? Sign Up"}
          </button>
        </motion.form>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-blue-100 text-xs">
            We prioritize your privacy and confidentiality
          </p>
        </div>
      </div>
    </main>
  );
}
