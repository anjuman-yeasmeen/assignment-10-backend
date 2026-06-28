const express = require("express");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { asyncHandler, toObjectId } = require("../utils/helpers");

const router = express.Router();
router.use(verifyToken);

// GET /api/prescriptions?appointmentId= — doctor (author) or the patient can read.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.appointmentId) {
      const aId = toObjectId(req.query.appointmentId);
      if (!aId) return res.status(400).json({ message: "Invalid appointmentId" });
      filter.appointmentId = aId;
    }
    if (req.user.role === "patient") filter.patientId = toObjectId(req.user.id);
    if (req.user.role === "doctor") filter.doctorId = toObjectId(req.user.id);

    const data = await collections
      .prescriptions()
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ data });
  })
);

// POST /api/prescriptions — doctor creates after marking an appointment completed.
router.post(
  "/",
  requireRole("doctor"),
  asyncHandler(async (req, res) => {
    const { patientId, appointmentId, diagnosis, medications, notes } = req.body || {};
    const pId = toObjectId(patientId);
    const aId = toObjectId(appointmentId);
    if (!pId || !aId || !diagnosis) {
      return res
        .status(400)
        .json({ message: "patientId, appointmentId and diagnosis are required" });
    }
    const doc = {
      doctorId: toObjectId(req.user.id),
      patientId: pId,
      appointmentId: aId,
      diagnosis,
      medications: medications || [],
      notes: notes || "",
      createdAt: new Date(),
    };
    const result = await collections.prescriptions().insertOne(doc);
    res.status(201).json({ data: { ...doc, _id: result.insertedId } });
  })
);

// PATCH /api/prescriptions/:id — doctor updates their prescription.
router.patch(
  "/:id",
  requireRole("doctor"),
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid prescription id" });
    const set = {};
    ["diagnosis", "medications", "notes"].forEach((k) => {
      if (req.body[k] != null) set[k] = req.body[k];
    });
    const result = await collections
      .prescriptions()
      .updateOne({ _id: id, doctorId: toObjectId(req.user.id) }, { $set: set });
    if (!result.matchedCount) return res.status(404).json({ message: "Prescription not found" });
    res.json({ message: "Prescription updated" });
  })
);

module.exports = router;
