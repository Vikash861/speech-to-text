// Gemini writes a whole sentence in one script, so mixed Hindi + English speech comes back
// either fully in Devanagari ("कल की मीटिंग") or fully in English letters ("kal ki meeting").
// To still see the mix, we decide for each word whether it is Hindi or English.

// Treat letters with and without the nukta dot (फ़ and फ) as the same letter
const normalize = (word) => word.toLowerCase().normalize('NFD').replace(/़/g, '');

const toSet = (words) => new Set(words.trim().split(/\s+/).map(normalize));

// Common Hindi words written in English letters
const HINDI_WORDS_IN_LATIN = toSet(`
  hai hain ho tha thi ka ki ke ko se mein pe par aur ya bhi toh na nahi nahin
  kya kyun kaise kab kahan kaun koi kuch kitna main mai mera meri mere mujhe
  hum hamara humara tum tumhara aap aapka apna apni yeh ye woh wo isko usko yahan wahan
  kar karo karna karni karte karke kiya dena diya lena liya hona hoga hogi
  ja jaa jana gaya gayi raha rahi rahe hoon hun sakta sakti sakte chahiye wala wali wale
  ab abhi phir jab agar lekin matlab bas kal aaj din raat subah shaam baje
  bahut accha acha theek thik haan ji sab sabko tak liye saath baat kaam ghar yaar bhai
  namaste dhanyavaad shukriya
`);

// Common English words written in Devanagari
const ENGLISH_WORDS_IN_DEVANAGARI = toSet(`
  प्लीज प्रोजेक्ट रिपोर्ट सबमिट अपडेट डेडलाइन फोन मोबाइल मैसेज ईमेल टाइम प्लान टीम
  क्लाइंट मैनेजर मैडम ओके थैंक्स थैंक यू फाइल लिंक चेक सेंड फीचर स्पीच टू द
  ऐप वेबसाइट कोड डेटा यूजर वीकेंड मंडे ट्यूसडे वेडनेसडे थर्सडे फ्राइडे सैटरडे संडे
`);

// Other signs of an English word in Devanagari: the "ऑ" sound (रिकॉर्ड), which Hindi words
// don't use, an "-ing" ending (मीटिंग) or an "st" sound (टेस्ट)
const LOOKS_ENGLISH = /[ऑॉ]|िंग$|स्ट/;

function isHindiWord(word) {
  if (/\p{Script=Devanagari}/u.test(word)) {
    return !ENGLISH_WORDS_IN_DEVANAGARI.has(word) && !LOOKS_ENGLISH.test(word);
  }
  return HINDI_WORDS_IN_LATIN.has(word);
}

export function detectLanguage(text) {
  const words = (text.match(/[\p{L}\p{M}]+/gu) ?? []).map(normalize);
  if (words.length === 0) return 'unknown';

  const hindiShare = words.filter(isHindiWord).length / words.length;
  if (hindiShare > 0.85) return 'hi';
  if (hindiShare < 0.15) return 'en';
  return 'hi-en';
}

export function makeTitle(text, maxWords = 8) {
  const words = text.trim().split(/\s+/);
  const title = words.slice(0, maxWords).join(' ');
  return (words.length > maxWords ? title + '...' : title).slice(0, 200);
}
