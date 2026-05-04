import { TranslationResult, LanguagePack } from "../types";

// A small dictionary for "offline" mode demo
const OFFLINE_DICTIONARY: Record<string, string> = {
  "hello": "નમસ્તે (Hello)",
  "how are you": "તમે કેમ છો? (How are you?)",
  "good morning": "શુભ સવાર (Good morning)",
  "good night": "શુભ રાત્રિ (Good night)",
  "thank you": "આભાર (Thank you)",
  "welcome": "સ્વાગત છે (Welcome)",
  "yes": "હા (Yes)",
  "no": "ના (No)",
  "please": "મહેરબાની કરીને (Please)",
  "sorry": "ક્ષમા કરશો (Sorry)"
};

export const localTranslate = async (text: string): Promise<TranslationResult> => {
  // Simulate a bit of processing delay for "offline engine"
  await new Promise(resolve => setTimeout(resolve, 600));

  const lowerText = text.toLowerCase().trim();
  const translation = OFFLINE_DICTIONARY[lowerText];

  if (translation) {
    return {
      originalText: text,
      translatedText: translation,
      sourceLanguage: "English (Offline Pack)",
      isOffline: true
    };
  }

  // Fallback for unknown words in offline mode
  return {
    originalText: text,
    translatedText: `[Offline] ${text} (Download full pack for better results)`,
    sourceLanguage: "Detected (Offline)",
    isOffline: true
  };
};

export const AVAILABLE_PACKS: LanguagePack[] = [
  { id: 'en-gu', name: 'English ↔ Gujarati', status: 'available', size: '12.4 MB' },
  { id: 'hi-gu', name: 'Hindi ↔ Gujarati', status: 'available', size: '8.1 MB' },
  { id: 'fr-gu', name: 'French ↔ Gujarati', status: 'available', size: '15.2 MB' },
];
