const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    // 🚩 La clave es usar .includes() sobre el array 'allowedRoles'
    // que se genera automáticamente con el operador rest (...)
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Acceso denegado: se requiere rol ${allowedRoles.join(" o ")}` 
      });
    }
    next();
  };
};

export default roleGuard;