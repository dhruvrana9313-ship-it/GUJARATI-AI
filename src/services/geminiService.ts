import { GoogleGenAI } from "@google/genai";
import { TranslationResult } from "../types";

// Always initialize lazily within the call if needed, but here we can at top level if env is certain
const genAI = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

export const translateText = async (text: string): Promise<TranslationResult> => {
  if (!text.trim()) throw new Error("No text provided");

  const model = "gemini-3-flash-preview";
  const prompt = `Translate the following text into Gujarati. 
  Detect the source language automatically.
  Provide the output in JSON format with the following keys:
  - originalText: the original input text
  - translatedText: the Gujarati translation
  - sourceLanguage: the name of the detected source language
  
  Input: "${text}"`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      originalText: result.originalText || text,
      translatedText: result.translatedText || "",
      sourceLanguage: result.sourceLanguage || "Detected"
    };
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

export const transcribeMedia = async (fileData: string, mimeType: string): Promise<TranslationResult> => {
  const model = "gemini-3-flash-preview";
  const prompt = `Transcribe the audio/video content accurately and translate it into Gujarati.
  Detect the source language of the audio automatically.
  Return a JSON object with these exact keys:
  - "originalText": full transcription in the detected original language.
  - "translatedText": full transcription translated into Gujarati.
  - "sourceLanguage": the name of the detected source language (e.g., "English", "Hindi", "French").
  
  Ensure the translation is natural and culturally appropriate for Gujarati speakers.`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              data: fileData, // base64
              mimeType: mimeType
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      originalText: result.originalText || "",
      translatedText: result.translatedText || "",
      sourceLanguage: result.sourceLanguage || "Detected"
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

export const synthesizeSpeech = async (text: string): Promise<string> => {
  const model = "gemini-3.1-flash-tts-preview";
  
  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Speak the following Gujarati text naturally: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data received from Gemini TTS");
    }

    return base64Audio;
  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
};
