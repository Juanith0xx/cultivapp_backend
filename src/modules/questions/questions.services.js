import db from "../../database/db.js"

/* =========================================
   OBTENER PREGUNTAS
========================================= */

export const getQuestions = async () => {

  const result = await db.query(`
    SELECT *
    FROM form_questions
    WHERE is_active = true
    ORDER BY order_index ASC
  `)

  return result.rows

}

/* =========================================
   CREAR PREGUNTA
========================================= */

export const createQuestion = async (data) => {

  const { question, is_required } = data

  const orderResult = await db.query(`
    SELECT COALESCE(MAX(order_index),0) + 1 AS next_order
    FROM form_questions
  `)

  const order_index = orderResult.rows[0].next_order

  const result = await db.query(`
    INSERT INTO form_questions
    (question, order_index, is_required)
    VALUES ($1,$2,$3)
    RETURNING *
  `,
  [
    question,
    order_index,
    is_required || false
  ])

  return result.rows[0]

}

/* =========================================
   ACTUALIZAR PREGUNTA
========================================= */

export const updateQuestion = async (id, data) => {

  const { question, is_required } = data

  const result = await db.query(`
    UPDATE form_questions
    SET
      question = $1,
      is_required = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `,
  [
    question,
    is_required,
    id
  ])

  return result.rows[0]

}

/* =========================================
   ELIMINAR PREGUNTA (SOFT DELETE)
========================================= */

export const deleteQuestion = async (id) => {

  const result = await db.query(`
    UPDATE form_questions
    SET
      is_active = false,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `,
  [id])

  return result.rows[0]

}