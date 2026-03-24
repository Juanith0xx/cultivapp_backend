import pool from "../db.js";

export const getProductByBarcode = async (req, res) => {
  const { barcode } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, name, barcode, brand FROM products WHERE barcode = $1",
      [barcode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};