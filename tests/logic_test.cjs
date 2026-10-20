/* CV Builder - logic tests.
 * No browser: the model file is the same one the page loads.
 * Run: node tests/logic_test.cjs
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const M = require(path.join(__dirname, '..', 'src', 'model.js'));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error('FAIL: ' + name);
    console.error('  ' + error.message);
    process.exitCode = 1;
  }
}

/* ---------------------------------------------------------------- months */

test('a month is written year first, short name after', () => {
  assert.strictEqual(M.fmtMonth('2022-03', 'en'), 'Mar 2022');
  assert.strictEqual(M.fmtMonth('2019-06', 'en'), 'Jun 2019');
});

test('Romanian and Serbian months carry the dot they are written with', () => {
  assert.strictEqual(M.fmtMonth('2022-03', 'ro'), 'mar. 2022');
  assert.strictEqual(M.fmtMonth('2022-03', 'sr-latn'), 'mar. 2022');
  assert.strictEqual(M.fmtMonth('2022-03', 'sr-cyrl'), 'мар. 2022');
});

test('an empty or broken month is empty, never the word undefined', () => {
  assert.strictEqual(M.fmtMonth('', 'en'), '');
  assert.strictEqual(M.fmtMonth('nonsense', 'en'), 'nonsense');
  assert.strictEqual(M.fmtMonth('2022-13', 'en'), '2022');
});

/* ----------------------------------------------------------------- ranges */

test('a closed range uses a plain hyphen', () => {
  assert.strictEqual(M.range('2019-06', '2022-02', false, 'en'), 'Jun 2019 - Feb 2022');
});

test('a current job says Present, in the caller language when one is given', () => {
  assert.strictEqual(M.range('2022-03', '', true, 'en'), 'Mar 2022 - Present');
  assert.strictEqual(M.range('2022-03', '', true, 'ro', 'Prezent'), 'mar. 2022 - Prezent');
  assert.strictEqual(M.range('2022-03', '', true, 'sr-cyrl', 'Данас'), 'мар. 2022 - Данас');
});

test('half a range still prints, and a missing one prints nothing', () => {
  assert.strictEqual(M.range('2022-03', '', false, 'en'), 'Mar 2022');
  assert.strictEqual(M.range('', '2022-02', false, 'en'), 'Feb 2022');
  assert.strictEqual(M.range('', '', false, 'en'), '');
});

test('no en dash or em dash can come out of the date code', () => {
  const text = M.range('2019-06', '2022-02', false, 'en') + M.range('2022-03', '', true, 'en');
  assert.ok(!/[\u2013\u2014]/.test(text), text);
});

/* ---------------------------------------------------------------- bullets */

test('one line becomes one bullet, markers stripped', () => {
  assert.deepStrictEqual(M.bullets('Did a thing\n- Did another\n* Third'), ['Did a thing', 'Did another', 'Third']);
});

test('numbered lists, blank lines and spaces are cleaned out', () => {
  assert.deepStrictEqual(M.bullets('1. First\n\n  2) Second   \n'), ['First', 'Second']);
});

test('bullet characters people paste from Word are removed', () => {
  assert.deepStrictEqual(M.bullets('• one\n· two'), ['one', 'two']);
});

test('a hyphen inside a sentence is not a bullet marker', () => {
  assert.deepStrictEqual(M.bullets('a well-known brand'), ['a well-known brand']);
});

test('an empty text gives an empty list, not one empty bullet', () => {
  assert.deepStrictEqual(M.bullets(''), []);
  assert.deepStrictEqual(M.bullets('   \n\n '), []);
});

/* ----------------------------------------------------------------- skills */

test('skills split on commas and lose the empty pieces', () => {
  assert.deepStrictEqual(M.skills('Figma, , CSS ,'), ['Figma', 'CSS']);
});

/* ------------------------------------------------------------- normalize */

test('a blank CV has every field the page touches', () => {
  const blank = M.blank();
  ['name', 'title', 'email', 'phone', 'city', 'web', 'summary', 'photo'].forEach((key) => {
    assert.strictEqual(blank.person[key], '', key);
  });
  assert.deepStrictEqual(blank.experience, []);
  assert.strictEqual(blank.options.template, 'classic');
});

test('junk passed in gives a blank CV instead of an exception', () => {
  assert.deepStrictEqual(M.normalize(null), M.blank());
  assert.deepStrictEqual(M.normalize('nope'), M.blank());
  assert.deepStrictEqual(M.normalize({ person: 5 }), M.blank());
});

test('an unknown layout or paper falls back to the safe one', () => {
  const data = M.normalize({ options: { template: 'wild', page: 'a3', doclang: 'xx', font: 'comic', accent: 'red' } });
  assert.strictEqual(data.options.template, 'classic');
  assert.strictEqual(data.options.page, 'a4');
  assert.strictEqual(data.options.doclang, 'en');
  assert.strictEqual(data.options.font, 'sans');
  assert.strictEqual(data.options.accent, '#2f5d8a');
});

test('a real accent is kept', () => {
  assert.strictEqual(M.normalize({ options: { accent: '#1f6f5c' } }).options.accent, '#1f6f5c');
});

test('numbers where text is expected do not leak through', () => {
  const data = M.normalize({ person: { name: 42 }, experience: [{ role: 7 }] });
  assert.strictEqual(data.person.name, '42');
  assert.strictEqual(data.experience[0].role, '7');
});

test('a saved CV survives a round trip through JSON', () => {
  const sample = M.sample();
  const again = M.normalize(JSON.parse(JSON.stringify(sample)));
  assert.deepStrictEqual(again, sample);
});

test('the example is a full CV and mentions no real person', () => {
  const sample = M.sample();
  assert.ok(sample.person.name.includes('Ana'));
  assert.strictEqual(sample.experience.length, 2);
  assert.ok(sample.person.email.endsWith('example.com'));
});

/* -------------------------------------------------------------- strings */

const locales = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'locales.json'), 'utf8'));
const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'doc.json'), 'utf8'));

test('three authored locales with the same keys, interface and document', () => {
  [locales, doc].forEach((bundle) => {
    const keys = Object.keys(bundle.en).sort();
    ['ro', 'sr-latn'].forEach((locale) => {
      assert.deepStrictEqual(Object.keys(bundle[locale]).sort(), keys, locale);
    });
  });
});

test('no em dash, en dash or no-break space in any string', () => {
  [locales, doc].forEach((bundle) => {
    Object.keys(bundle).forEach((locale) => {
      Object.keys(bundle[locale]).forEach((key) => {
        assert.ok(!/[\u2013\u2014\u00a0]/.test(bundle[locale][key]), locale + '.' + key);
      });
    });
  });
});

test('placeholders agree between locales', () => {
  Object.keys(locales.en).forEach((key) => {
    const expected = (locales.en[key].match(/\{[a-z]+\}/gi) || []).sort();
    ['ro', 'sr-latn'].forEach((locale) => {
      const actual = (locales[locale][key].match(/\{[a-z]+\}/gi) || []).sort();
      assert.deepStrictEqual(actual, expected, key + ' in ' + locale);
    });
  });
});

if (!process.exitCode) console.log('PASS: ' + passed + ' logic checks, dates, bullets, storage shape and three locales');
