// ============================================================
// Ledger — categories controller
// ============================================================
const categoryService = require("../services/category.service");

exports.list = async (req, res) => {
  const rows = await categoryService.listCategories(req.token, req.user.id);
  res.json({ categories: rows });
};

exports.create = async (req, res) => {
  const row = await categoryService.createCategory(req.token, req.user.id, {
    type: req.body.type,
    name: req.body.name,
  });
  res.status(201).json({ category: row });
};

exports.update = async (req, res) => {
  const row = await categoryService.updateCategory(req.token, req.user.id, req.params.id, {
    name: req.body.name,
  });
  if (!row) return res.status(404).json({ error: "Category not found." });
  res.json({ category: row });
};

exports.remove = async (req, res) => {
  await categoryService.deleteCategory(req.token, req.user.id, req.params.id);
  res.json({ deleted: req.params.id });
};
