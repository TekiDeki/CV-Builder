/* CV Builder - TekiDeki
 * SPDX-License-Identifier: Apache-2.0
 *
 * The editor: reads the form, keeps one object in localStorage, and draws that
 * object as the page you are about to print. The page is the only truth: the
 * preview, the print and the saved copy all come from the same object.
 */
(function () {
  'use strict';

  var M = window.CVModel;
  var LOCALES = window.TD_LOCALES || { en: {} };
  var DOC = window.TD_DOC || { en: {} };
  var STORE = 'cv-builder.data';
  var lang = 'en';

  /* ------------------------------------------------------------- language */

  function t(key, vars) {
    var table = LOCALES[lang] || LOCALES.en || {};
    var value = table[key] || (LOCALES.en || {})[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        value = value.replace('{' + name + '}', String(vars[name]));
      });
    }
    return value;
  }

  function docT(key) {
    var table = DOC[state.options.doclang] || DOC.en || {};
    return table[key] || (DOC.en || {})[key] || key;
  }

  /* ---------------------------------------------------------------- state */

  function readStore() {
    try {
      var raw = localStorage.getItem(STORE);
      return raw ? M.normalize(JSON.parse(raw)) : M.blank();
    } catch (error) {
      return M.blank();
    }
  }

  var state = readStore();
  var paper = document.getElementById('paper');
  var stage = document.getElementById('stage');
  var pagesEl = document.getElementById('pages');

  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (error) { /* full or private */ }
  }

  /* --------------------------------------------------------------- escape */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------------------------------------------------------------- paper */

  function contactLines() {
    var p = state.person;
    return [p.email, p.phone, p.city, p.web]
      .filter(function (line) { return line.trim(); })
      .map(function (line) { return '<span>' + esc(line) + '</span>'; })
      .join('');
  }

  function headBlock() {
    var p = state.person;
    var name = p.name.trim() || t('emptyDoc');
    return '<div class="doc-head"><div>' +
      '<h1 class="doc-name">' + esc(name) + '</h1>' +
      (p.title.trim() ? '<p class="doc-role">' + esc(p.title) + '</p>' : '') +
      '</div>' + (contactLines() ? '<div class="doc-contact">' + contactLines() + '</div>' : '') +
      '</div>';
  }

  function summaryBlock() {
    var text = state.person.summary.trim();
    if (!text) return '';
    return section(docT('summary'), '<p class="doc-para">' + esc(text).replace(/\n/g, '<br>') + '</p>');
  }

  function section(title, body, extra) {
    if (!body) return '';
    return '<section class="sec"><h2 class="sec-h' + (extra || '') + '">' + esc(title) + '</h2>' + body + '</section>';
  }

  function experienceBlock() {
    var rows = state.experience.filter(function (item) {
      return item.role.trim() || item.company.trim() || item.text.trim();
    }).map(function (item) {
      var when = M.range(item.from, item.to, item.present, state.options.doclang, docT('present'));
      var sub = [item.company, item.place].filter(function (part) { return part.trim(); }).join(', ');
      var list = M.bullets(item.text);
      return '<div class="entry-doc">' +
        '<div class="entry-line"><span class="entry-role">' + esc(item.role) + '</span>' +
        (when ? '<span class="entry-when">' + esc(when) + '</span>' : '') + '</div>' +
        (sub ? '<div class="entry-sub">' + esc(sub) + '</div>' : '') +
        (list.length ? '<ul class="doc-list">' + list.map(function (line) {
          return '<li>' + esc(line) + '</li>';
        }).join('') + '</ul>' : '') +
        '</div>';
    }).join('');
    return section(docT('experience'), rows);
  }

  function educationBlock() {
    var rows = state.education.filter(function (item) {
      return item.school.trim() || item.degree.trim();
    }).map(function (item) {
      var when = M.range(item.from, item.to, false, state.options.doclang);
      var sub = [item.degree, item.place].filter(function (part) { return part.trim(); }).join(', ');
      return '<div class="entry-doc">' +
        '<div class="entry-line"><span class="entry-role">' + esc(item.school) + '</span>' +
        (when ? '<span class="entry-when">' + esc(when) + '</span>' : '') + '</div>' +
        (sub ? '<div class="entry-sub">' + esc(sub) + '</div>' : '') +
        (item.note.trim() ? '<div class="entry-place">' + esc(item.note) + '</div>' : '') +
        '</div>';
    }).join('');
    return section(docT('education'), rows);
  }

  function skillsBlock() {
    var items = M.skills(state.skills);
    if (!items.length) return '';
    return section(docT('skills'), '<div class="chips">' + items.map(function (item) {
      return '<span>' + esc(item) + '</span>';
    }).join('') + '</div>');
  }

  function languagesBlock() {
    var items = state.languages.filter(function (item) { return item.name.trim(); });
    if (!items.length) return '';
    return section(docT('languages'), '<ul class="doc-list" style="padding-left:0;list-style:none">' + items.map(function (item) {
      return '<li>' + esc(item.name) + ' <span style="color:#5b6877">(' + esc(docT(item.level)) + ')</span></li>';
    }).join('') + '</ul>');
  }

  function certsBlock() {
    var items = state.certs.filter(function (item) { return item.name.trim(); });
    if (!items.length) return '';
    return section(docT('certifications'), '<ul class="doc-list" style="padding-left:0;list-style:none">' + items.map(function (item) {
      return '<li>' + esc(item.name) + (item.year.trim() ? ', ' + esc(item.year) : '') + '</li>';
    }).join('') + '</ul>');
  }

  function photoTag(className) {
    if (!state.person.photo) return '';
    return '<img class="doc-photo ' + (className || '') + '" src="' + state.person.photo + '" alt="">';
  }

  function renderPaper() {
    var options = state.options;
    paper.className = 'paper tpl-' + options.template + ' ' + options.font;
    paper.style.setProperty('--acc', options.accent);

    var html;
    if (options.template === 'column') {
      html = '<div class="doc-body">' +
        '<header class="doc-head"><div>' +
        '<h1 class="doc-name">' + esc(state.person.name.trim() || t('emptyDoc')) + '</h1>' +
        (state.person.title.trim() ? '<p class="doc-role">' + esc(state.person.title) + '</p>' : '') +
        '</div></header>' +
        '<aside class="side">' +
        photoTag() +
        (contactLines() ? '<section class="sec"><h2 class="sec-h acc">' + esc(t('contactLabel')) + '</h2><div class="entry-place">' + contactLines().replace(/<span>/g, '<span style="display:block">') + '</div></section>' : '') +
        skillsBlock() + languagesBlock() + certsBlock() +
        '</aside>' +
        '<div class="main">' + summaryBlock() + experienceBlock() + educationBlock() + '</div>' +
        '</div>';
    } else if (options.template === 'banner') {
      html = '<div class="band">' + photoTag() +
        '<div style="flex:1"><h1 class="doc-name">' + esc(state.person.name.trim() || t('emptyDoc')) + '</h1>' +
        (state.person.title.trim() ? '<p class="doc-role">' + esc(state.person.title) + '</p>' : '') + '</div>' +
        (contactLines() ? '<div class="doc-contact">' + contactLines() + '</div>' : '') +
        '</div>' + summaryBlock() + experienceBlock() + educationBlock() +
        skillsBlock() + languagesBlock() + certsBlock();
    } else {
      html = headBlock() + summaryBlock() + experienceBlock() + educationBlock() +
        skillsBlock() + languagesBlock() + certsBlock();
    }

    paper.innerHTML = html;
    document.getElementById('p-photo-clear').disabled = !state.person.photo;
    updatePages();
    fit();
  }

  function pageHeightPx() {
    var mm = state.options.page === 'letter' ? 279 : 297;
    return Math.round(mm * 96 / 25.4);
  }

  function updatePages() {
    var ratio = paper.scrollHeight / pageHeightPx();
    var count = Math.max(1, Math.ceil(ratio - 0.01));
    pagesEl.textContent = count === 1 ? t('pagesOne') : t('pagesMany', { n: count });
  }

  function fit() {
    var width = paper.offsetWidth;
    if (!width) return;
    var scale = Math.min(1, (stage.clientWidth - 2) / width);
    paper.style.transform = 'scale(' + scale + ')';
    stage.style.height = Math.round(paper.offsetHeight * scale) + 'px';
  }

  /* -------------------------------------------------------------- editors */

  function field(label, inner) {
    return '<label class="field"><span>' + esc(label) + '</span>' + inner + '</label>';
  }

  function monthInput(index, key, value, list) {
    return '<input type="month" data-list="' + list + '" data-index="' + index + '" data-field="' + key +
      '" value="' + esc(value) + '">';
  }

  function textInput(index, key, value, list, placeholder) {
    return '<input type="text" data-list="' + list + '" data-index="' + index + '" data-field="' + key +
      '" value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '">';
  }

  function entryShell(title, index, list, body) {
    return '<div class="entry"><div class="entry-top"><span class="entry-n">' + esc(title) +
      '</span><button class="btn small danger" type="button" data-remove="' + list + '" data-index="' + index +
      '">' + esc(t('remove')) + '</button></div>' + body + '</div>';
  }

  function renderExperience() {
    document.getElementById('exp-list').innerHTML = state.experience.length
      ? state.experience.map(function (item, index) {
        var body = '<div class="row3">' +
          field(t('roleLabel'), textInput(index, 'role', item.role, 'experience')) +
          field(t('companyLabel'), textInput(index, 'company', item.company, 'experience')) +
          field(t('placeLabel'), textInput(index, 'place', item.place, 'experience')) +
          field(t('fromLabel'), monthInput(index, 'from', item.from, 'experience')) +
          field(t('toLabel'), monthInput(index, 'to', item.to, 'experience')) +
          '</div>' +
          '<label class="checkline"><input type="checkbox" data-list="experience" data-index="' + index +
          '" data-field="present"' + (item.present ? ' checked' : '') + '> ' + esc(t('present')) + '</label>' +
          '<div class="row3"><label class="field wide"><span>' + esc(t('bulletsLabel')) + '</span>' +
          '<textarea rows="3" data-list="experience" data-index="' + index + '" data-field="text">' +
          esc(item.text) + '</textarea></label></div>';
        return entryShell(t('jobN', { n: index + 1 }), index, 'experience', body);
      }).join('')
      : '<p class="hint">' + esc(t('addJob')) + '</p>';
  }

  function renderEducation() {
    document.getElementById('edu-list').innerHTML = state.education.length
      ? state.education.map(function (item, index) {
        var body = '<div class="row3">' +
          field(t('schoolLabel'), textInput(index, 'school', item.school, 'education')) +
          field(t('degreeLabel'), textInput(index, 'degree', item.degree, 'education')) +
          field(t('placeLabel'), textInput(index, 'place', item.place, 'education')) +
          field(t('fromLabel'), monthInput(index, 'from', item.from, 'education')) +
          field(t('toLabel'), monthInput(index, 'to', item.to, 'education')) +
          '</div>' +
          '<div class="row3"><label class="field wide"><span>' + esc(t('noteLabel')) + '</span>' +
          '<input type="text" data-list="education" data-index="' + index + '" data-field="note" value="' +
          esc(item.note) + '"></label></div>';
        return entryShell(t('schoolN', { n: index + 1 }), index, 'education', body);
      }).join('')
      : '<p class="hint">' + esc(t('addEdu')) + '</p>';
  }

  function renderLanguages() {
    document.getElementById('lang-list').innerHTML = state.languages.length
      ? state.languages.map(function (item, index) {
        var levels = ['native', 'fluent', 'good', 'basic'].map(function (level) {
          return '<option value="' + level + '"' + (item.level === level ? ' selected' : '') + '>' +
            esc(docT(level)) + '</option>';
        }).join('');
        var body = '<div class="row3">' +
          field(t('nameLabel'), textInput(index, 'name', item.name, 'languages')) +
          '<label class="field"><span>' + esc(t('levelLabel')) + '</span>' +
          '<select data-list="languages" data-index="' + index + '" data-field="level">' + levels + '</select></label>' +
          '</div>';
        return entryShell(t('languageN', { n: index + 1 }), index, 'languages', body);
      }).join('')
      : '<p class="hint">' + esc(t('addLang')) + '</p>';
  }

  function renderCerts() {
    document.getElementById('cert-list').innerHTML = state.certs.length
      ? state.certs.map(function (item, index) {
        var body = '<div class="row3">' +
          field(t('certTitle'), textInput(index, 'name', item.name, 'certs')) +
          field(t('yearLabel'), textInput(index, 'year', item.year, 'certs')) +
          '</div>';
        return entryShell(t('certN', { n: index + 1 }), index, 'certs', body);
      }).join('')
      : '<p class="hint">' + esc(t('addCert')) + '</p>';
  }

  function renderLists() {
    renderExperience();
    renderEducation();
    renderLanguages();
    renderCerts();
  }

  /* --------------------------------------------------------------- inputs */

  function syncStatic() {
    var p = state.person;
    setValue('p-name', p.name);
    setValue('p-title', p.title);
    setValue('p-email', p.email);
    setValue('p-phone', p.phone);
    setValue('p-city', p.city);
    setValue('p-web', p.web);
    setValue('p-summary', p.summary);
    setValue('p-skills', state.skills);
    setValue('o-template', state.options.template);
    setValue('o-doclang', state.options.doclang);
    setValue('o-page', state.options.page);
    setValue('o-font', state.options.font);
    document.querySelectorAll('.swatch').forEach(function (button) {
      button.classList.toggle('on', button.getAttribute('data-accent') === state.options.accent);
    });
    applyPageSize();
  }

  function setValue(id, value) {
    var element = document.getElementById(id);
    if (element) element.value = value;
  }

  var PERSON_FIELDS = {
    'p-name': 'name', 'p-title': 'title', 'p-email': 'email', 'p-phone': 'phone',
    'p-city': 'city', 'p-web': 'web', 'p-summary': 'summary'
  };

  Object.keys(PERSON_FIELDS).forEach(function (id) {
    document.getElementById(id).addEventListener('input', function (event) {
      state.person[PERSON_FIELDS[id]] = event.target.value;
      renderPaper();
      persist();
    });
  });

  document.getElementById('p-skills').addEventListener('input', function (event) {
    state.skills = event.target.value;
    renderPaper();
    persist();
  });

  /* one listener for every generated field, so adding rows never rebinds */
  function onGenerated(event) {
    var target = event.target;
    var list = target.getAttribute('data-list');
    if (!list) return;
    var index = +target.getAttribute('data-index');
    var fieldName = target.getAttribute('data-field');
    var item = state[list] && state[list][index];
    if (!item) return;
    item[fieldName] = target.type === 'checkbox' ? target.checked : target.value;
    if (fieldName === 'present' && target.checked) {
      item.to = '';
      var toInput = document.querySelector('[data-list="' + list + '"][data-index="' + index + '"][data-field="to"]');
      if (toInput) toInput.value = '';
    }
    renderPaper();
    persist();
  }

  ['exp-list', 'edu-list', 'lang-list', 'cert-list'].forEach(function (id) {
    var node = document.getElementById(id);
    node.addEventListener('input', onGenerated);
    node.addEventListener('change', onGenerated);
    node.addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove]');
      if (!button) return;
      var list = button.getAttribute('data-remove');
      state[list].splice(+button.getAttribute('data-index'), 1);
      renderLists();
      renderPaper();
      persist();
    });
  });

  document.getElementById('add-exp').addEventListener('click', function () {
    state.experience.push({ role: '', company: '', place: '', from: '', to: '', present: true, text: '' });
    renderExperience(); renderPaper(); persist();
  });
  document.getElementById('add-edu').addEventListener('click', function () {
    state.education.push({ school: '', degree: '', place: '', from: '', to: '', note: '' });
    renderEducation(); renderPaper(); persist();
  });
  document.getElementById('add-lang').addEventListener('click', function () {
    state.languages.push({ name: '', level: 'good' });
    renderLanguages(); renderPaper(); persist();
  });
  document.getElementById('add-cert').addEventListener('click', function () {
    state.certs.push({ name: '', year: '' });
    renderCerts(); renderPaper(); persist();
  });

  /* -------------------------------------------------------------- options */

  document.getElementById('o-template').addEventListener('change', function (event) {
    state.options.template = event.target.value;
    renderPaper(); persist();
  });
  document.getElementById('o-doclang').addEventListener('change', function (event) {
    state.options.doclang = event.target.value;
    renderLanguages(); renderPaper(); persist();
  });
  document.getElementById('o-font').addEventListener('change', function (event) {
    state.options.font = event.target.value;
    renderPaper(); persist();
  });
  document.getElementById('o-page').addEventListener('change', function (event) {
    state.options.page = event.target.value;
    applyPageSize(); renderPaper(); persist();
  });

  function applyPageSize() {
    var letter = state.options.page === 'letter';
    var root = document.documentElement.style;
    root.setProperty('--paper-w', letter ? '216mm' : '210mm');
    root.setProperty('--paper-h', letter ? '279mm' : '297mm');
    document.getElementById('pageCss').textContent =
      '@page{size:' + (letter ? 'Letter' : 'A4') + ';margin:0}';
  }

  document.querySelectorAll('.swatch').forEach(function (button) {
    button.addEventListener('click', function () {
      state.options.accent = button.getAttribute('data-accent');
      document.querySelectorAll('.swatch').forEach(function (other) {
        other.classList.toggle('on', other === button);
      });
      renderPaper(); persist();
    });
  });

  /* ---------------------------------------------------------------- photo */

  document.getElementById('p-photo').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { alert(t('photoBig')); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        // The stored copy is small on purpose: a CV photo is 300 by 380 pixels
        // on paper at most, and localStorage is not a photo album.
        var max = 420;
        var scale = Math.min(1, max / Math.max(image.width, image.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        state.person.photo = canvas.toDataURL('image/jpeg', 0.85);
        renderPaper(); persist();
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('p-photo-clear').addEventListener('click', function () {
    state.person.photo = '';
    document.getElementById('p-photo').value = '';
    renderPaper(); persist();
  });

  /* ------------------------------------------------------------ save/load */

  function slug(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  document.getElementById('btn-json').addEventListener('click', function () {
    var body = JSON.stringify(state, null, 2);
    var blob = new Blob([body], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'cv-' + (slug(state.person.name) || 'copy') + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });

  document.getElementById('import-json').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object' || !('person' in parsed)) throw new Error('shape');
        state = M.normalize(parsed);
        syncStatic(); renderLists(); renderPaper(); persist();
      } catch (error) {
        alert(t('importBad'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  });

  document.getElementById('btn-clear').addEventListener('click', function () {
    if (!window.confirm(t('confirmClear'))) return;
    var options = state.options;
    state = M.blank();
    state.options = options;
    syncStatic(); renderLists(); renderPaper(); persist();
  });

  document.getElementById('btn-sample').addEventListener('click', function () {
    var options = state.options;
    state = M.sample();
    state.options = options;
    syncStatic(); renderLists(); renderPaper(); persist();
  });

  document.getElementById('btn-print').addEventListener('click', function () {
    window.print();
  });

  /* --------------------------------------------------------------- chrome */

  document.getElementById('theme').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cv-builder.theme', next); } catch (error) { /* ignore */ }
  });

  var LANG_NAMES = { en: 'EN', ro: 'RO', 'sr-latn': 'SR', 'sr-cyrl': 'SR ћир' };

  function applyLanguage(next, remember) {
    lang = LOCALES[next] ? next : 'en';
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (node) {
      node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (node) {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria-label')));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (node) {
      node.innerHTML = t(node.getAttribute('data-i18n-html'));
    });
    var select = document.getElementById('lang');
    select.innerHTML = Object.keys(LOCALES).map(function (code) {
      return '<option value="' + code + '"' + (code === lang ? ' selected' : '') + '>' +
        (LANG_NAMES[code] || code) + '</option>';
    }).join('');
    if (remember) { try { localStorage.setItem('cv-builder.lang', lang); } catch (error) { /* ignore */ } }
    renderLists();
    renderPaper();
  }

  document.getElementById('lang').addEventListener('change', function (event) {
    applyLanguage(event.target.value, true);
  });

  window.addEventListener('resize', fit);

  /* ------------------------------------------------------------------ boot */

  var saved = '';
  try { saved = localStorage.getItem('cv-builder.lang') || ''; } catch (error) { saved = ''; }
  if (!saved) {
    var guess = (navigator.language || 'en').toLowerCase();
    saved = guess.indexOf('ro') === 0 ? 'ro' : (guess.indexOf('sr') === 0 ? 'sr-latn' : 'en');
  }
  syncStatic();
  applyLanguage(saved, false);

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline is a bonus */ });
    });
  }
}());
