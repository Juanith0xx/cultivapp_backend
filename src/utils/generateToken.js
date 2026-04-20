import jwt from "jsonwebtoken"

const generateToken = (payload) => {
  return jwt.sign(
    {
      ...payload,
      aud: "authenticated",
      role: "authenticated",
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "8h"
    }
  )
}

export default generateToken