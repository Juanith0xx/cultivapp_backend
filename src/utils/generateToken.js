import jwt from "jsonwebtoken"

const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  )
}

export default generateToken