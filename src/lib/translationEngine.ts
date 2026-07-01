// Predefined bilingual dictionary covering multiple industries
export const builtinEnglishToPunjabi: Record<string, string> = {
  // Grocery
  sugar: 'ਚੀਨੀ',
  salt: 'ਨਮਕ',
  rice: 'ਚੌਲ',
  oil: 'ਤੇਲ',
  milk: 'ਦੁੱਧ',
  butter: 'ਮੱਖਣ',
  biscuit: 'ਬਿਸਕੁਟ',
  chocolate: 'ਚਾਕਲੇਟ',
  tea: 'ਚਾਹ',
  soap: 'ਸਾਬਣ',
  shampoo: 'ਸ਼ੈਂਪੂ',
  water: 'ਪਾਣੀ',
  ghee: 'ਘਿਓ',
  pulses: 'ਦਾਲਾਂ',
  lentils: 'ਦਾਲ',
  wheat: 'ਕਣਕ',
  flour: 'ਆਟਾ',
  'wheat flour': 'ਕਣਕ ਦਾ ਆਟਾ',
  'mustard oil': 'ਸਰੋਂ ਦਾ ਤੇਲ',

  // Hardware/Paint
  cement: 'ਸੀਮੈਂਟ',
  paint: 'ਪੇਂਟ',
  pipes: 'ਪਾਈਪਾਂ',
  pipe: 'ਪਾਈਪ',
  hammer: 'ਹਥੌੜਾ',
  screws: 'ਪੇਚ',
  screw: 'ਪੇਚ',
  nails: 'ਕਿੱਲ',
  nail: 'ਕਿੱਲ',
  drill: 'ਡ੍ਰਿਲ',
  pliers: 'ਪਲਾਸ',
  screwdriver: 'ਪੇਚਕਸ',

  // Electrical
  wires: 'ਤਾਰਾਂ',
  wire: 'ਤਾਰ',
  switch: 'ਸਵਿੱਚ',
  bulb: 'ਬਲਬ',
  fan: 'ਪੱਖਾ',

  // Mobile
  smartphone: 'ਸਮਾਰਟਫੋਨ',
  smartphones: 'ਸਮਾਰਟਫੋਨ',
  charger: 'ਚਾਰਜਰ',
  battery: 'ਬੈਟਰੀ',
  cover: 'ਕਵਰ',

  // Garments
  shirt: 'ਕਮੀਜ਼',
  pants: 'ਪੈਂਟ',
  socks: 'ਜੁਰਾਬਾਂ',
  shoes: 'ਜੁੱਤੀਆਂ',
  jacket: 'ਜੈਕਟ',

  // Medical
  medicine: 'ਦਵਾਈ',
  medicines: 'ਦਵਾਈਆਂ',
  syringe: 'ਸੂਈ',
  bandage: 'ਪੱਟੀ',

  // Agriculture
  seed: 'ਬੀਜ',
  seeds: 'ਬੀਜ',
  fertilizer: 'ਖਾਦ',
  pesticide: 'ਕੀਟਨਾਸ਼ਕ',
  urea: 'ਯੂਰੀਆ',

  // Stationery/Book
  pen: 'ਪੈੱਨ',
  notebook: 'ਕਾਪੀ',
  notebooks: 'ਕਾਪੀਆਂ',
  book: 'ਕਿਤਾਬ',
  books: 'ਕਿਤਾਬਾਂ',
};

// Build reverse mapping dynamically
export const builtinPunjabiToEnglish: Record<string, string> = {};
Object.entries(builtinEnglishToPunjabi).forEach(([en, pa]) => {
  builtinPunjabiToEnglish[pa] = en.charAt(0).toUpperCase() + en.slice(1);
});

// Unit translations
const englishToPunjabiUnits: Record<string, string> = {
  kg: 'ਕਿਲੋ',
  'kg.': 'ਕਿਲੋ',
  kilo: 'ਕਿਲੋ',
  g: 'ਗ੍ਰਾਮ',
  gm: 'ਗ੍ਰਾਮ',
  grams: 'ਗ੍ਰਾਮ',
  l: 'ਲੀਟਰ',
  ltr: 'ਲੀਟਰ',
  liter: 'ਲੀਟਰ',
  litre: 'ਲੀਟਰ',
  ml: 'ਮਿ.ਲੀ.',
  pc: 'ਪੀਸ',
  pcs: 'ਪੀਸ',
  piece: 'ਪੀਸ',
  pieces: 'ਪੀਸ',
  bag: 'ਬੈਗ',
  bags: 'ਬੈਗ',
  box: 'ਡੱਬਾ',
  boxes: 'ਡੱਬੇ',
  packet: 'ਪੈਕੇਟ',
  packets: 'ਪੈਕੇਟ',
};

const punjabiToEnglishUnits: Record<string, string> = {
  ਕਿਲੋ: 'kg',
  'ਕਿ.ਗ੍ਰਾ.': 'kg',
  ਗ੍ਰਾਮ: 'g',
  ਲੀਟਰ: 'L',
  ਲਿਟਰ: 'L',
  'ਮਿ.ਲੀ.': 'ml',
  ਪੀਸ: 'pcs',
  ਬੈਗ: 'bag',
  ਡੱਬਾ: 'box',
  ਡੱਬੇ: 'boxes',
  ਪੈਕੇਟ: 'pkt',
};

// Phrase translation parser with quantity splitting
export function translatePhrase(
  phrase: string,
  isEnglishToPunjabi: boolean,
  shopMemory: Record<string, string>
): string | null {
  const trimmed = phrase.trim();
  if (!trimmed) return null;

  const normalizedInput = trimmed.toLowerCase();

  // Priority 1: Check exact match in Shop Memory
  if (shopMemory[normalizedInput]) {
    return shopMemory[normalizedInput];
  }

  // Priority 2: Check exact match in predefined dictionary
  if (isEnglishToPunjabi) {
    if (builtinEnglishToPunjabi[normalizedInput]) {
      return builtinEnglishToPunjabi[normalizedInput];
    }
  } else {
    if (builtinPunjabiToEnglish[normalizedInput]) {
      return builtinPunjabiToEnglish[normalizedInput];
    }
  }

  // Regex to extract trailing numeric quantity & unit suffix
  // e.g. "Sugar 5kg" -> match: "Sugar", "5", "kg"
  const quantityRegex = /^(.*?)\s*(\d+(?:\.\d+)?)\s*(kg|kg\.|kilo|g|gm|grams|l|ltr|liter|litre|ml|pc|pcs|piece|pieces|bag|bags|box|boxes|packet|packets|ਕਿਲੋ|ਕਿ\.ਗ੍ਰਾ\.|ਗ੍ਰਾਮ|ਲੀਟਰ|ਲਿਟਰ|ਮਿ\.ਲੀ\.|ਪੀਸ|ਬੈਗ|ਡੱਬਾ|ਡੱਬੇ|ਪੈਕੇਟ)$/i;
  const match = trimmed.match(quantityRegex);

  if (match) {
    const baseWord = match[1].trim();
    const numberVal = match[2];
    const unitVal = match[3].toLowerCase();

    const normalizedBase = baseWord.toLowerCase();
    let translatedBase: string | null = null;

    // Resolve base name
    if (shopMemory[normalizedBase]) {
      translatedBase = shopMemory[normalizedBase];
    } else if (isEnglishToPunjabi) {
      translatedBase = builtinEnglishToPunjabi[normalizedBase] || null;
    } else {
      translatedBase = builtinPunjabiToEnglish[normalizedBase] || null;
    }

    if (translatedBase) {
      // Resolve unit name
      let translatedUnit = unitVal;
      if (isEnglishToPunjabi) {
        translatedUnit = englishToPunjabiUnits[unitVal] || unitVal;
        return `${translatedBase} ${numberVal} ${translatedUnit}`;
      } else {
        translatedUnit = punjabiToEnglishUnits[unitVal] || unitVal;
        return `${translatedBase} ${numberVal}${translatedUnit}`;
      }
    }
  }

  return null;
}
