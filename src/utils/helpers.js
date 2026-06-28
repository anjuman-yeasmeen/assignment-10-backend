const { ObjectId } = require("mongodb");

// Wrap async route handlers so thrown errors reach the central error middleware.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Safely build an ObjectId; returns null instead of throwing on bad input.
function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

module.exports = { asyncHandler, toObjectId };
