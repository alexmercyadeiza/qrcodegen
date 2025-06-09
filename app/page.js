"use client";

import { useState, useEffect } from "react";
import {
  QrCode,
  LinkIcon,
  Eye,
  X,
  Copy,
  Download,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import Link from "next/link";
import Image from "next/image";

// Check if Supabase environment variables are available
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useLocalStorageOnly = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// Create Supabase client only if credentials are available
const supabase = !useLocalStorageOnly
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const generateQRCode = (text) => {
  return QRCode.toDataURL(text, {
    width: 2000, // Increased from 400 to 2000 for higher resolution
    margin: 4, // Added margin for better scanning
    errorCorrectionLevel: "H", // Highest error correction
    type: "image/png", // Explicitly set to PNG for better quality
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
};

// Mock Supabase functions
const saveToSupabase = async (qrData) => {
  // Generate a unique ID
  const id = Math.random().toString(36).substring(2, 15);
  const savedData = { id, ...qrData, created_at: new Date().toISOString() };

  // If we're not using localStorage only, try to save to Supabase
  if (!useLocalStorageOnly) {
    try {
      // Try to save to Supabase
      const { data, error } = await supabase
        .from("qr_codes")
        .insert([qrData])
        .select();

      // Update ID if Supabase returned one
      if (data && data[0]?.id) {
        savedData.id = data[0].id;
      }
    } catch (err) {
      console.error("Error saving to Supabase:", err);
      // Continue with localStorage (we already have savedData prepared)
    }
  }

  // Always save to localStorage for demo/fallback
  try {
    const existing = JSON.parse(localStorage.getItem("qr_codes") || "[]");
    existing.push(savedData);
    localStorage.setItem("qr_codes", JSON.stringify(existing));
  } catch (err) {
    console.error("Error saving to localStorage:", err);
  }

  return savedData;
};

const getFromSupabase = async () => {
  // If we're using localStorage only, skip Supabase
  if (useLocalStorageOnly) {
    try {
      return JSON.parse(localStorage.getItem("qr_codes") || "[]");
    } catch (err) {
      console.error("Error reading from localStorage:", err);
      return [];
    }
  }

  // Otherwise try Supabase first
  try {
    const { data, error } = await supabase.from("qr_codes").select("*");

    if (error) {
      throw error;
    }

    return data || [];
  } catch (err) {
    console.log("Falling back to localStorage");

    // Fallback to localStorage
    try {
      return JSON.parse(localStorage.getItem("qr_codes") || "[]");
    } catch (storageErr) {
      console.error("Error reading from localStorage:", storageErr);
      return [];
    }
  }
};

export default function QRCodeGenerator() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentQR, setCurrentQR] = useState(null);
  const [qrHistory, setQrHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const history = await getFromSupabase();
    setQrHistory((history ?? []).reverse()); // Show newest first, safely handles null/undefined
  };

  const validateUrl = (url) => {
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  };

  const handleGenerate = async () => {
    if (!url.trim()) return;

    const fullUrl = url.startsWith("http") ? url : `https://${url}`;

    if (!validateUrl(fullUrl)) {
      alert("Please enter a valid URL");
      return;
    }

    setLoading(true);

    try {
      const qrCodeData = await generateQRCode(fullUrl);

      const qrRecord = {
        original_url: fullUrl,
        qr_code_data: qrCodeData,
        short_id: Math.random().toString(36).substring(2, 8),
      };

      const savedRecord = await saveToSupabase(qrRecord);
      setCurrentQR(savedRecord);
      setShowModal(true);
      setUrl("");
      await loadHistory();
    } catch (error) {
      alert("Error generating QR code");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!currentQR) return;

    // Create a new image to ensure we get the highest quality
    const img = new Image();
    img.onload = () => {
      // Create a canvas to handle the download
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Set canvas size to match the image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0);

      // Create download link
      const link = document.createElement("a");
      link.download = `qr-code-${currentQR.short_id}.png`;
      link.href = canvas.toDataURL("image/png", 1.0); // Highest quality
      link.click();
    };

    // Set the image source to the QR code data URL
    img.src = currentQR.qr_code_data;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      {/* Header */}
      {/* <header className="relative overflow-hidden bg-white/80 backdrop-blur-sm border-b border-violet-100">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-indigo-600/5"></div>
      </header> */}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-4 md:px-8 md:py-16">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-200 bg-clip-text text-transparent">
            <span className="hidden md:inline-block">No fluff,&nbsp;</span>
            <span className="block md:inline-block">just QR&nbsp;</span>
            <span className="block md:inline-block">codes.</span>
          </h1>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-xl hover:from-violet-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Eye className="w-4 h-4" />
            <span className="font-medium">View History</span>
          </button>
        </div>
        <div className="bg-white backdrop-blur-sm rounded-3xl border border-gray-200 p-8">
          <div className="text-center mb-8">
            <p className="text-gray-700">
              Enter any URL and{" "}
              <span className="block md:inline-block"> we&apos;ll create a QR code instantly.</span>
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URL (e.g., google.com or https://example.com)"
                className="w-full placeholder-gray-400 pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all duration-200 text-lg"
                onKeyPress={(e) => e.key === "Enter" && handleGenerate()}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!url.trim() || loading}
              className="w-full py-4 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-2xl font-semibold text-lg hover:from-violet-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Generating...</span>
                </div>
              ) : (
                "Generate QR Code"
              )}
            </button>
          </div>
        </div>
      </main>

      {/* QR Code Modal */}
      {showModal && currentQR && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Your QR Code</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-4">
              <div className="bg-gray-50 rounded-2xl">
                <Image
                  src={currentQR.qr_code_data}
                  alt="QR Code"
                  width={256}
                  height={256}
                  className="w-64 h-64 rounded-2xl border-4 border-white shadow-lg"
                  unoptimized
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">Generated for:</p>
                <Link
                  href={currentQR.original_url}
                  target="_blank"
                  className="flex cursor-pointer items-center space-x-2 bg-gray-50 p-3 rounded-xl"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-mono break-all">
                    {currentQR.original_url}
                  </span>
                </Link>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => copyToClipboard(currentQR.original_url)}
                  className="flex-1 font-medium flex items-center justify-center space-x-2 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copied ? "Copied!" : "Copy URL"}</span>
                </button>

                <button
                  onClick={downloadQR}
                  className="flex-1 font-medium flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-xl hover:from-violet-600 hover:to-indigo-700 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                QR Code History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-96 p-6">
              {qrHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <QrCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No QR codes generated yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {qrHistory.map((qr) => (
                    <div
                      key={qr.id}
                      className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl"
                    >
                      <Image
                        src={qr.qr_code_data}
                        alt="QR Code"
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-lg"
                        unoptimized
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {qr.original_url}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(qr.created_at)
                            .toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                            .replace(/(\d+)(?=,)/, (_, d) => {
                              const day = parseInt(d, 10);
                              const suffix =
                                ["th", "st", "nd", "rd"][
                                  day % 100 > 10 && day % 100 < 14
                                    ? 0
                                    : day % 10
                                ] || "th";
                              return `${day}${suffix}`;
                            })}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setCurrentQR(qr);
                          setShowHistory(false);
                          setShowModal(true);
                        }}
                        className="px-4 py-2 font-medium bg-violet-100 text-violet-700 rounded-xl hover:bg-violet-200 transition-colors"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <footer className="py-8 text-center text-gray-500 text-sm">
        <p>
          &copy; {new Date().getFullYear()} made by{" "}
          <a 
            href="https://x.com/alexmadeiza" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-violet-600 hover:text-violet-800 transition-colors"
          >
            @alexmadeiza
          </a>
        </p>
      </footer>
    </div>
  );
}
