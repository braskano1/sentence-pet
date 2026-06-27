import type { ContentBundle } from './model';

/** The migrated static content (snapshot). Bundled fallback for first paint AND the
 *  seed-script source. Generated from the legacy data/ modules; now standalone.
 *  Do NOT hand-edit: change content via the admin UI (#admin), then regenerate with
 *  `npm run seed:export`. */
export const SEED: ContentBundle = {
  pool: {
    "l1-1": {
      "id": "l1-1",
      "drill": "pattern",
      "level": 1,
      "thaiHint": "ฉันวิ่ง",
      "slots": ["Pronoun", "Verb"],
      "answer": ["I", "run"]
    },
    "l1-2": {
      "id": "l1-2",
      "drill": "pattern",
      "level": 1,
      "thaiHint": "เขากิน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["he", "eats"]
    },
    "l1-3": {
      "id": "l1-3",
      "drill": "pattern",
      "level": 1,
      "thaiHint": "พวกเรานอน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["we", "sleep"]
    },
    "l1-4": {
      "id": "l1-4",
      "drill": "pattern",
      "level": 1,
      "thaiHint": "เธอเดิน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["she", "walks"]
    },
    "l1-5": {
      "id": "l1-5",
      "drill": "pattern",
      "level": 1,
      "thaiHint": "พวกเขาเล่น",
      "slots": ["Pronoun", "Verb"],
      "answer": ["they", "play"]
    },
    "l2-1": {
      "id": "l2-1",
      "drill": "pattern",
      "level": 2,
      "thaiHint": "ฉันกินข้าว",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["I", "eat", "rice"]
    },
    "l2-2": {
      "id": "l2-2",
      "drill": "pattern",
      "level": 2,
      "thaiHint": "เขาดื่มน้ำ",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["he", "drinks", "water"]
    },
    "l2-3": {
      "id": "l2-3",
      "drill": "pattern",
      "level": 2,
      "thaiHint": "เธออ่านหนังสือ",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["she", "reads", "a book"]
    },
    "l2-4": {
      "id": "l2-4",
      "drill": "pattern",
      "level": 2,
      "thaiHint": "พวกเราเล่นฟุตบอล",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["we", "play", "football"]
    },
    "l2-5": {
      "id": "l2-5",
      "drill": "pattern",
      "level": 2,
      "thaiHint": "พวกเขาดูทีวี",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["they", "watch", "TV"]
    },
    "wc-l1-1": {
      "id": "wc-l1-1",
      "drill": "wordChoice",
      "level": 1,
      "thaiHint": "ฉันวิ่ง",
      "slots": ["Pronoun", "Verb"],
      "answer": ["I", "run"],
      "distractors": ["runs", "running"]
    },
    "wc-l1-2": {
      "id": "wc-l1-2",
      "drill": "wordChoice",
      "level": 1,
      "thaiHint": "เขากิน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["he", "eats"],
      "distractors": ["eat", "eating"]
    },
    "wc-l1-3": {
      "id": "wc-l1-3",
      "drill": "wordChoice",
      "level": 1,
      "thaiHint": "พวกเรานอน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["we", "sleep"],
      "distractors": ["sleeps", "sleeping"]
    },
    "wc-l1-4": {
      "id": "wc-l1-4",
      "drill": "wordChoice",
      "level": 1,
      "thaiHint": "เธอเดิน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["she", "walks"],
      "distractors": ["walk", "walking"]
    },
    "wc-l1-5": {
      "id": "wc-l1-5",
      "drill": "wordChoice",
      "level": 1,
      "thaiHint": "พวกเขาเล่น",
      "slots": ["Pronoun", "Verb"],
      "answer": ["they", "play"],
      "distractors": ["plays", "playing"]
    },
    "gr-l1-1": {
      "id": "gr-l1-1",
      "drill": "grammar",
      "level": 1,
      "thaiHint": "เขากิน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["he", "eats"],
      "traps": [{ "slot": 1, "word": "eat", "tip": "เขา → he eats 👍" }]
    },
    "gr-l1-2": {
      "id": "gr-l1-2",
      "drill": "grammar",
      "level": 1,
      "thaiHint": "เธอเดิน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["she", "walks"],
      "traps": [{ "slot": 1, "word": "walk", "tip": "เธอ → she walks 👍" }]
    },
    "gr-l1-3": {
      "id": "gr-l1-3",
      "drill": "grammar",
      "level": 1,
      "thaiHint": "แมววิ่ง",
      "slots": ["Pronoun", "Verb"],
      "answer": ["it", "runs"],
      "traps": [{ "slot": 1, "word": "run", "tip": "it → it runs 👍" }]
    },
    "gr-l1-4": {
      "id": "gr-l1-4",
      "drill": "grammar",
      "level": 1,
      "thaiHint": "เขานอน",
      "slots": ["Pronoun", "Verb"],
      "answer": ["he", "sleeps"],
      "traps": [{ "slot": 1, "word": "sleep", "tip": "เขา → he sleeps 👍" }]
    },
    "gr-l1-5": {
      "id": "gr-l1-5",
      "drill": "grammar",
      "level": 1,
      "thaiHint": "เธอเล่น",
      "slots": ["Pronoun", "Verb"],
      "answer": ["she", "plays"],
      "traps": [{ "slot": 1, "word": "play", "tip": "เธอ → she plays 👍" }]
    },
    "gr-l2-1": {
      "id": "gr-l2-1",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เธอกินข้าว",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["she", "eats", "rice"],
      "traps": [{ "slot": 1, "word": "eat", "tip": "เธอ → she eats 👍" }]
    },
    "gr-l2-2": {
      "id": "gr-l2-2",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เขาดื่มน้ำ",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["he", "drinks", "water"],
      "traps": [{ "slot": 1, "word": "drink", "tip": "เขา → he drinks 👍" }]
    },
    "gr-l2-3": {
      "id": "gr-l2-3",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เธออ่านหนังสือ",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["she", "reads", "books"],
      "traps": [{ "slot": 1, "word": "read", "tip": "เธอ → she reads 👍" }]
    },
    "gr-l2-4": {
      "id": "gr-l2-4",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เขาเล่นฟุตบอล",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["he", "plays", "football"],
      "traps": [{ "slot": 1, "word": "play", "tip": "เขา → he plays 👍" }]
    },
    "gr-l2-5": {
      "id": "gr-l2-5",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เธอชอบแมว",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["she", "likes", "cats"],
      "traps": [{ "slot": 1, "word": "like", "tip": "เธอ → she likes 👍" }]
    },
    "mx-l1-1": {
      "id": "mx-l1-1",
      "drill": "mixed",
      "level": 1,
      "thaiHint": "ฉันกินข้าว",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["I", "eat", "rice"],
      "distractors": ["bread"],
      "traps": [{ "slot": 1, "word": "eats", "tip": "ฉัน → I eat 👍" }]
    },
    "mx-l1-2": {
      "id": "mx-l1-2",
      "drill": "mixed",
      "level": 1,
      "thaiHint": "เขาดื่มน้ำ",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["he", "drinks", "water"],
      "distractors": ["juice"],
      "traps": [{ "slot": 1, "word": "drink", "tip": "เขา → he drinks 👍" }]
    },
    "mx-l1-3": {
      "id": "mx-l1-3",
      "drill": "mixed",
      "level": 1,
      "thaiHint": "เธออ่านหนังสือ",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["she", "reads", "a book"],
      "distractors": ["a pen"],
      "traps": [{ "slot": 1, "word": "read", "tip": "เธอ → she reads 👍" }]
    },
    "mx-l1-4": {
      "id": "mx-l1-4",
      "drill": "mixed",
      "level": 1,
      "thaiHint": "พวกเราเล่นฟุตบอล",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["we", "play", "football"],
      "distractors": ["tennis"],
      "traps": [{ "slot": 1, "word": "plays", "tip": "เรา → we play 👍" }]
    },
    "mx-l1-5": {
      "id": "mx-l1-5",
      "drill": "mixed",
      "level": 1,
      "thaiHint": "พวกเขาดูทีวี",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["they", "watch", "TV"],
      "distractors": ["a movie"],
      "traps": [{ "slot": 1, "word": "watches", "tip": "เขา → they watch 👍" }]
    }
  },
  units: [
    {
      id: "u1-basics",
      title: "Basics",
      emoji: "🐣",
      order: 1,
      lessons: [
        { id: "u1-pattern", drill: "pattern", level: 1, itemIds: ["l1-1", "l1-2", "l1-3", "l1-4", "l1-5"] },
        { id: "u1-wordchoice", drill: "wordChoice", level: 1, itemIds: ["wc-l1-1", "wc-l1-2", "wc-l1-3", "wc-l1-4", "wc-l1-5"] },
        { id: "u1-grammar", drill: "grammar", level: 1, itemIds: ["gr-l1-1", "gr-l1-2", "gr-l1-3", "gr-l1-4", "gr-l1-5"] },
        {
          id: "u1-checkpoint",
          drill: "mixed",
          level: 1,
          isCheckpoint: true,
          itemIds: ["mx-l1-1", "mx-l1-2", "mx-l1-3", "mx-l1-4", "mx-l1-5"],
          boss: {
            tierId: 'tier-1',
            element: 'fire',
            name: 'Ember Rival',
            rivalSprite: { species: 'fire', stage: 'young' },
          },
        }
      ]
    },
    {
      id: "u2-next-steps",
      title: "Next Steps",
      emoji: "🌱",
      order: 2,
      lessons: [
        { id: "u2-pattern", drill: "pattern", level: 2, itemIds: ["l2-1", "l2-2", "l2-3", "l2-4", "l2-5"] },
        { id: "u2-grammar", drill: "grammar", level: 2, itemIds: ["gr-l2-1", "gr-l2-2", "gr-l2-3", "gr-l2-4", "gr-l2-5"] },
        { id: "u2-checkpoint", drill: "mixed", level: 1, isCheckpoint: true, itemIds: ["mx-l1-1", "mx-l1-2", "mx-l1-3", "mx-l1-4", "mx-l1-5"] }
      ]
    }
  ]
};
