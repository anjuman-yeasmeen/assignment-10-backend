const express = require("express");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { asyncHandler, toObjectId } = require("../utils/helpers");

const router = express.Router();

const SORT_MAP = {
  fee_asc: { consultationFee: 1 },
  fee_desc: { consultationFee: -1 },
  experience: { experience: -1 },
  rating: { avgRating: -1 },
};

// GET /api/doctors — public list with search (Challenge 1), sort (2), pagination (4).
// Query: ?search=&specialization=&sort=&page=&limit=&verifiedOnly=true
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, specialization, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 9));
    const verifiedOnly = req.query.verifiedOnly !== "false";

    const match = {};
    if (verifiedOnly) match.verificationStatus = "verified";
    if (specialization) match.specialization = specialization;
    if (search) {
      match.$or = [
        { doctorName: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
      ];
    }

    const doctors = collections.doctors();
    // Compute avgRating from reviews so we can sort by it and show it on cards.
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "doctorId",
          as: "_reviews",
        },
      },
      {
        $addFields: {
          avgRating: { $ifNull: [{ $avg: "$_reviews.rating" }, 0] },
          reviewCount: { $size: "$_reviews" },
        },
      },
      { $project: { _reviews: 0 } },
      { $sort: SORT_MAP[sort] || { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await doctors.aggregate(pipeline).toArray();
    const total = result.total[0]?.count || 0;
    res.json({
      data: result.data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// GET /api/doctors/featured — a few verified doctors for the home page.
router.get(
  "/featured",
  asyncHandler(async (req, res) => {
    const doctors = await collections
      .doctors()
      .find({ verificationStatus: "verified" })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json({ data: doctors });
  })
);

// GET /api/doctors/me — the logged-in doctor's own profile.
router.get(
  "/me",
  verifyToken,
  requireRole("doctor"),
  asyncHandler(async (req, res) => {
    const doctor = await collections
      .doctors()
      .findOne({ userId: toObjectId(req.user.id) });
    res.json({ data: doctor || null });
  })
);

// GET /api/doctors/:id — public doctor details.
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid doctor id" });
    const doctor = await collections.doctors().findOne({ _id: id });
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json({ data: doctor });
  })
);

// POST /api/doctors — a doctor creates/updates their professional profile.
router.post(
  "/",
  verifyToken,
  requireRole("doctor"),
  asyncHandler(async (req, res) => {
    const {
      doctorName,
      specialization,
      qualifications,
      experience,
      consultationFee,
      hospitalName,
      profileImage,
      availableDays,
      availableSlots,
    } = req.body || {};

    const update = {
      userId: toObjectId(req.user.id),
      doctorName,
      specialization,
      qualifications,
      experience: Number(experience) || 0,
      consultationFee: Number(consultationFee) || 0,
      hospitalName,
      profileImage,
      availableDays: availableDays || [],
      availableSlots: availableSlots || [],
    };

    const doctors = collections.doctors();
    const existing = await doctors.findOne({ userId: update.userId });
    if (existing) {
      await doctors.updateOne({ _id: existing._id }, { $set: update });
      const doc = await doctors.findOne({ _id: existing._id });
      return res.json({ data: doc });
    }

    // New doctor profiles always start unverified — only admin verifies.
    update.verificationStatus = "pending";
    update.createdAt = new Date();
    const result = await doctors.insertOne(update);
    res.status(201).json({ data: { ...update, _id: result.insertedId } });
  })
);

// PATCH /api/doctors/:id/verify — admin only: verify / reject / unverify.
router.patch(
  "/:id/verify",
  verifyToken,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid doctor id" });
    const { status } = req.body || {};
    if (!["verified", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "status must be verified|rejected|pending" });
    }
    const result = await collections
      .doctors()
      .updateOne({ _id: id }, { $set: { verificationStatus: status } });
    if (!result.matchedCount) return res.status(404).json({ message: "Doctor not found" });
    res.json({ message: `Doctor ${status}` });
  })
);

module.exports = router;
