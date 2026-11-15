import assert from 'node:assert/strict';
import test from 'node:test';
import {english} from '../../assets/viewer/messages-en.mjs';

test('interface language defaults to Chinese, remembers a choice and respects a URL override', async () => {
  const defaultLocale = await import('../../assets/viewer/i18n.mjs');
  assert.equal(defaultLocale.language, 'zh-CN');
  assert.equal(defaultLocale.t('动作库'), '动作库');

  const key = defaultLocale.LANGUAGE_KEY;
  const storage = new Map();
  const priorWindow = globalThis.window;
  try {
    globalThis.window = {
      location: new URL('http://localhost/?asset=robot&lang=en'),
      localStorage: {getItem: name => storage.get(name), setItem: (name, value) => storage.set(name, value)},
    };
    const selected = await import('../../assets/viewer/i18n.mjs?selected');
    assert.equal(selected.language, 'en');
    assert.equal(selected.t('动作库'), 'Motion Library');
    assert.equal(selected.t('本次将随任务提交 {0} 条标记。', 2), 'Feedback markers to submit: 2');
    assert.equal(selected.t('请求失败（{0}）', '文件 {0}.fbx'), 'Request failed (文件 {0}.fbx)');
    assert.equal(selected.t('未知的外部日志'), '未知的外部日志');
    assert.equal(selected.rememberLanguage('xx'), false);
    assert.equal(selected.rememberLanguage('en'), true);
    assert.equal(storage.get(key), 'en');
    assert.equal(selected.localizedUrl('?asset=shotgun').search, '?asset=shotgun&lang=en');

    window.location = new URL('http://localhost/');
    const reopened = await import('../../assets/viewer/i18n.mjs?reopened');
    assert.equal(reopened.language, 'en');
    window.location.searchParams.set('lang', 'zh-CN');
    const overridden = await import('../../assets/viewer/i18n.mjs?override');
    assert.equal(overridden.language, 'zh-CN');
    assert.equal(storage.get(key), 'zh-CN');
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

test('translated templates preserve all interpolation fields', () => {
  const fields = value => [...new Set(value.match(/\{\d+\}/g))].sort();
  for (const [source, translation] of Object.entries(english)) {
    assert.deepEqual(fields(translation), fields(source), source);
  }
});
