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

    // スクリプトを実行
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: scriptFunc,
      args: args // 配列として引数を渡す [text, isNewChat]
    });
  } else {
    console.log(`Tab not found for: ${urlPattern}`);
  }
}

// Gemini用の注入スクリプト
function injectGeminiScript(text, isNewChat) {
  // 1. 新規チャットが必要な場合のみショートカットを実行
  if (isNewChat) {
    console.log('Dispatching Cmd+Shift+O for Gemini');
    const shortcutEvent = new KeyboardEvent('keydown', {
      key: 'o',
      code: 'KeyO',
      keyCode: 79,
      which: 79,
      shiftKey: true,
      metaKey: true, // Command key (Mac)
      bubbles: true,
      cancelable: true,
      view: window
    });
    document.body.dispatchEvent(shortcutEvent);
  }

  // 要素が見つかるまで待機する関数
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          resolve(document.querySelector(selector));
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), timeout);
    });
  }

  // 2. 入力処理
  // 新規チャットの場合は画面遷移を待つため1秒待機、続きの場合は即時(100ms)
  const waitTime = isNewChat ? 1000 : 100;

  setTimeout(async () => {
    // Geminiの入力欄セレクタ
    const inputSelector = 'div[contenteditable="true"]';
    const inputElement = await waitForElement(inputSelector);

    if (inputElement) {
      inputElement.focus();
      // テキストを入力
      inputElement.innerHTML = `<p>${text}</p>`;

      // 入力イベントを発火
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));

      // 送信ボタンを探してクリック
      setTimeout(() => {
        const sendButtonSelector = 'button[aria-label="プロンプトを送信"], .send-button, button[aria-label="Send"]';
        const sendButton = document.querySelector(sendButtonSelector);
        if (sendButton) {
          sendButton.click();
        }
      }, 500); // 入力から送信までの待機
    }
  }, waitTime);
}

// ChatGPT用の注入スクリプト
function injectChatGPTScript(text, isNewChat) {
  // 1. 新規チャットが必要な場合のみショートカットを実行
  if (isNewChat) {
    console.log('Dispatching Cmd+Shift+O for ChatGPT');
    const shortcutEvent = new KeyboardEvent('keydown', {
      key: 'o',
      code: 'KeyO',
      keyCode: 79,
      which: 79,
      shiftKey: true,
      metaKey: true, // Command key (Mac)
      bubbles: true,
      cancelable: true,
      view: window
    });
    document.dispatchEvent(shortcutEvent);
  }

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          resolve(document.querySelector(selector));
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), timeout);
    });
  }

  // 2. 入力処理
  // 新規チャットの場合は画面遷移を待つため1秒待機、続きの場合は即時(100ms)
  const waitTime = isNewChat ? 1000 : 100;

  setTimeout(async () => {
    // ChatGPTの入力欄セレクタ
    const inputSelector = '#prompt-textarea';
    const inputElement = await waitForElement(inputSelector);

    if (inputElement) {
      inputElement.focus();
      inputElement.innerHTML = `<p>${text}</p>`;

      // Reactの状態更新をトリガーするためにinputイベントを発火
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));

      // 送信ボタン
      setTimeout(() => {
        const sendButtonSelector = 'button[data-testid="send-button"]';
        const sendButton = document.querySelector(sendButtonSelector);
        if (sendButton) {
          sendButton.click();
        }
      }, 800);
    }
  }, waitTime);
}

// Claude用の注入スクリプト
function injectClaudeScript(text, isNewChat) {
  // 1. 新規チャットが必要な場合はサイドバーのリンクをクリック (SPA遷移)
  if (isNewChat) {
    console.log('Clicking new chat link for Claude');
    const newChatLink = document.querySelector('a[aria-label="新規チャット"]')
      || document.querySelector('a[aria-label="New chat"]');
    if (newChatLink) {
      newChatLink.click();
    }
  }

  // 要素が見つかるまで待機する関数
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          resolve(document.querySelector(selector));
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), timeout);
    });
  }

  // 2. 入力処理
  // 新規チャットの場合はページ遷移を待つため2秒待機、続きの場合は即時(100ms)
  const waitTime = isNewChat ? 2000 : 100;

  setTimeout(async () => {
    // Claudeの入力欄セレクタ (tiptap ProseMirror エディタ)
    const inputSelector = 'div.ProseMirror[contenteditable="true"]';
    const inputElement = await waitForElement(inputSelector);

    if (inputElement) {
      inputElement.focus();
      // テキストを入力
      inputElement.innerHTML = `<p>${text}</p>`;

      // 入力イベントを発火
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));

      // 送信ボタンを探してクリック (日本語・英語両対応)
      setTimeout(() => {
        const sendButton = document.querySelector('button[aria-label="メッセージを送信"]')
          || document.querySelector('button[aria-label="Send Message"]');
        if (sendButton) {
          sendButton.click();
        }
      }, 500);
    }
  }, waitTime);
}