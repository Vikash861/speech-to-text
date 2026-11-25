import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage } from '../src/text.js';

test('detects Hindi, English and mixed text', () => {
  assert.equal(detectLanguage('I will send the report tomorrow'), 'en');
  assert.equal(detectLanguage('मैं कल घर जा रहा हूँ'), 'hi');
  assert.equal(detectLanguage('meeting कल है'), 'hi-en');
  assert.equal(detectLanguage('10:00'), 'unknown');
});

// Real Gemini output for the same spoken Hinglish sentence, once in each script
test('detects Hinglish written fully in English letters', () => {
  const text =
    'Namaste, kal ki meeting subah 10 baje hai, toh please sabko inform kar dena aur project report Friday tak submit karni hai.';
  assert.equal(detectLanguage(text), 'hi-en');
});

test('detects Hinglish written fully in Devanagari', () => {
  const text =
    'नमस्ते, कल की मीटिंग सुबह 10:00 बजे है, तो प्लीज सबको इन्फॉर्म कर देना और प्रोजेक्ट रिपोर्ट फ्राइडे तक सबमिट करनी है।';
  assert.equal(detectLanguage(text), 'hi-en');
});

test('detects English words in Devanagari that are not on the word list', () => {
  // A real recording: Hindi, with English words in Devanagari and one in English letters
  const text =
    'मैं विकास हूं। मैं इसको रिकॉर्ड कर रहा हूं फॉर टेस्टिंग टेस्टिंग द फीचर जो मैंने बनाया है स्पीच टू टेक्स्ट conversion के लिए।';
  assert.equal(detectLanguage(text), 'hi-en');
});

test('treats letters with and without the nukta dot the same', () => {
  assert.equal(detectLanguage('फ़ोन पर बात करो'), detectLanguage('फोन पर बात करो'));
});
