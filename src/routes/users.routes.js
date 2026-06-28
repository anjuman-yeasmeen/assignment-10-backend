const express = require("express");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { asyncHandler, toObjectId } = require("../utils/helpers");

const router = express.Router();
router.use(verifyToken);

// GET /api/users — admin only: manage users.
router.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const users = await collections
      .users()
      .find(filter, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ data: users });
  })
);

// PATCH /api/users/me — any user updates their own profile.
router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const set = {};
    ["name", "photo", "phone", "gender"].forEach((k) => {
      if (req.body[k] != null) set[k] = req.body[k];
    });
    await collections
      .users()
      .updateOne({ _id: toObjectId(req.user.id) }, { $set: set });
    const user = await collections
      .users()
      .findOne({ _id: toObjectId(req.user.id) }, { projection: { password: 0 } });
    res.json({ data: user });
  })
);

// PATCH /api/users/:id/status — admin suspends/reactivates a user.
router.patch(
  "/:id/status",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid user id" });
    const { status } = req.body || {};
    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ message: "status must be active|suspended" });
    }
    const result = await collections.users().updateOne({ _id: id }, { $set: { status } });
    if (!result.matchedCount) return res.status(404).json({ message: "User not found" });
    res.json({ message: `User ${status}` });
  })
);

// DELETE /api/users/:id — admin removes a user.
router.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid user id" });
    const result = await collections.users().deleteOne({ _id: id });
    if (!result.deletedCount) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  })
);

module.exports = router;
