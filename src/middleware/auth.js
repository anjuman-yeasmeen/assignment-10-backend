const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Check your .env file.");
}

// Sign a token carrying the identity + role the rest of the API authorizes on.
function signToken(user) {
  return jwt.sign(
    { id: String(user._id), email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Accept the token from an httpOnly cookie OR an Authorization: Bearer header.
function readToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

// Gate that rejects anything without a valid token; attaches req.user.
function verifyToken(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: no token provided" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized: invalid or expired token" });
  }
}

// Role guard — use after verifyToken, e.g. requireRole("admin").
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { signToken, verifyToken, requireRole, JWT_SECRET };
