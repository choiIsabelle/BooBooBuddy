"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Pre-generated falling items to avoid Math.random() during render
const fallingItems = [
  {
    id: 0,
    emoji: "💊",
    left: 5,
    animationDuration: 12,
    animationDelay: -2,
    fontSize: 24,
  },
  {
    id: 1,
    emoji: "🩹",
    left: 15,
    animationDuration: 18,
    animationDelay: -8,
    fontSize: 20,
  },
  {
    id: 2,
    emoji: "💉",
    left: 25,
    animationDuration: 14,
    animationDelay: -4,
    fontSize: 28,
  },
  {
    id: 3,
    emoji: "🩺",
    left: 35,
    animationDuration: 20,
    animationDelay: -12,
    fontSize: 22,
  },
  {
    id: 4,
    emoji: "🏥",
    left: 45,
    animationDuration: 16,
    animationDelay: -6,
    fontSize: 26,
  },
  {
    id: 5,
    emoji: "❤️‍🩹",
    left: 55,
    animationDuration: 22,
    animationDelay: -14,
    fontSize: 18,
  },
  {
    id: 6,
    emoji: "🧴",
    left: 65,
    animationDuration: 13,
    animationDelay: -3,
    fontSize: 30,
  },
  {
    id: 7,
    emoji: "🩼",
    left: 75,
    animationDuration: 19,
    animationDelay: -10,
    fontSize: 21,
  },
  {
    id: 8,
    emoji: "💊",
    left: 85,
    animationDuration: 15,
    animationDelay: -5,
    fontSize: 25,
  },
  {
    id: 9,
    emoji: "🩹",
    left: 95,
    animationDuration: 21,
    animationDelay: -16,
    fontSize: 19,
  },
  {
    id: 10,
    emoji: "💉",
    left: 10,
    animationDuration: 17,
    animationDelay: -7,
    fontSize: 27,
  },
  {
    id: 11,
    emoji: "🩺",
    left: 20,
    animationDuration: 11,
    animationDelay: -1,
    fontSize: 23,
  },
  {
    id: 12,
    emoji: "🏥",
    left: 30,
    animationDuration: 23,
    animationDelay: -18,
    fontSize: 17,
  },
  {
    id: 13,
    emoji: "❤️‍🩹",
    left: 40,
    animationDuration: 14,
    animationDelay: -9,
    fontSize: 29,
  },
  {
    id: 14,
    emoji: "🧴",
    left: 50,
    animationDuration: 18,
    animationDelay: -11,
    fontSize: 20,
  },
  {
    id: 15,
    emoji: "🩼",
    left: 60,
    animationDuration: 12,
    animationDelay: -3,
    fontSize: 24,
  },
  {
    id: 16,
    emoji: "💊",
    left: 70,
    animationDuration: 20,
    animationDelay: -15,
    fontSize: 22,
  },
  {
    id: 17,
    emoji: "🩹",
    left: 80,
    animationDuration: 16,
    animationDelay: -6,
    fontSize: 26,
  },
  {
    id: 18,
    emoji: "💉",
    left: 90,
    animationDuration: 24,
    animationDelay: -19,
    fontSize: 18,
  },
  {
    id: 19,
    emoji: "🩺",
    left: 2,
    animationDuration: 13,
    animationDelay: -4,
    fontSize: 28,
  },
];

function FallingMedicines() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {fallingItems.map((item) => (
        <div
          key={item.id}
          className="absolute animate-fall opacity-30"
          style={{
            left: `${item.left}%`,
            fontSize: `${item.fontSize}px`,
            animationDuration: `${item.animationDuration}s`,
            animationDelay: `${item.animationDelay}s`,
          }}
        >
          {item.emoji}
        </div>
      ))}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-100px) rotate(0deg);
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
          }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle authentication logic here
    if (isLogin) {
      console.log("Logging in:", { email, password });
      // Redirect to chat after successful login
      router.push("/chat");
    } else {
      console.log("Signing up:", { name, email, password, confirmPassword });
      // After signup, redirect to chat as well
      router.push("/chat");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900 px-4">
      <FallingMedicines />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
        {/* Logo & Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
            <span className="text-3xl">🩹</span>
          </div>
          <h1 className="text-2xl font-bold text-teal-700 dark:text-teal-400">
            BooBoo Buddy
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {isLogin
              ? "Welcome back! Please sign in to continue."
              : "Create an account to get started."}
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="mb-6 flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              isLogin
                ? "bg-white text-teal-700 shadow dark:bg-zinc-700 dark:text-teal-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              !isLogin
                ? "bg-white text-teal-700 shadow dark:bg-zinc-700 dark:text-teal-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="John Doe"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="••••••••"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="••••••••"
                required={!isLogin}
              />
            </div>
          )}

          {isLogin && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500 dark:border-zinc-600"
                />
                Remember me
              </label>
              <a
                href="#"
                className="font-medium text-teal-600 hover:text-teal-500 dark:text-teal-400"
              >
                Forgot password?
              </a>
            </div>
          )}

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-teal-600 py-3 font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            {isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">or</span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        </div>

        {/* Social Login */}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white py-2.5 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
          By continuing, you agree to our{" "}
          <a
            href="#"
            className="text-teal-600 hover:underline dark:text-teal-400"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="#"
            className="text-teal-600 hover:underline dark:text-teal-400"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
