const express = require("express");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { asyncHandler, toObjectId } = require("../utils/helpers");

const router = express.Router();

// GET /api/reviews?doctorId= — public: reviews for a doctor, or latest testimonials.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.doctorId) {
      const dId = toObjectId(req.query.doctorId);
      if (!dId) return res.status(400).json({ message: "Invalid doctorId" });
      filter.doctorId = dId;
    }
    const reviews = await collections
      .reviews()
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(req.query.doctorId ? 100 : 12)
      .toArray();
    res.json({ data: reviews });
  })
);

// POST /api/reviews — patient adds a review.
router.post(
  "/",
  verifyToken,
  requireRole("patient"),
  asyncHandler(async (req, res) => {
    const { doctorId, rating, reviewText } = req.body || {};
    const dId = toObjectId(doctorId);
    const r = Number(rating);
    if (!dId || !(r >= 1 && r <= 5)) {
      return res.status(400).json({ message: "doctorId and rating (1-5) are required" });
    }
    const doc = {
      patientId: toObjectId(req.user.id),
      doctorId: dId,
      rating: r,
      reviewText: reviewText || "",
      createdAt: new Date(),
    };
    const result = await collections.reviews().insertOne(doc);
    res.status(201).json({ data: { ...doc, _id: result.insertedId } });
  })
);

// PATCH /api/reviews/:id — patient updates their own review.
router.patch(
  "/:id",
  verifyToken,
  requireRole("patient"),
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid review id" });
    const set = {};
    if (req.body.rating != null) {
      const r = Number(req.body.rating);
      if (!(r >= 1 && r <= 5)) return res.status(400).json({ message: "rating must be 1-5" });
      set.rating = r;
    }
    if (req.body.reviewText != null) set.reviewText = req.body.reviewText;
    const result = await collections
      .reviews()
      .updateOne({ _id: id, patientId: toObjectId(req.user.id) }, { $set: set });
    if (!result.matchedCount) return res.status(404).json({ message: "Review not found" });
    res.json({ message: "Review updated" });
  })
);

// DELETE /api/reviews/:id — patient deletes their own review.
router.delete(
  "/:id",
  verifyToken,
  requireRole("patient"),
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid review id" });
    const result = await collections
      .reviews()
      .deleteOne({ _id: id, patientId: toObjectId(req.user.id) });
    if (!result.deletedCount) return res.status(404).json({ message: "Review not found" });
    res.json({ message: "Review deleted" });
  })
);

module.exports = router;
