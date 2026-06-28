const express = require("express");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { asyncHandler, toObjectId } = require("../utils/helpers");

const router = express.Router();
router.use(verifyToken);

// Simple transaction id for the auto-pay flow (no external gateway).
function makeTxnId() {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `TXN-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

// POST /api/payments/pay — "click to pay" auto-payment for an appointment.
// Records a payment and marks the appointment paid (no card details required).
router.post(
  "/pay",
  requireRole("patient"),
  asyncHandler(async (req, res) => {
    const { appointmentId } = req.body || {};
    const aId = toObjectId(appointmentId);
    if (!aId) return res.status(400).json({ message: "Invalid appointmentId" });

    const appt = await collections.appointments().findOne({ _id: aId });
    if (!appt || String(appt.patientId) !== req.user.id) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    if (appt.paymentStatus === "paid") {
      return res.status(409).json({ message: "Appointment is already paid" });
    }

    const payment = {
      appointmentId: aId,
      patientId: toObjectId(req.user.id),
      doctorId: appt.doctorId,
      amount: appt.consultationFee || 0,
      transactionId: makeTxnId(),
      paymentDate: new Date(),
    };
    await collections.payments().insertOne(payment);
    await collections
      .appointments()
      .updateOne({ _id: aId }, { $set: { paymentStatus: "paid" } });

    res.status(201).json({ message: "Payment successful", data: payment });
  })
);

// GET /api/payments — patient sees own payments; admin sees all.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!["patient", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const filter =
      req.user.role === "patient" ? { patientId: toObjectId(req.user.id) } : {};
    const data = await collections
      .payments()
      .find(filter)
      .sort({ paymentDate: -1 })
      .toArray();
    res.json({ data });
  })
);

module.exports = router;
