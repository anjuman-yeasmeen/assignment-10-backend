/**
 * Seed script — creates an admin, sample doctors (with verified profiles),
 * patients, and a few reviews so the app has data to display.
 *
 * Run with:  node src/seed.js
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB, collections, client } = require("./config/db");

const ADMIN = { email: "admin@medicare.com", password: "Admin@123" };

const DOCTORS = [
  { name: "Dr. Sarah Lin", specialization: "Cardiology", hospital: "Heartcare Center", experience: 12, fee: 80, img: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "Dr. James Okoro", specialization: "Neurology", hospital: "NeuroLife Hospital", experience: 9, fee: 100, img: "https://randomuser.me/api/portraits/men/32.jpg" },
  { name: "Dr. Priya Nair", specialization: "Pediatrics", hospital: "Sunrise Children's", experience: 7, fee: 50, img: "https://randomuser.me/api/portraits/women/68.jpg" },
  { name: "Dr. Marco Rossi", specialization: "Orthopedics", hospital: "BoneWell Clinic", experience: 15, fee: 90, img: "https://randomuser.me/api/portraits/men/75.jpg" },
  { name: "Dr. Aisha Khan", specialization: "Dermatology", hospital: "SkinGlow Institute", experience: 6, fee: 60, img: "https://randomuser.me/api/portraits/women/65.jpg" },
  { name: "Dr. David Park", specialization: "Dentistry", hospital: "BrightSmile Dental", experience: 10, fee: 45, img: "https://randomuser.me/api/portraits/men/46.jpg" },
];

async function run() {
  await connectDB();
  const users = collections.users();
  const doctors = collections.doctors();
  const reviews = collections.reviews();

  // Admin
  const adminHash = await bcrypt.hash(ADMIN.password, 10);
  await users.updateOne(
    { email: ADMIN.email },
    {
      $set: { name: "Platform Admin", role: "admin", status: "active", photo: "" },
      $setOnInsert: { password: adminHash, createdAt: new Date(), phone: "", gender: "" },
    },
    { upsert: true }
  );
  console.log(`Admin ready → ${ADMIN.email} / ${ADMIN.password}`);

  // Doctors (+ their user accounts) and verified profiles
  const docHash = await bcrypt.hash("Doctor@123", 10);
  const createdDoctorIds = [];
  for (const d of DOCTORS) {
    const email = d.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "") + "@medicare.com";
    const userRes = await users.updateOne(
      { email },
      {
        $set: { name: d.name, role: "doctor", status: "active", photo: "" },
        $setOnInsert: { password: docHash, createdAt: new Date(), phone: "", gender: "" },
      },
      { upsert: true }
    );
    const userDoc = await users.findOne({ email });

    const profileRes = await doctors.updateOne(
      { userId: userDoc._id },
      {
        $set: {
          userId: userDoc._id,
          doctorName: d.name,
          specialization: d.specialization,
          qualifications: "MBBS, MD",
          experience: d.experience,
          consultationFee: d.fee,
          hospitalName: d.hospital,
          profileImage: d.img,
          availableDays: ["Mon", "Tue", "Wed", "Thu"],
          availableSlots: ["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"],
          verificationStatus: "verified",
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    const doc = await doctors.findOne({ userId: userDoc._id });
    createdDoctorIds.push(doc._id);
  }
  console.log(`Seeded ${DOCTORS.length} verified doctors (login: <name>@medicare.com / Doctor@123)`);

  // A sample patient
  const patientHash = await bcrypt.hash("Patient@123", 10);
  await users.updateOne(
    { email: "patient@medicare.com" },
    {
      $set: { name: "Sample Patient", role: "patient", status: "active", photo: "" },
      $setOnInsert: { password: patientHash, createdAt: new Date(), phone: "", gender: "" },
    },
    { upsert: true }
  );
  const patient = await users.findOne({ email: "patient@medicare.com" });
  console.log("Patient ready → patient@medicare.com / Patient@123");

  // A few testimonials/reviews for the first 3 doctors
  const sampleReviews = [
    { rating: 5, reviewText: "Excellent care and very attentive. Highly recommend!" },
    { rating: 4, reviewText: "Professional and friendly. Wait time was short." },
    { rating: 5, reviewText: "Took time to explain everything clearly. Great doctor." },
  ];
  for (let i = 0; i < 3; i++) {
    await reviews.updateOne(
      { patientId: patient._id, doctorId: createdDoctorIds[i] },
      {
        $set: { ...sampleReviews[i], patientId: patient._id, doctorId: createdDoctorIds[i] },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }
  console.log("Seeded sample reviews");

  await client.close();
  console.log("✅ Seeding complete");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
