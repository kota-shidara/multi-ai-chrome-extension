// ポップアップが開かれた直後にテキストエリアにフォーカスを当てる
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('promptInput');
  if (input) {
    // 保存済みテキストを復元してフォーカス
    const saved = localStorage.getItem('promptText');
    if (saved) {
      input.value = saved;
    }
    input.focus();

    // テキスト変更時に保存
    input.addEventListener('input', () => {
      localStorage.setItem('promptText', input.value);
    });

    // Enterで送信、Shift+Enterで改行の処理を追加
    input.addEventListener('keydown', (e) => {
      // Enterキーが押され、かつShiftキーが押されておらず、IME変換中でない場合
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault(); // 改行されるのを防ぐ
        document.getElementById('searchBtn').click(); // 送信ボタンをクリック
      }
    });
  }
});

document.getElementById('searchBtn').addEventListener('click', async () => {
  const inputElement = document.getElementById('promptInput');
  const promptText = inputElement.value;
  // チェックボックスの状態を取得
  const isNewChat = document.getElementById('newChatCheckbox').checked;

  if (!promptText) return;

  // 送信処理開始時に入力欄とストレージをクリア
  inputElement.value = '';
  localStorage.removeItem('promptText');

  // 既存のGeminiタブを探して実行 (テキストとフラグを渡す)
  await findAndExecute('https://gemini.google.com/*', [promptText, isNewChat], injectGeminiScript);

  // 既存のChatGPTタブを探して実行 (テキストとフラグを渡す)
  await findAndExecute('https://chatgpt.com/*', [promptText, isNewChat], injectChatGPTScript);

  // 既存のClaudeタブを探して実行 (テキストとフラグを渡す)
  await findAndExecute('https://claude.ai/*', [promptText, isNewChat], injectClaudeScript);
});

// 既存のタブを検索してスクリプトを実行するヘルパー関数
async function findAndExecute(urlPattern, args, scriptFunc) {
  // URLパターンに一致するタブを検索
  const tabs = await chrome.tabs.query({ url: urlPattern });

  if (tabs.length > 0) {
    // 最初に見つかったタブを使用
    const tabId = tabs[0].id;

    // スクリプトをページのメインワールドで実行（フレームワークとの連携に必要）
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: scriptFunc,
      args: args, // 配列として引数を渡す [text, isNewChat]
      world: 'MAIN'
    });
  } else {
    console.log(`Tab not found for: ${urlPattern}`);
  }
}

// Gemini用の注入スクリプト
function injectGeminiScript(text, isNewChat) {
  // 要素が見つかるまで待機する関数（タイムアウト時はnullを返す）
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  // 1. 新規チャットが必要な場合のみショートカットを実行
  if (isNewChat) {
    console.log('Dispatching Cmd+Shift+O for Gemini');
    const shortcutEvent = new KeyboardEvent('keydown', {
      key: 'o',
      code: 'KeyO',
      keyCode: 79,
      which: 79,
      shiftKey: true,
      metaKey: true,
      bubbles: true,
      cancelable: true,
      view: window
    });
    document.body.dispatchEvent(shortcutEvent);
  }

  // 2. 入力処理（waitForElementで要素出現を待つ）
  (async () => {
    // 新規チャット時は画面遷移開始を待つ短い遅延の後、要素を待機
    if (isNewChat) {
      await new Promise(r => setTimeout(r, 500));
    }

    // Quillエディタのコンテナを待機
    const container = await waitForElement('.ql-container');
    if (!container) return;

    // Quill APIで直接テキストを設定（'user'ソースでAngularに認識させる）
    const quill = container.__quill;
    if (!quill) return;

    quill.focus();
    quill.setText(text + '\n', 'user');

    // 送信ボタンコンテナがAngularにより非表示のままになるため強制表示
    const sendContainer = document.querySelector('.send-button-container');
    if (sendContainer) {
      sendContainer.style.setProperty('display', 'flex', 'important');
      sendContainer.style.setProperty('opacity', '1', 'important');
    }

    // 送信ボタンをクリック
    await new Promise(r => setTimeout(r, 200));
    const sendBtn = document.querySelector('button[aria-label="プロンプトを送信"]')
      || document.querySelector('button[aria-label="Send"]');
    if (sendBtn) {
      sendBtn.click();
    }
  })();
}

// ChatGPT用の注入スクリプト
function injectChatGPTScript(text, isNewChat) {
  // 要素が見つかるまで待機する関数（タイムアウト時はnullを返す）
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  // 送信ボタンが有効になるまで待機してクリック
  function waitAndClickSendButton(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const tryClick = () => {
        const btn = document.querySelector(selector);
        if (btn && !btn.disabled) { btn.click(); resolve(true); return true; }
        return false;
      };
      if (tryClick()) return;
      const interval = setInterval(() => {
        if (tryClick()) clearInterval(interval);
      }, 200);
      setTimeout(() => { clearInterval(interval); resolve(false); }, timeout);
    });
  }

  // 1. 新規チャットが必要な場合のみショートカットを実行
  if (isNewChat) {
    console.log('Dispatching Cmd+Shift+O for ChatGPT');
    const shortcutEvent = new KeyboardEvent('keydown', {
      key: 'o',
      code: 'KeyO',
      keyCode: 79,
      which: 79,
      shiftKey: true,
      metaKey: true,
      bubbles: true,
      cancelable: true,
      view: window
    });
    document.dispatchEvent(shortcutEvent);
  }

  // 2. 入力処理（waitForElementで要素出現を待つ）
  (async () => {
    const inputSelector = '#prompt-textarea';

    // 新規チャット時は画面遷移開始を待つ短い遅延の後、要素を待機
    if (isNewChat) {
      await new Promise(r => setTimeout(r, 500));
    }

    const inputElement = await waitForElement(inputSelector);
    if (!inputElement) return;

    inputElement.focus();
    inputElement.innerHTML = `<p>${text}</p>`;

    // Reactの状態更新をトリガーするためにinputイベントを発火
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));

    // 送信ボタンが有効になるまで待機してクリック
    await waitAndClickSendButton('button[data-testid="send-button"]');
  })();
}

// Claude用の注入スクリプト
function injectClaudeScript(text, isNewChat) {
  // 要素が見つかるまで待機する関数（タイムアウト時はnullを返す）
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  // 送信ボタンが有効になるまで待機してクリック
  function waitAndClickSendButton(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const tryClick = () => {
        const btn = document.querySelector(selector);
        if (btn && !btn.disabled) { btn.click(); resolve(true); return true; }
        return false;
      };
      if (tryClick()) return;
      const interval = setInterval(() => {
        if (tryClick()) clearInterval(interval);
      }, 200);
      setTimeout(() => { clearInterval(interval); resolve(false); }, timeout);
    });
  }

  // 1. 新規チャットが必要な場合はサイドバーのリンクをクリック (SPA遷移)
  if (isNewChat) {
    console.log('Clicking new chat link for Claude');
    const newChatLink = document.querySelector('a[aria-label="新規チャット"]')
      || document.querySelector('a[aria-label="New chat"]');
    if (newChatLink) {
      newChatLink.click();
    }
  }

  // 2. 入力処理（waitForElementで要素出現を待つ）
  (async () => {
    const inputSelector = 'div.ProseMirror[contenteditable="true"]';

    // 新規チャット時はSPA遷移開始を待つ短い遅延の後、要素を待機
    if (isNewChat) {
      await new Promise(r => setTimeout(r, 500));
    }

    const inputElement = await waitForElement(inputSelector);
    if (!inputElement) return;

    inputElement.focus();
    inputElement.innerHTML = `<p>${text}</p>`;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));

    // 送信ボタンが有効になるまで待機してクリック (日本語・英語両対応)
    const sendButtonSelector = 'button[aria-label="メッセージを送信"], button[aria-label="Send Message"]';
    await waitAndClickSendButton(sendButtonSelector);
  })();
}