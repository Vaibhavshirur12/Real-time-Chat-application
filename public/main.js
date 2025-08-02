// const socket = io();

// const chat = document.getElementById("chat");
// const form = document.getElementById("form");
// const input = document.getElementById("input");
// const messages = document.getElementById("messages");
// const users = document.getElementById("online-users");
// const currentRoom = document.getElementById("current-room");
// const newRoom = document.getElementById("new-room");
// const switchRoomBtn = document.getElementById("switch-room");
// const loginArea = document.getElementById("login-area");
// const loginName = document.getElementById("login-name");
// const loginBtn = document.getElementById("login-btn");
// const loginError = document.getElementById("login-error");
// const notification = document.getElementById("notification");
// const logoutBtn = document.getElementById("logout-btn");
// const typingIndicator = document.getElementById("typing-indicator");

// let myName = "";

// loginBtn.onclick = () => {
//   loginError.textContent = "";
//   const name = loginName.value.trim();
//   if (!name) return (loginError.textContent = "Enter a username");
//   socket.emit("login", name, (res) => {
//     if (!res.ok) return (loginError.textContent = res.error || "Error");
//     myName = name;
//     loginArea.style.display = "none";
//     chat.style.display = "flex";
//   });
// };

// socket.on("userlist", (userList) => {
//   users.innerHTML = userList.length
//     ? '<b>Online:</b> ' + userList
//       .map((u) =>
//         u === myName
//           ? `<span style="color:#ff477e; font-weight:800;">${u}</span>`
//           : `<span>${u}</span>`
//       ).join(", ")
//     : '<span style="color:#ea4335">No users online</span>';
// });

// socket.on("notification", (text) => {
//   notification.innerText = text;
//   notification.classList.add("show");
//   setTimeout(() => notification.classList.remove("show"), 2000);
// });

// form.onsubmit = (e) => {
//   e.preventDefault();
//   if (input.value.trim()) {
//     socket.emit("message", input.value.trim());
//     input.value = "";
//     socket.emit("typing", false);
//   }
// };

// document.querySelectorAll('.emote-btn').forEach((el) =>
//   el.onclick = () => {
//     socket.emit("emote", el.textContent);
//   }
// );

// socket.on("message", (msg, room) => {
//   const li = document.createElement("li");
//   li.className = msg.user === myName ? "my" : "oth";
//   if (msg.isEmote) {
//     li.innerHTML = `<span class='emote'>${msg.text}</span> <span class="bubble-meta">(${msg.user}, ${msg.time})</span>`;
//   } else {
//     li.innerHTML = `<span>${msg.user}:</span> ${msg.text} <span class='bubble-meta'>${msg.time}</span>`;
//   }
//   messages.appendChild(li);
//   messages.scrollTop = messages.scrollHeight;
// });

// let typingTimeout;
// input.addEventListener("input", () => {
//   socket.emit("typing", true);
//   clearTimeout(typingTimeout);
//   typingTimeout = setTimeout(() => {
//     socket.emit("typing", false);
//   }, 800);
// });
// socket.on("userTyping", ({ user, typing }) => {
//   typingIndicator.textContent = typing ? `${user} is typing...` : "";
// });

// switchRoomBtn.onclick = () => {
//   const roomName = newRoom.value.trim().toLowerCase() || "general";
//   socket.emit("switchRoom", roomName);
//   newRoom.value = "";
// };

// logoutBtn.onclick = () => {
//   socket.emit("logout");
//   setTimeout(() => location.reload(), 200);
// };

// socket.on("joined", (room, history) => {
//   currentRoom.textContent = `Room: ${room}`;
//   messages.innerHTML = "";
//   history.forEach((msg) => {
//     const li = document.createElement("li");
//     li.className = msg.user === myName ? "my" : "oth";
//     if (msg.isEmote) {
//       li.innerHTML =
//         `<span class='emote'>${msg.text}</span> <span class="bubble-meta">(${msg.user}, ${msg.time})</span>`;
//     } else {
//       li.innerHTML = `<span>${msg.user}:</span> ${msg.text} <span class='bubble-meta'>${msg.time}</span>`;
//     }
//     messages.appendChild(li);
//   });
//   messages.scrollTop = messages.scrollHeight;
// });

// window.onload = () => {
//   if ("Notification" in window && Notification.permission !== "granted") {
//     Notification.requestPermission();
//   }
// };


let socket = null;
let authToken = null;
let myName = "";

const loginArea = document.getElementById("login-area");
const loginName = document.getElementById("login-name");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const users = document.getElementById("online-users");
const currentRoom = document.getElementById("current-room");
const newRoom = document.getElementById("new-room");
const switchRoomBtn = document.getElementById("switch-room");
const notification = document.getElementById("notification");
const logoutBtn = document.getElementById("logout-btn");
const typingIndicator = document.getElementById("typing-indicator");

function showError(msg) {
  loginError.textContent = msg || "";
}

async function registerUser(username, password) {
  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || "Registration failed");
      return false;
    }
    return true;
  } catch {
    showError("Registration error");
    return false;
  }
}

async function loginUser(username, password) {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || "Login failed");
      return null;
    }
    return data.token;
  } catch {
    showError("Login error");
    return null;
  }
}

loginBtn.onclick = async () => {
  showError("");
  const username = loginName.value.trim();
  if (!username) return showError("Username required");

  let password = prompt("Enter your password:");
  if (password === null) {
    // User cancelled
    return;
  }
  password = password.trim();
  if (!password) return showError("Password required");

  // Try login
  let token = await loginUser(username, password);
  if (!token) {
    // Try register
    const registered = await registerUser(username, password);
    if (!registered) return;
    // After successful register try login again
    token = await loginUser(username, password);
    if (!token) return;
  }

  authToken = token;
  myName = username;
  startSocket();
  loginArea.style.display = "none";
  chat.style.display = "flex";
};

function startSocket() {
  socket = io({
    auth: { token: authToken },
  });

  socket.on("connect_error", (err) => {
    showError(err.message);
  });

  socket.on("connect", () => {
    showError("");
  });

  socket.on("userlist", (userList) => {
    users.innerHTML = userList.length
      ? "<b>Online:</b> " +
        userList
          .map((u) =>
            u === myName
              ? `<span style="color:#ff477e; font-weight:800;">${u}</span>`
              : `<span>${u}</span>`
          )
          .join(", ")
      : '<span style="color:#ea4335">No users online</span>';
  });

  socket.on("notification", (text) => {
    notification.innerText = text;
    notification.classList.add("show");
    setTimeout(() => notification.classList.remove("show"), 2000);
  });

  socket.on("joined", (room, history) => {
    currentRoom.textContent = `Room: ${room}`;
    messages.innerHTML = "";
    history.forEach((msg) => {
      appendMessage(msg);
    });
    messages.scrollTop = messages.scrollHeight;
  });

  socket.on("message", (msg) => {
    appendMessage(msg);
  });

  socket.on("userTyping", ({ user, typing }) => {
    typingIndicator.textContent = typing ? `${user} is typing...` : "";
  });

  socket.on("disconnect", () => {
    showError("Disconnected from server.");
    loginArea.style.display = "flex";
    chat.style.display = "none";
    authToken = null;
    myName = "";
  });
}

function appendMessage(msg) {
  const li = document.createElement("li");
  li.className = msg.user === myName ? "my" : "oth";
  if (msg.isEmote) {
    li.innerHTML = `<span class='emote'>${msg.text}</span> <span class="bubble-meta">(${msg.user}, ${msg.time})</span>`;
  } else {
    li.innerHTML = `<span>${msg.user}:</span> ${msg.text} <span class='bubble-meta'>${msg.time}</span>`;
  }
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

form.onsubmit = (e) => {
  e.preventDefault();
  if (!socket) return;
  const text = input.value.trim();
  if (!text) return;
  socket.emit("message", text);
  input.value = "";
  socket.emit("typing", false);
};

document.querySelectorAll(".emote-btn").forEach((el) => {
  el.onclick = () => {
    if (!socket) return;
    socket.emit("emote", el.textContent);
  };
});

let typingTimeout;
input.addEventListener("input", () => {
  if (!socket) return;
  socket.emit("typing", true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("typing", false);
  }, 800);
});

switchRoomBtn.onclick = () => {
  const roomName = newRoom.value.trim().toLowerCase() || "general";
  if (!socket) return;
  socket.emit("switchRoom", roomName);
  newRoom.value = "";
};

logoutBtn.onclick = () => {
  if (!socket) return;
  socket.emit("logout");
  setTimeout(() => location.reload(), 200);
};

window.onload = () => {
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
};
