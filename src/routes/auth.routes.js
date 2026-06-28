const express = require("express");
const bcrypt = require("bcryptjs");
const { collections } = require("../config/db");
const { signToken, verifyToken } = require("../middleware/auth");
const { asyncHandler, toObjectId } = require("../utils/helpers");

const router = express.Router();

// Spec rule: ≥6 chars including at least one number and one special character.
const PASSWORD_RE = /^(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// POST /api/auth/register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password, photo, phone, gender, role } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }
    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters and include a number and a special character",
      });
    }

    const users = collections.users();
    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Patients/admins self-register; "doctor" sign-ups start unverified until an admin acts.
    const safeRole = ["patient", "doctor"].includes(role) ? role : "patient";
    const hash = await bcrypt.hash(password, 10);

    const doc = {
      name,
      email,
      password: hash,
      role: safeRole,
      photo: photo || "",
      phone: phone || "",
      gender: gender || "",
      status: "active",
      createdAt: new Date(),
    };

    const result = await users.insertOne(doc);
    const user = { ...doc, _id: result.insertedId };
    const token = signToken(user);

    res.cookie("token", token, cookieOptions);
    delete user.password;
    res.status(201).json({ user, token });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const users = collections.users();
    const user = await users.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (user.status === "suspended") {
      return res.status(403).json({ message: "Your account has been suspended" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);
    res.cookie("token", token, cookieOptions);
    delete user.password;
    res.json({ user, token });
  })
);

// POST /api/auth/social — upsert for Google/OAuth users (no password row).
router.post(
  "/social",
  asyncHandler(async (req, res) => {
    const { name, email, photo } = req.body || {};
    if (!email) return res.status(400).json({ message: "email is required" });

    const users = collections.users();
    let user = await users.findOne({ email });
    if (!user) {
      const doc = {
        name: name || email.split("@")[0],
        email,
        role: "patient",
        photo: photo || "",
        phone: "",
        gender: "",
        status: "active",
        createdAt: new Date(),
      };
      const result = await users.insertOne(doc);
      user = { ...doc, _id: result.insertedId };
    }
    if (user.status === "suspended") {
      return res.status(403).json({ message: "Your account has been suspended" });
    }

    const token = signToken(user);
    res.cookie("token", token, cookieOptions);
    delete user.password;
    res.json({ user, token });
  })
);

// GET /api/auth/me — used by the client to restore session after reload.
router.get(
  "/me",
  verifyToken,
  asyncHandler(async (req, res) => {
    const users = collections.users();
    const user = await users.findOne(
      { _id: toObjectId(req.user.id) },
      { projection: { password: 0 } }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  })
);

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", { ...cookieOptions, maxAge: undefined });
  res.json({ message: "Logged out" });
});

module.exports = router;
