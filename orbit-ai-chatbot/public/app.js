const $ = (selector) => document.querySelector(selector);
const conversation = $("#conversation");
const messagesEl = $("#messages");
const welcome = $("#welcome");
const input = $("#messageInput");
const form = $("#chatForm");
const sendButton = $("#sendButton");
const historyList = $("#historyList");
const toast = $("#toast");

const STORAGE_KEY = "orbit-chat-history-v1";
let chats = loadChats();
let activeId = chats[0]?.id || null;
let busy = false;
let toastTimer;

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function loadChats() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data.filter(c => c && c.id && Array.isArray(c.messages)).slice(0, 60) : [];
  } catch { return []; }
}
function saveChats() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 60))); }
  catch { showToast("Chat history couldn't be saved in this browser."); }
}
function activeChat() { return chats.find(c => c.id === activeId); }
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
}
function makeChat() {
  const chat = { id: makeId(), title: "New conversation", messages: [], updatedAt: Date.now() };
  chats.unshift(chat);
  activeId = chat.id;
  saveChats();
  render();
  input.focus();
  closeSidebar();
}
function ensureChat() {
  if (!activeChat()) {
    const chat = { id: makeId(), title: "New conversation", messages: [], updatedAt: Date.now() };
    chats.unshift(chat);
    activeId = chat.id;
  }
  return activeChat();
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function formatText(text) {
  // Escape first; support only lightweight inline code and safe URL links.
  let safe = escapeHtml(text);
  safe = safe.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\n/g, "<br>");
  return safe.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
function renderHistory() {
  historyList.innerHTML = "";
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  if (!sorted.length) {
    const empty = document.createElement("div");
    empty.style.cssText = "padding:8px 10px;color:#6e6c7a;font-size:11px;line-height:1.7";
    empty.textContent = "Your conversations will appear here.";
    historyList.append(empty);
    return;
  }
  sorted.forEach(chat => {
    const row = document.createElement("div");
    row.className = `history-item${chat.id === activeId ? " active" : ""}`;
    row.innerHTML = `<span class="history-icon">◌</span><span class="history-title"></span><button class="history-delete" title="Delete conversation" aria-label="Delete conversation">×</button>`;
    row.querySelector(".history-title").textContent = chat.title || "New conversation";
    row.querySelector(".history-title").addEventListener("click", () => { activeId = chat.id; render(); closeSidebar(); });
    row.querySelector(".history-icon").addEventListener("click", () => { activeId = chat.id; render(); closeSidebar(); });
    row.querySelector(".history-delete").addEventListener("click", (event) => {
      event.stopPropagation();
      chats = chats.filter(c => c.id !== chat.id);
      if (activeId === chat.id) activeId = chats[0]?.id || null;
      saveChats(); render();
      showToast("Conversation deleted.");
    });
    row.addEventListener("click", (event) => {
      if (!event.target.closest("button")) { activeId = chat.id; render(); closeSidebar(); }
    });
    historyList.append(row);
  });
}
function renderMessages() {
  const chat = activeChat();
  messagesEl.innerHTML = "";
  const hasMessages = Boolean(chat?.messages?.length);
  welcome.hidden = hasMessages;
  if (!hasMessages) return;
  chat.messages.forEach((message, index) => {
    const isUser = message.role === "user";
    const article = document.createElement("article");
    article.className = `message${isUser ? " user" : ""}`;
    const avatar = document.createElement("div");
    avatar.className = `message-avatar ${isUser ? "user-avatar" : "assistant-avatar"}`;
    avatar.textContent = isUser ? "Y" : "✦";
    const body = document.createElement("div");
    body.className = "message-body";
    const author = document.createElement("div");
    author.className = "message-author";
    author.textContent = isUser ? "You" : "Orbit";
    const content = document.createElement("div");
    content.className = "message-content";
    content.innerHTML = formatText(message.content);
    body.append(author, content);
    if (!isUser) {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      const copy = document.createElement("button");
      copy.className = "mini-action"; copy.textContent = "Copy";
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(message.content); showToast("Copied to clipboard."); }
        catch { showToast("Clipboard access isn't available in this browser."); }
      });
      actions.append(copy);
      if (index === chat.messages.length - 1 && !busy) {
        const retry = document.createElement("button");
        retry.className = "mini-action"; retry.textContent = "Regenerate";
        retry.addEventListener("click", regenerateLast);
        actions.append(retry);
      }
      body.append(actions);
    }
    article.append(avatar, body);
    messagesEl.append(article);
  });
  if (busy) {
    const typing = document.createElement("article");
    typing.className = "message";
    typing.innerHTML = '<div class="message-avatar assistant-avatar">✦</div><div class="message-body"><div class="message-author">Orbit is thinking</div><div class="typing-dots" aria-label="Orbit is typing"><span></span><span></span><span></span></div></div>';
    messagesEl.append(typing);
  }
  requestAnimationFrame(() => { conversation.scrollTop = conversation.scrollHeight; });
}
function render() { renderHistory(); renderMessages(); }
function setBusy(value) {
  busy = value;
  sendButton.disabled = value;
  sendButton.querySelector("span:first-child").textContent = value ? "Thinking" : "Send";
  renderMessages();
}
function autoResize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  $("#charCount").textContent = `${input.value.length} / 6000`;
}
async function sendMessage(text) {
  const content = text.trim();
  if (!content || busy) return;
  if (content.length > 6000) { showToast("Please keep each message under 6,000 characters."); return; }
  const chat = ensureChat();
  chat.messages.push({ role: "user", content });
  if (chat.messages.filter(m => m.role === "user").length === 1) {
    chat.title = content.length > 34 ? `${content.slice(0, 34).trim()}…` : content;
  }
  chat.updatedAt = Date.now();
  input.value = ""; autoResize(); saveChats(); render();
  await requestReply(chat);
}
async function requestReply(chat) {
  setBusy(true);
  try {
    const messages = chat.messages.slice(-30).map(m => ({ role: m.role, content: m.content }));
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Orbit returned an empty answer. Please try again.");
    chat.messages.push({ role: "assistant", content: data.reply.trim() });
    chat.updatedAt = Date.now();
    saveChats();
  } catch (error) {
    chat.messages.push({
      role: "assistant",
      content: `I couldn't complete that request. ${error.message || "Please check your connection and try again."}`
    });
    chat.messages[chat.messages.length - 1].isError = true;
    showToast(error.message || "Something went wrong.");
  } finally {
    setBusy(false);
    render();
  }
}
async function regenerateLast() {
  const chat = activeChat();
  if (!chat || busy || !chat.messages.length) return;
  if (chat.messages[chat.messages.length - 1].role === "assistant") chat.messages.pop();
  const lastUser = [...chat.messages].reverse().find(m => m.role === "user");
  if (!lastUser) return;
  // Keep context only through the last user message.
  const lastUserIndex = chat.messages.lastIndexOf(lastUser);
  chat.messages = chat.messages.slice(0, lastUserIndex + 1);
  saveChats(); render();
  await requestReply(chat);
}
function closeSidebar() { $("#sidebar").classList.remove("open"); }
form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});
input.addEventListener("input", autoResize);
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
});
$("#newChat").addEventListener("click", makeChat);
$("#clearChat").addEventListener("click", () => {
  const chat = activeChat();
  if (!chat) { showToast("This conversation is already empty."); return; }
  chat.messages = []; chat.title = "New conversation"; chat.updatedAt = Date.now();
  saveChats(); render(); showToast("Conversation cleared.");
});
$("#openSidebar").addEventListener("click", () => $("#sidebar").classList.add("open"));
$("#closeSidebar").addEventListener("click", closeSidebar);
document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); makeChat(); }
  if (event.key === "Escape") closeSidebar();
});
document.querySelectorAll(".suggestion-card").forEach(button => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt || ""));
});
render();
autoResize();
