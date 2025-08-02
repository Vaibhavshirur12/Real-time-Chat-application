// const express = require("express");
// const http = require("http");
// const path = require("path");
// const { Server } = require("socket.io");

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// app.use(express.static(path.join(__dirname, "public")));

// const users = {}; // socket.id -> username
// const rooms = { general: [] }; // roomName -> [messages]
// const userRooms = {}; // socket.id -> current room

// function sanitize(input) {
//   return input.replace(/[<>&"'`]/g, "");
// }

// io.on("connection", (socket) => {
//   let loggedIn = false, username = "";

//   socket.on("login", (name, cb) => {
//     name = sanitize(name.slice(0, 20));
//     if (!name) return cb({ ok: false, error: "Name required." });
//     if (Object.values(users).includes(name))
//       return cb({ ok: false, error: "Name taken." });
//     users[socket.id] = name;
//     username = name;
//     loggedIn = true;
//     userRooms[socket.id] = "general";
//     socket.join("general");
//     io.emit("userlist", Object.values(users));
//     socket.emit("joined", "general", rooms["general"]);
//     socket.to("general").emit("notification", `${username} joined general.`);
//     cb({ ok: true });
//   });

//   socket.on("message", (msg) => {
//     if (!loggedIn) return;
//     let room = userRooms[socket.id] || "general";
//     const text = sanitize(msg.trim()).slice(0, 300);
//     if (!text) return;
//     const message = {
//       user: username,
//       text: text,
//       time: new Date().toLocaleTimeString(),
//     };
//     rooms[room] = rooms[room] || [];
//     rooms[room].push(message);
//     if (rooms[room].length > 100) rooms[room].shift();
//     io.to(room).emit("message", message, room);
//   });

//   socket.on("emote", (emoji) => {
//     if (!loggedIn) return;
//     let room = userRooms[socket.id] || "general";
//     const message = {
//       user: username,
//       text: sanitize(emoji),
//       time: new Date().toLocaleTimeString(),
//       isEmote: true
//     };
//     rooms[room].push(message);
//     io.to(room).emit("message", message, room);
//   });

//   socket.on("switchRoom", (room) => {
//     if (!loggedIn) return;
//     room = sanitize(room).toLowerCase() || "general";
//     if (!rooms[room]) rooms[room] = [];
//     socket.leave(userRooms[socket.id]);
//     socket.join(room);
//     userRooms[socket.id] = room;
//     socket.emit("joined", room, rooms[room]);
//     io.to(room).emit(
//       "notification",
//       `${username} joined ${room === "general" ? 'general' : 'room: ' + room}.`
//     );
//   });

//   socket.on("logout", () => {
//     logout();
//   });

//   function logout() {
//     if (users[socket.id]) delete users[socket.id];
//     delete userRooms[socket.id];
//     loggedIn = false;
//     io.emit("userlist", Object.values(users));
//     socket.disconnect(true);
//   }

//   socket.on("disconnect", () => {
//     if (!loggedIn) return;
//     if (users[socket.id]) delete users[socket.id];
//     delete userRooms[socket.id];
//     io.emit("userlist", Object.values(users));
//   });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });



const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { register, login, verifySocket } = require("./auth");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Authentication REST API ---

app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  const result = register(username, password);
  if (result.ok) {
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const token = login(username, password);
  if (token) {
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid username or password" });
  }
});

// --- Chat logic ---

// Use JWT authentication for socket connections
io.use(verifySocket);

const rooms = { general: [] }; // roomName -> [messages]
const users = {};             // socket.id -> username
const userRooms = {};         // socket.id -> current room

function sanitize(input) {
  return input.replace(/[<>&"'`]/g, "");
}

io.on("connection", (socket) => {
  const username = socket.username;
  users[socket.id] = username;
  let loggedIn = true;

  // Join default room
  const defaultRoom = "general";
  socket.join(defaultRoom);
  userRooms[socket.id] = defaultRoom;

  // Send user list globally
  io.emit("userlist", Object.values(users));

  // Send room chat history and joined event
  socket.emit("joined", defaultRoom, rooms[defaultRoom] || []);

  // Notify room and global user list
  io.to(defaultRoom).emit("notification", `${username} joined ${defaultRoom}.`);

  // Handle incoming chat messages
  socket.on("message", (msg) => {
    if (!loggedIn) return;
    const room = userRooms[socket.id];
    const text = sanitize(msg.trim()).slice(0, 300);
    if (!text) return;
    const message = {
      user: username,
      text,
      time: new Date().toLocaleTimeString(),
      room,
    };
    rooms[room] = rooms[room] || [];
    rooms[room].push(message);
    if (rooms[room].length > 100) rooms[room].shift();
    io.to(room).emit("message", message, room);
  });

  // Handle emotes (emoji)
  socket.on("emote", (emoji) => {
    if (!loggedIn) return;
    const room = userRooms[socket.id];
    const message = {
      user: username,
      text: sanitize(emoji),
      time: new Date().toLocaleTimeString(),
      isEmote: true,
      room,
    };
    rooms[room] = rooms[room] || [];
    rooms[room].push(message);
    io.to(room).emit("message", message, room);
  });

  // Handle room switching
  socket.on("switchRoom", (room) => {
    if (!loggedIn) return;
    room = sanitize(room.toLowerCase()) || "general";
    if (!rooms[room]) rooms[room] = [];

    const oldRoom = userRooms[socket.id];
    if (oldRoom) {
      socket.leave(oldRoom);
      io.to(oldRoom).emit("notification", `${username} left ${oldRoom}.`);
    }
    socket.join(room);
    userRooms[socket.id] = room;
    socket.emit("joined", room, rooms[room]);
    io.to(room).emit("notification", `${username} joined ${room}.`);
  });

  // Handle typing indicator
  socket.on("typing", (typing) => {
    if (!loggedIn) return;
    const room = userRooms[socket.id];
    socket.to(room).emit("userTyping", { user: username, typing });
  });

  // Logout
  socket.on("logout", () => {
    logout();
  });

  function logout() {
    if (users[socket.id]) {
      const room = userRooms[socket.id];
      io.to(room).emit("notification", `${username} left ${room}.`);
      delete users[socket.id];
      delete userRooms[socket.id];
      loggedIn = false;
      io.emit("userlist", Object.values(users));
      socket.disconnect(true);
    }
  }

  // On disconnect
  socket.on("disconnect", () => {
    if (!loggedIn) return;
    const room = userRooms[socket.id];
    delete users[socket.id];
    delete userRooms[socket.id];
    io.to(room).emit("notification", `${username} left ${room}.`);
    io.emit("userlist", Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
