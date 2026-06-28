const express = require("express");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { asyncHandler, toObjectId } = require("../utils/helpers");

const router = express.Router();

// All appointment routes require a logged-in user.
router.use(verifyToken);

// GET /api/appointments — scoped by role: patient sees own, doctor sees theirs, admin sees all.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === "patient") filter.patientId = toObjectId(req.user.id);
    else if (req.user.role === "doctor") filter.doctorUserId = toObjectId(req.user.id);
    // admin: no filter → all appointments

    const appointments = await collections
      .appointments()
      .find(filter)
      .sort({ appointmentDate: -1 })
      .toArray();
    res.json({ data: appointments });
  })
);

// POST /api/appointments — patient books (payment confirmed separately before "confirmed").
router.post(
  "/",
  requireRole("patient"),
  asyncHandler(async (req, res) => {
    const { doctorId, appointmentDate, appointmentTime, symptoms } = req.body || {};
    const dId = toObjectId(doctorId);
    if (!dId || !appointmentDate || !appointmentTime) {
      return res
        .status(400)
        .json({ message: "doctorId, appointmentDate and appointmentTime are required" });
    }
    const doctor = await collections.doctors().findOne({ _id: dId });
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    const doc = {
      patientId: toObjectId(req.user.id),
      doctorId: dId,
      doctorUserId: doctor.userId || null,
      appointmentDate,
      appointmentTime,
      symptoms: symptoms || "",
      appointmentStatus: "pending",
      paymentStatus: "unpaid",
      consultationFee: doctor.consultationFee || 0,
      createdAt: new Date(),
    };
    const result = await collections.appointments().insertOne(doc);
    res.status(201).json({ data: { ...doc, _id: result.insertedId } });
  })
);

// Helper: load an appointment and check the caller is allowed to touch it.
async function loadOwned(req, res) {
  const id = toObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ message: "Invalid appointment id" });
    return null;
  }
  const appt = await collections.appointments().findOne({ _id: id });
  if (!appt) {
    res.status(404).json({ message: "Appointment not found" });
    return null;
  }
  const isPatient =
    req.user.role === "patient" && String(appt.patientId) === req.user.id;
  const isDoctor =
    req.user.role === "doctor" && String(appt.doctorUserId) === req.user.id;
  if (!isPatient && !isDoctor && req.user.role !== "admin") {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return appt;
}

// PATCH /api/appointments/:id — patient reschedules (date/time) or cancels.
router.patch(
  "/:id",
  requireRole("patient"),
  asyncHandler(async (req, res) => {
    const appt = await loadOwned(req, res);
    if (!appt) return;
    const { appointmentDate, appointmentTime, appointmentStatus } = req.body || {};
    const set = {};
    if (appointmentDate) set.appointmentDate = appointmentDate;
    if (appointmentTime) set.appointmentTime = appointmentTime;
    if (appointmentStatus === "cancelled") set.appointmentStatus = "cancelled";
    await collections.appointments().updateOne({ _id: appt._id }, { $set: set });
    res.json({ message: "Appointment updated" });
  })
);

// PATCH /api/appointments/:id/status — doctor accepts/rejects/completes.
router.patch(
  "/:id/status",
  requireRole("doctor", "admin"),
  asyncHandler(async (req, res) => {
    const appt = await loadOwned(req, res);
    if (!appt) return;
    const { status } = req.body || {};
    if (!["accepted", "rejected", "completed"].includes(status)) {
      return res.status(400).json({ message: "status must be accepted|rejected|completed" });
    }
    await collections
      .appointments()
      .updateOne({ _id: appt._id }, { $set: { appointmentStatus: status } });
    res.json({ message: `Appointment ${status}` });
  })
);

module.exports = router;
