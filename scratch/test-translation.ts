import { translatePhrase } from '../src/lib/translationEngine';

async function runTests() {
  console.log('🚀 RUNNING BILINGUAL TRANSLATION ENGINE TESTS...');

  // Test Case 1: Built-in Dictionary fallback (Priority 2)
  console.log('\n--- Test Case 1: Built-in Dictionary ---');
  const res1 = translatePhrase('Sugar 5kg', true, {});
  console.log(`Input: "Sugar 5kg" -> Suggestion: "${res1}"`);
  if (res1 !== 'ਚੀਨੀ 5 ਕਿਲੋ') {
    throw new Error(`Test Case 1 failed: Expected "ਚੀਨੀ 5 ਕਿਲੋ", got "${res1}"`);
  }
  console.log('✅ Test Case 1 Passed');

  // Test Case 2: Shop Product memory override (Priority 1)
  console.log('\n--- Test Case 2: Shop Memory Override ---');
  const shopMemory = { sugar: 'ਖੰਡ' };
  const res2 = translatePhrase('Sugar 10kg', true, shopMemory);
  console.log(`Input: "Sugar 10kg" with memory { sugar: "ਖੰਡ" } -> Suggestion: "${res2}"`);
  if (res2 !== 'ਖੰਡ 10 ਕਿਲੋ') {
    throw new Error(`Test Case 2 failed: Expected "ਖੰਡ 10 ਕਿਲੋ", got "${res2}"`);
  }
  console.log('✅ Test Case 2 Passed');

  // Test Case 3: Reverse translation Punjabi -> English
  console.log('\n--- Test Case 3: Reverse Translation ---');
  const res3 = translatePhrase('ਚੀਨੀ 5 ਕਿਲੋ', false, {});
  console.log(`Input: "ਚੀਨੀ 5 ਕਿਲੋ" -> Suggestion: "${res3}"`);
  if (res3 !== 'Sugar 5kg') {
    throw new Error(`Test Case 3 failed: Expected "Sugar 5kg", got "${res3}"`);
  }
  console.log('✅ Test Case 3 Passed');

  // Test Case 4: Multi-industry term translation
  console.log('\n--- Test Case 4: Multi-Industry Translation ---');
  const res4 = translatePhrase('Mustard Oil 2L', true, {});
  console.log(`Input: "Mustard Oil 2L" -> Suggestion: "${res4}"`);
  if (res4 !== 'ਸਰੋਂ ਦਾ ਤੇਲ 2 ਲੀਟਰ') {
    throw new Error(`Test Case 4 failed: Expected "ਸਰੋਂ ਦਾ ਤੇਲ 2 ਲੀਟਰ", got "${res4}"`);
  }
  console.log('✅ Test Case 4 Passed');

  // Test Case 5: No suggestion / Unknown product (Priority 3)
  console.log('\n--- Test Case 5: Unknown Translation ---');
  const res5 = translatePhrase('Special Magic Product', true, {});
  console.log(`Input: "Special Magic Product" -> Suggestion: "${res5}"`);
  if (res5 !== null) {
    throw new Error(`Test Case 5 failed: Expected null, got "${res5}"`);
  }
  console.log('✅ Test Case 5 Passed');

  console.log('\n🎉 ALL BILINGUAL TRANSLATION VERIFICATION TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Tests failed:', err);
  process.exit(1);
});
