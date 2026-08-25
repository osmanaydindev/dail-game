import { todayLocal } from './date';

// Curated answer list — these are the daily puzzle words.
// Validation against all ~5600 words happens via wordleValid.ts (lazy-loaded).
// Uppercase with the Turkish locale only: 'çiçek'.toUpperCase() yields ÇIÇEK,
// 'çiçek'.toLocaleUpperCase('tr-TR') yields ÇİÇEK. Every word here is the tr-TR form.
export const WORDS: string[] = [
  // A
  'AKŞAM', 'ALÇAK', 'ALARM', 'ALTIN', 'AMBAR', 'ANLAM', 'ANTİK', 'ARABA', 'ARAZİ', 'ARMUT',
  'ASKER', 'ATLAS', 'AZGIN',
  // B
  'BAHÇE', 'BALIK', 'BALYA', 'BANKA', 'BAYIR', 'BEBEK', 'BEYAZ', 'BÖLÜM', 'BORSA', 'BOZUK',
  'BUKET', 'BULUT', 'BÜYÜK', 'BÜTÜN',
  // C-Ç
  'CEKET', 'ÇANTA', 'ÇAYIR', 'ÇİÇEK', 'ÇIKIŞ', 'ÇORAP', 'ÇORBA', 'ÇÖZÜM',
  // D
  'DAİRE', 'DALGA', 'DENİZ', 'DEMET', 'DENEY', 'DERGİ', 'DİLEK', 'DOĞRU', 'DOLAP', 'DÖNÜŞ',
  'DUMAN', 'DÜŞÜK',
  // E
  'EKMEK', 'EKRAN', 'ELMAS', 'ERKEN', 'EYLEM',
  // F
  'FAKİR', 'FENER', 'FİDAN', 'FİLİZ',
  // G-Ğ
  'GARAJ', 'GARİP', 'GELİN', 'GİRİŞ', 'GÜÇLÜ', 'GÜNEŞ', 'GÜZEL',
  // H
  'HABER', 'HAFTA', 'HAFİF', 'HALAT', 'HALKA', 'HAMAM', 'HATIR', 'HAVLU', 'HAYAT', 'HEDEF',
  'HEKİM', 'HUZUR',
  // İ-I
  'İKLİM', 'İNCİR', 'İNSAN',
  // K
  'KABUL', 'KABUS', 'KAĞIT', 'KAHVE', 'KALEM', 'KANCA', 'KAPAK', 'KANAT', 'KARAR', 'KARIN',
  'KAVUN', 'KAZAK', 'KAZAN', 'KEBAP', 'KENAR', 'KESİN', 'KILIÇ', 'KİLİM', 'KİLİT', 'KİRAZ',
  'KİTAP', 'KLİMA', 'KOMŞU', 'KONAK', 'KOPUŞ', 'KORKU', 'KOVAN', 'KOYUN', 'KÖPEK', 'KÖPRÜ',
  'KÖYLÜ', 'KUCAK', 'KUKLA', 'KUMRU', 'KURGU', 'KUZEY', 'KÜÇÜK', 'KÜREK',
  // L
  'LAMBA', 'LİMON', 'LOKMA',
  // M
  'MAKAM', 'MANAV', 'MANTO', 'MARKA', 'MASAL', 'MERAK', 'MESAJ', 'MEŞRU', 'MEYVE', 'MEZAR',
  'MİRAS', 'MISIR', 'MİSAL', 'MOTOR', 'MUTLU', 'MÜZİK',
  // N
  'NAZİK', 'NEHİR', 'NİMET', 'NOTER', 'NÜFUS',
  // O-Ö
  'OLGUN', 'OMLET', 'ÖNLEM', 'ORGAN', 'ORMAN', 'OTLAK', 'ÖTEKİ', 'OYNAK', 'ÖZGÜR', 'ÖZLEM',
  // P
  'PARAF', 'PARÇA', 'PASTA', 'PAZAR', 'PLAKA', 'POŞET',
  // R
  'RADYO', 'RAKET',
  // S-Ş
  'SABAH', 'SABUN', 'SEDİR', 'SINIR', 'SİLGİ', 'SİNEK', 'SİYAH', 'SOKAK', 'ŞARAP', 'ŞEKER',
  'ŞEHİR', 'ŞİMDİ',
  // T
  'TAHTA', 'TARAF', 'TARİH', 'TAVAN', 'TORBA', 'TURNA', 'TÜNEL', 'TÜTÜN',
  // U-Ü
  'UYSAL', 'UZMAN', 'ÜSTAD', 'ÜSTÜN',
  // V
  'VAHŞİ', 'VAPUR', 'VATAN', 'VERİM', 'VEZİR', 'VİLLA',
  // Y
  'YAFTA', 'YAKIN', 'YALAN', 'YAPIM', 'YARIN', 'YATAK', 'YAZAR', 'YEMİN', 'YEMEK', 'YENİK',
  'YEŞİL', 'YİRMİ', 'YÜZME', 'YÜZÜK',
  // Z
  'ZAMAN', 'ZEMİN', 'ZİYAN', 'ZÜMRE',
];

const EPOCH = new Date('2026-01-01');

export function getDailyWord(): string {
  const today = new Date(todayLocal());
  const dayIndex = Math.floor((today.getTime() - EPOCH.getTime()) / 86_400_000);
  return WORDS[((dayIndex % WORDS.length) + WORDS.length) % WORDS.length];
}

// All valid Turkish uppercase letters
export const VALID_LETTERS = new Set('ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split(''));

// Lazy-load the full 5591-word validation set only when needed
let _validWords: Set<string> | null = null;

export async function loadValidWords(): Promise<Set<string>> {
  if (_validWords) return _validWords;
  const mod = await import('./wordleValid');
  _validWords = mod.default;
  // Also ensure all ANSWERS are valid guesses
  for (const w of WORDS) _validWords.add(w);
  return _validWords;
}

export function isValidGuess(word: string): boolean {
  return _validWords ? _validWords.has(word) : true; // fallback: allow while loading
}
