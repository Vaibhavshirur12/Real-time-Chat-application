const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = 'supersecretkey';  // use env var in production

const users = {}; // username -> { passwordHash }

function register(username, password) {
  if (!username || !password) {
    return { ok: false, error: 'Username and password required' };
  }
  if (users[username]) {
    return { ok: false, error: 'Username already exists' };
  }
  const hash = bcrypt.hashSync(password, 8);
  users[username] = { passwordHash: hash };
  return { ok: true };
}

function login(username, password) {
  if (!username || !users[username]) return null;
  const valid = bcrypt.compareSync(password, users[username].passwordHash);
  if (!valid) return null;
  const token = jwt.sign({ username }, SECRET, { expiresIn: '1h' });
  return token;
}

// Express middleware to verify JWT in Authorization header
function verifyExpress(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Socket.IO middleware to verify token sent in handshake auth
function verifySocket(socket, next) {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const payload = jwt.verify(token, SECRET);
    socket.username = payload.username;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}

module.exports = {
  register,
  login,
  verifyExpress,
  verifySocket,
};
