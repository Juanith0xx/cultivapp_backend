const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Acceso denegado" })
    }
    next()
  }
}

export default roleGuard