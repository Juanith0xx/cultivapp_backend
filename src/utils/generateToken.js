import jwt from "jsonwebtoken"

const generateToken = (payload) => {
  // Aseguramos que el algoritmo sea HS256, que es el que Supabase entiende
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      algorithm: 'HS256', 
      expiresIn: "8h" 
    }
  )
}

export default generateToken