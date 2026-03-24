import pool from "../db.js";

export const saveReplenishment = async (req, res) => {
  const { route_id, product_id, quantity } = req.body;
  const user_id = req.user.id; // Obtenido del middleware de autenticación

  try {
    const result = await pool.query(
      `INSERT INTO replenishment_logs 
       (route_id, product_id, user_id, quantity_added) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [route_id, product_id, user_id, quantity]
    );

    res.status(201).json({
      message: "Reposición registrada correctamente",
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};