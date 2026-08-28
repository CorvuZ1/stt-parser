const {
  INTENTS,
  LEXICON,
  STRONG_PHRASES,
  RESCHEDULE_CONTEXT,
  FILLERS,
  PHONETIC_MAP,
} = require("./constants");

const CONFIDENCE_THRESHOLD = 0.6;
const MIN_SCORE_FOR_INTENT = 2;
const MAX_CONFIDENCE = 0.99;
const DIFFERENCE_DIVISOR = 10;
const CONFIDENCE_SCALE = 0.7;

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[«»""''.,!?;:()\-—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeFillers(text) {
  const words = text.split(" ");

  return words.filter((w) => !FILLERS.includes(w)).join(" ");
}

function restoreSplitWords(text) {
  const prefixPatterns = [
    /за\s+писа/g,
    /от\s+мен/g,
    /пере\s+не/g,
    /по\s+жал/g,
    /при\s+ем/g,
    /рас\s+пис/g,
    /сто\s+им/g,
    /вы\s+писать/g,
    /наз\s+нач/g,
  ];
  let result = text;

  for (const pattern of prefixPatterns) {
    result = result.replace(pattern, (match) => match.replace(/\s+/g, ""));
  }

  return result;
}

function restorePhoneticWords(text) {
  let result = text;

  for (const [wrong, correct] of Object.entries(PHONETIC_MAP)) {
    const regex = new RegExp(wrong, "g");
    result = result.replace(regex, correct);
  }

  return result;
}

function hasGarbageContent(text) {
  const garbagePatterns = [
    /^[ыауэиюяё\s]+$/i,
    /^(ал[оё]|але|алло)[\s\W]*$/i,
    /^[мн\s]+$/i,
    /^[^\p{L}\p{N}]+$/u,
    /^спасибо[\s\W]*$/i,
    /^до свидания[\s\W]*$/i,
  ];

  return garbagePatterns.some((p) => p.test(text.trim()));
}

function levenshteinDistance(s, t) {
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const arr = [];

  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
              arr[i - 1][j] + 1,
              arr[i][j - 1] + 1,
              arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1),
            );
    }
  }

  return arr[t.length][s.length];
}

function checkStrongPhrases(text) {
  for (const [intent, phrases] of Object.entries(STRONG_PHRASES)) {
    for (const phrase of phrases) {
      if (text.includes(phrase)) {
        return { intent, score: 10 };
      }
    }
  }

  return null;
}

function checkRescheduleContext(text) {
  for (const regex of RESCHEDULE_CONTEXT) {
    if (regex.test(text)) {
      return true;
    }
  }

  return false;
}

function scoreIntent(text, intentName) {
  const keywords = LEXICON[intentName];
  const words = text.split(" ");
  let score = 0;

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 3;
    } else {
      for (const word of words) {
        if (word.length >= 4 && levenshteinDistance(word, keyword) <= 1) {
          score += 2;
          break;
        }
      }
    }
  }

  return score;
}

function resolveConflicts(text, scores) {
  if (text.includes("принести") && text.includes("запис")) {
    scores[INTENTS.BOOK] -= 5;
    scores[INTENTS.RESCHEDULE] += 3;
  }

  if (text.includes("отменить") && text.includes("запис")) {
    scores[INTENTS.CANCEL] += 3;
    scores[INTENTS.RESCHEDULE] -= 2;
  }

  if (text.includes("сколько") && text.includes("стоит")) {
    scores[INTENTS.INFO] += 3;
    scores[INTENTS.BOOK] -= 2;
  }

  if (
    text.includes("человек") &&
    (text.includes("хочу") || text.includes("поговорить"))
  ) {
    scores[INTENTS.OPERATOR] += 3;
    scores[INTENTS.COMPLAINT] -= 1;
  }
  return scores;
}

function calculateConfidence(bestScore, secondScore) {
  if (bestScore <= 0) return 0;
  if (secondScore <= 0) return MAX_CONFIDENCE;

  const difference = bestScore - secondScore;
  const ratio = bestScore / (bestScore + secondScore);

  return Math.min(
    MAX_CONFIDENCE,
    (ratio + difference / DIFFERENCE_DIVISOR) * CONFIDENCE_SCALE,
  );
}

function parse(rawText) {
  let text = normalizeText(rawText);

  if (hasGarbageContent(text)) {
    return {
      intent: INTENTS.UNCLEAR,
      confidence: 0,
      reason: "Мусорное содержание",
    };
  }

  text = removeFillers(text);
  text = restoreSplitWords(text);
  text = restorePhoneticWords(text);
  const strong = checkStrongPhrases(text);

  if (strong) {
    return {
      intent: strong.intent,
      confidence: MAX_CONFIDENCE,
      scores: { [strong.intent]: strong.score },
    };
  }

  let scores = {};

  for (const intentName of Object.values(INTENTS)) {
    if (intentName === INTENTS.UNCLEAR) continue;
    scores[intentName] = scoreIntent(text, intentName);
  }

  if (checkRescheduleContext(text)) {
    scores[INTENTS.RESCHEDULE] += 5;
  }

  scores = resolveConflicts(text, scores);
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestIntent, bestScore] = sortedScores[0];
  const [, secondScore] = sortedScores[1] || [, 0];

  if (bestScore < MIN_SCORE_FOR_INTENT) {
    return {
      intent: INTENTS.UNCLEAR,
      confidence: 0,
      reason: "Низкий счет",
      scores,
    };
  }

  const confidence = calculateConfidence(bestScore, secondScore);

  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      intent: INTENTS.UNCLEAR,
      confidence,
      reason: "Низкая уверенность",
      scores,
    };
  }

  return { intent: bestIntent, confidence, scores };
}

module.exports = { parse };
