const express = require("express");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/helpers");

const router = express.Router();

// GET /api/stats/public — home-page platform statistics (no auth).
router.get(
  "/public",
  asyncHandler(async (req, res) => {
    const [totalDoctors, totalPatients, totalAppointments, totalReviews] =
      await Promise.all([
        collections.doctors().countDocuments({ verificationStatus: "verified" }),
        collections.users().countDocuments({ role: "patient" }),
        collections.appointments().countDocuments(),
        collections.reviews().countDocuments(),
      ]);
    res.json({ totalDoctors, totalPatients, totalAppointments, totalReviews });
  })
);

// GET /api/stats/admin — admin analytics incl. doctor performance (Recharts data).
router.get(
  "/admin",
  verifyToken,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const [totalDoctors, totalPatients, totalAppointments, totalReviews] =
      await Promise.all([
        collections.doctors().countDocuments(),
        collections.users().countDocuments({ role: "patient" }),
        collections.appointments().countDocuments(),
        collections.reviews().countDocuments(),
      ]);

    // Doctor performance: average rating per doctor for the analytics chart.
    const doctorPerformance = await collections
      .reviews()
      .aggregate([
        { $group: { _id: "$doctorId", avgRating: { $avg: "$rating" }, reviews: { $sum: 1 } } },
        {
          $lookup: {
            from: "doctors",
            localField: "_id",
            foreignField: "_id",
            as: "doctor",
          },
        },
        { $unwind: "$doctor" },
        {
          $project: {
            _id: 0,
            doctorName: "$doctor.doctorName",
            avgRating: { $round: ["$avgRating", 2] },
            reviews: 1,
          },
        },
        { $sort: { avgRating: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    res.json({
      totals: { totalDoctors, totalPatients, totalAppointments, totalReviews },
      doctorPerformance,
    });
  })
);

module.exports = router;
