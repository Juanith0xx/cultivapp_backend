import * as questionService from "./questions.services.js"

/* =========================================
   OBTENER PREGUNTAS
========================================= */

export const getQuestions = async (req, res) => {

  try {

    const questions = await questionService.getQuestions()

    res.json(questions)

  } catch (error) {

    console.error("GET QUESTIONS ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }

}

/* =========================================
   CREAR PREGUNTA
========================================= */

export const createQuestion = async (req, res) => {

  try {

    const question = await questionService.createQuestion(req.body)

    res.status(201).json(question)

  } catch (error) {

    console.error("CREATE QUESTION ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }

}

/* =========================================
   ACTUALIZAR PREGUNTA
========================================= */

export const updateQuestion = async (req, res) => {

  try {

    const updated = await questionService.updateQuestion(
      req.params.id,
      req.body
    )

    res.json(updated)

  } catch (error) {

    console.error("UPDATE QUESTION ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }

}

/* =========================================
   ELIMINAR PREGUNTA
========================================= */

export const deleteQuestion = async (req, res) => {

  try {

    const deleted = await questionService.deleteQuestion(req.params.id)

    res.json(deleted)

  } catch (error) {

    console.error("DELETE QUESTION ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }

}