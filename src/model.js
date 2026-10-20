/* CV Builder - TekiDeki
 * SPDX-License-Identifier: Apache-2.0
 *
 * The parts that can be tested without a browser: month names, date ranges,
 * turning a block of text into bullets, and the shape of a blank CV. No DOM,
 * no storage, no page.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CVModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Short months, the way a CV writes them. Serbian and Romanian use a dot
     after the abbreviation because that is how they are written at home. */
  var MONTHS = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ro: ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'],
    'sr-latn': ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun', 'jul', 'avg.', 'sep.', 'okt.', 'nov.', 'dec.'],
    'sr-cyrl': ['јан.', 'феб.', 'мар.', 'апр.', 'мај', 'јун', 'јул', 'авг.', 'сеп.', 'окт.', 'нов.', 'дец.']
  };

  /* The year goes before the month, which is the British and Balkan habit,
     and the only order that needs no comma. */
  function fmtMonth(value, lang) {
    if (!value) return '';
    var match = /^(\d{4})-(\d{2})$/.exec(String(value).trim());
    if (!match) return String(value);
    var table = MONTHS[lang] || MONTHS.en;
    var month = table[+match[2] - 1];
    if (!month) return match[1];
    return month + ' ' + match[1];
  }

  /* A range with a plain hyphen. An en dash would look nicer and is banned
     by the build, so the hyphen is the house style everywhere. */
  function range(from, to, present, lang, presentWord) {
    var start = fmtMonth(from, lang);
    var end = present ? (presentWord || 'Present') : fmtMonth(to, lang);
    if (start && end) return start + ' - ' + end;
    return start || end || '';
  }

  /* One bullet per line, leading dashes and bullets removed, empty lines
     dropped. People paste lists from everywhere. */
  function bullets(text) {
    return String(text || '')
      .split('\n')
      .map(function (line) { return line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim(); })
      .filter(function (line) { return line.length > 0; });
  }

  function skills(text) {
    return String(text || '')
      .split(',')
      .map(function (item) { return item.trim(); })
      .filter(function (item) { return item.length > 0; });
  }

  function blank() {
    return {
      person: { name: '', title: '', email: '', phone: '', city: '', web: '', summary: '', photo: '' },
      experience: [],
      education: [],
      skills: '',
      languages: [],
      certs: [],
      options: { template: 'classic', doclang: 'en', page: 'a4', font: 'sans', accent: '#2f5d8a' }
    };
  }

  /* A demo is worth more than an empty page, but it has to be obviously a
     demo: nothing here belongs to a real person. */
  function sample() {
    return {
      person: {
        name: 'Ana Petrović',
        title: 'Product designer',
        email: 'ana@example.com',
        phone: '+381 60 123 4567',
        city: 'Vršac, Serbia',
        web: 'linkedin.com/in/ana',
        summary: 'Product designer with six years in e-commerce, mostly on checkout and account flows. I work close to engineering, write the copy that ships with the screen, and leave a design system behind instead of a folder of mockups.',
        photo: ''
      },
      experience: [
        {
          role: 'Senior product designer',
          company: 'Riverside Commerce',
          place: 'Belgrade',
          from: '2022-03',
          to: '',
          present: true,
          text: 'Rebuilt the checkout from three steps to one, which lifted completed orders by 11 percent.\nStarted a component library now used by four product teams.\nRan the first usability sessions with older customers, which rewrote the whole payment screen.'
        },
        {
          role: 'Product designer',
          company: 'Studio Korak',
          place: 'Novi Sad',
          from: '2019-06',
          to: '2022-02',
          present: false,
          text: 'Designed the booking flow for a dental chain, from paper forms to a phone app.\nWrote the design briefs that clients signed, which ended most of the redraws.'
        }
      ],
      education: [
        { school: 'University of Novi Sad', degree: 'BA, Graphic design', place: 'Novi Sad', from: '2015-10', to: '2019-06', note: '' }
      ],
      skills: 'Figma, design systems, prototyping, HTML and CSS, copywriting, usability testing',
      languages: [
        { name: 'Serbian', level: 'native' },
        { name: 'English', level: 'fluent' },
        { name: 'German', level: 'good' }
      ],
      certs: [{ name: 'Google UX Design', year: '2021' }],
      options: { template: 'classic', doclang: 'en', page: 'a4', font: 'sans', accent: '#2f5d8a' }
    };
  }

  /* Anything read from a file or from storage goes through here, so a broken
     or older copy cannot crash the page. */
  function normalize(raw) {
    var base = blank();
    if (!raw || typeof raw !== 'object') return base;
    var person = raw.person && typeof raw.person === 'object' ? raw.person : {};
    Object.keys(base.person).forEach(function (key) {
      var value = person[key];
      base.person[key] = (typeof value === 'string' || typeof value === 'number') ? String(value) : '';
    });
    base.experience = Array.isArray(raw.experience) ? raw.experience.map(function (item) {
      return {
        role: String(item && item.role || ''),
        company: String(item && item.company || ''),
        place: String(item && item.place || ''),
        from: String(item && item.from || ''),
        to: String(item && item.to || ''),
        present: !!(item && item.present),
        text: String(item && item.text || '')
      };
    }) : [];
    base.education = Array.isArray(raw.education) ? raw.education.map(function (item) {
      return {
        school: String(item && item.school || ''),
        degree: String(item && item.degree || ''),
        place: String(item && item.place || ''),
        from: String(item && item.from || ''),
        to: String(item && item.to || ''),
        note: String(item && item.note || '')
      };
    }) : [];
    base.skills = typeof raw.skills === 'string' ? raw.skills : '';
    base.languages = Array.isArray(raw.languages) ? raw.languages.map(function (item) {
      return { name: String(item && item.name || ''), level: String(item && item.level || 'good') };
    }) : [];
    base.certs = Array.isArray(raw.certs) ? raw.certs.map(function (item) {
      return { name: String(item && item.name || ''), year: String(item && item.year || '') };
    }) : [];
    var options = raw.options && typeof raw.options === 'object' ? raw.options : {};
    var allowed = { template: ['classic', 'column', 'banner'], doclang: ['en', 'ro', 'sr-latn', 'sr-cyrl'],
                    page: ['a4', 'letter'], font: ['sans', 'serif'] };
    Object.keys(allowed).forEach(function (key) {
      base.options[key] = allowed[key].indexOf(options[key]) >= 0 ? options[key] : base.options[key];
    });
    base.options.accent = /^#[0-9a-f]{6}$/i.test(options.accent || '') ? options.accent : base.options.accent;
    return base;
  }

  return {
    MONTHS: MONTHS,
    fmtMonth: fmtMonth,
    range: range,
    bullets: bullets,
    skills: skills,
    blank: blank,
    sample: sample,
    normalize: normalize
  };
}));
